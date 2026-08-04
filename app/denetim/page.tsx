'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';

/**
 * Denetim Kayıtları — kim, ne zaman, neyi değiştirdi.
 *
 * Hata Akışı "az önce ne patladı" sorusuna bakıyor; burası "bu kayıt neden
 * böyle oldu" sorusuna. Korelasyon numarası ikisini birbirine bağlıyor:
 * hata akışındaki istek numarasını buraya yazarak aynı isteğin ne yaptığını
 * görebiliyorsunuz.
 */

interface Kayit {
  id: string;
  zaman: string;
  islem: string;
  varlik: string;
  varlikId: string | null;
  kisi: string | null;
  eposta: string | null;
  sube: string | null;
  korelasyon: string | null;
}

const zaman = (iso: string) =>
  new Date(iso).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });

export default function Denetim() {
  const [kayitlar, setKayitlar] = useState<Kayit[] | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [uygulanan, setUygulanan] = useState('');

  const yukle = useCallback(async (arama: string) => {
    const p = new URLSearchParams({ limit: '200' });
    if (arama) p.set('q', arama);
    try { setKayitlar(await api<Kayit[]>(`dev/audit?${p}`)); setHata(null); }
    catch (e) { setHata(e instanceof Error ? e.message : 'Alınamadı'); }
  }, []);

  useEffect(() => { void yukle(uygulanan); }, [yukle, uygulanan]);

  return (
    <>
      <h1>Denetim Kayıtları</h1>
      <p className="altbaslik">
        Kim ne zaman neyi değiştirdi. Korelasyon numarası, Hata Akışı&apos;ndaki istek numarasıyla aynı.
      </p>

      {hata && <div className="hata-kutu">{hata}</div>}

      <form
        className="arac"
        onSubmit={(e) => { e.preventDefault(); setUygulanan(q.trim()); }}
      >
        <input
          placeholder="işlem, varlık ya da korelasyon numarası"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button type="submit">Ara</button>
        {uygulanan && (
          <button type="button" onClick={() => { setQ(''); setUygulanan(''); }}>Temizle</button>
        )}
        {kayitlar && <span className="sayac">{kayitlar.length} kayıt</span>}
      </form>

      {kayitlar === null && <div className="bos">Yükleniyor…</div>}
      {kayitlar?.length === 0 && (
        <div className="bos">
          Kayıt bulunamadı.
          {uygulanan && <><br /><span className="sonuk">&quot;{uygulanan}&quot; aramasıyla eşleşen yok.</span></>}
        </div>
      )}

      {!!kayitlar?.length && (
        <div className="tablo-sar">
          <table>
            <thead>
              <tr><th>Zaman</th><th>İşlem</th><th>Varlık</th><th>Kişi</th><th>Şube</th><th>Korelasyon</th></tr>
            </thead>
            <tbody>
              {kayitlar.map((k) => (
                <tr key={k.id}>
                  <td className="mono">{zaman(k.zaman)}</td>
                  <td className="mono">{k.islem}</td>
                  <td>
                    {k.varlik}
                    {k.varlikId && <div className="mono sonuk" style={{ fontSize: 11 }}>{k.varlikId.slice(0, 8)}…</div>}
                  </td>
                  <td>
                    {k.kisi ?? <span className="sonuk">sistem</span>}
                    {k.eposta && <div className="sonuk" style={{ fontSize: 11 }}>{k.eposta}</div>}
                  </td>
                  <td className="sonuk">{k.sube ?? '—'}</td>
                  <td className="mono sonuk">{k.korelasyon ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
