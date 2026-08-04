'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '../lib/api';

/**
 * Hata Akışı — az önce ne patladı.
 *
 * Her satır tek bir başarısız isteği anlatıyor: hangi yol, hangi kod, kim,
 * hangi ağdan. Kod sütunu sözlüğe bağlı: "BRANCH_UNKNOWN gördüm" diyen kişi
 * tıklayıp ne yapması gerektiğini okuyabiliyor.
 */

interface Kayit {
  zaman: string; method: string; path: string; status: number;
  code: string; message: string; requestId: string;
  userId: string | null; ip: string | null; konum: string | null; branchId: string | null;
}

interface Cevap {
  ozet: { adet: number; kapasite: number; enEski: string | null };
  kayitlar: Kayit[];
}

const saat = (iso: string) =>
  new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

const durumSinifi = (s: number) => (s >= 500 ? 'r-hata' : s === 403 ? 'r-uyari' : 'r-sonuk');

/** Kaç saniyede bir tazelensin — sorun yaşanırken açık tutulacak ekran. */
const TAZELE_MS = 5000;

export default function HataAkisi() {
  const [d, setD] = useState<Cevap | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [otomatik, setOtomatik] = useState(true);

  const yukle = useCallback(async () => {
    const p = new URLSearchParams({ limit: '150' });
    if (q) p.set('q', q);
    if (status) p.set('status', status);
    try { setD(await api<Cevap>(`dev/errors?${p}`)); setHata(null); }
    catch (e) { setHata(e instanceof Error ? e.message : 'Alınamadı'); }
  }, [q, status]);

  useEffect(() => { void yukle(); }, [yukle]);

  useEffect(() => {
    if (!otomatik) return;
    // Sekme arka plandayken yoklamanın anlamı yok.
    const t = setInterval(() => { if (document.visibilityState === 'visible') void yukle(); }, TAZELE_MS);
    return () => clearInterval(t);
  }, [otomatik, yukle]);

  return (
    <>
      <h1>Hata Akışı</h1>
      <p className="altbaslik">
        Son başarısız istekler. Bellekte tutuluyor — sunucu yeniden başlayınca siliniyor.
        Jeton süresi dolmaları (401) kaydedilmiyor.
      </p>

      {hata && <div className="hata-kutu">{hata}</div>}

      <div className="arac">
        <input placeholder="yol, kod ya da mesajda ara" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">tüm durumlar</option>
          <option value="400">400 · doğrulama</option>
          <option value="403">403 · yetki / konum</option>
          <option value="404">404 · bulunamadı</option>
          <option value="409">409 · çakışma</option>
          <option value="429">429 · hız sınırı</option>
          <option value="500">500 · sunucu</option>
        </select>
        <button type="button" onClick={() => void yukle()}>Yenile</button>
        <button type="button" onClick={() => setOtomatik((v) => !v)}>
          {otomatik ? '⏸ otomatik açık' : '▶ otomatik kapalı'}
        </button>
        {d && <span className="sayac">{d.kayitlar.length} kayıt · tamponda {d.ozet.adet}/{d.ozet.kapasite}</span>}
      </div>

      {d && d.kayitlar.length === 0 && (
        <div className="bos">
          Hiç hata kaydı yok.<br />
          <span className="sonuk">İyi haber — ya da sunucu yakın zamanda yeniden başlatıldı.</span>
        </div>
      )}

      {d && d.kayitlar.length > 0 && (
        <div className="tablo-sar">
          <table>
            <thead>
              <tr>
                <th>Saat</th><th>Durum</th><th>Kod</th><th>İstek</th>
                <th>Mesaj</th><th>Konum</th><th>İstek No</th>
              </tr>
            </thead>
            <tbody>
              {d.kayitlar.map((k) => (
                <tr key={k.requestId + k.zaman}>
                  <td className="mono">{saat(k.zaman)}</td>
                  <td><span className={`rozet ${durumSinifi(k.status)}`}>{k.status}</span></td>
                  <td className="mono">
                    <Link href={`/sozluk#${k.code}`}>{k.code}</Link>
                  </td>
                  <td className="mono sonuk">{k.method} {k.path}</td>
                  <td>{k.message}</td>
                  <td className="sonuk">{k.konum ?? <span title="Konum çözülemedi">—</span>}</td>
                  <td className="mono sonuk">{k.requestId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
