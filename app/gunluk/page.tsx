'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';

/**
 * Sunucu günlüğü — "backend ne diyor".
 *
 * Sınırını ekranda yazıyoruz: yalnız API sürecinin satırları. Postgres,
 * Caddy ve konteyner çöküşleri burada YOK. Bunu yazmazsak, sorun başka
 * katmandayken burada boşuna aranır.
 */

interface Satir { zaman: string; seviye: string; kaynak: string; mesaj: string }
interface Cevap { ozet: { adet: number; kapasite: number; enEski: string | null }; satirlar: Satir[] }

const saat = (iso: string) =>
  new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

const sinif = (s: string) => (s === 'error' ? 'r-hata' : s === 'warn' ? 'r-uyari' : 'r-sonuk');

const TAZELE_MS = 4000;

export default function Gunluk() {
  const [d, setD] = useState<Cevap | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [seviye, setSeviye] = useState('');
  const [otomatik, setOtomatik] = useState(true);

  const yukle = useCallback(async () => {
    const p = new URLSearchParams({ limit: '300' });
    if (q) p.set('q', q);
    if (seviye) p.set('level', seviye);
    try { setD(await api<Cevap>(`dev/logs?${p}`)); setHata(null); }
    catch (e) { setHata(e instanceof Error ? e.message : 'Alınamadı'); }
  }, [q, seviye]);

  useEffect(() => { void yukle(); }, [yukle]);
  useEffect(() => {
    if (!otomatik) return;
    const t = setInterval(() => { if (document.visibilityState === 'visible') void yukle(); }, TAZELE_MS);
    return () => clearInterval(t);
  }, [otomatik, yukle]);

  return (
    <>
      <h1>Sunucu Günlüğü</h1>
      <p className="altbaslik">
        API sürecinin son satırları. <b>Yalnız bu süreç</b> — Postgres, Caddy ve konteyner
        çöküşleri burada görünmüyor, onlar için sunucuya bakmak gerekiyor.
      </p>

      {hata && <div className="hata-kutu">{hata}</div>}

      <div className="arac">
        <input placeholder="mesaj ya da kaynakta ara" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={seviye} onChange={(e) => setSeviye(e.target.value)}>
          <option value="">tüm seviyeler</option>
          <option value="error">error</option>
          <option value="warn">warn</option>
          <option value="log">log</option>
          <option value="debug">debug</option>
        </select>
        <button type="button" onClick={() => void yukle()}>Yenile</button>
        <button type="button" onClick={() => setOtomatik((v) => !v)}>
          {otomatik ? '⏸ otomatik açık' : '▶ otomatik kapalı'}
        </button>
        {d && <span className="sayac">{d.satirlar.length} satır · tamponda {d.ozet.adet}/{d.ozet.kapasite}</span>}
      </div>

      {d && d.satirlar.length === 0 && (
        <div className="bos">
          Günlük satırı yok.<br />
          <span className="sonuk">Sunucu yakın zamanda yeniden başlatılmış olabilir — tampon bellekte tutuluyor.</span>
        </div>
      )}

      {d && d.satirlar.length > 0 && (
        <div className="tablo-sar">
          <table>
            <thead><tr><th>Saat</th><th>Seviye</th><th>Kaynak</th><th>Mesaj</th></tr></thead>
            <tbody>
              {d.satirlar.map((l, i) => (
                <tr key={`${l.zaman}-${i}`}>
                  <td className="mono">{saat(l.zaman)}</td>
                  <td><span className={`rozet ${sinif(l.seviye)}`}>{l.seviye}</span></td>
                  <td className="mono sonuk">{l.kaynak}</td>
                  <td className="mono" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{l.mesaj}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
