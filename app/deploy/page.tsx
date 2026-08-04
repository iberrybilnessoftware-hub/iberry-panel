'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';

/**
 * Deploy takibi — GitHub Actions çalışmaları.
 *
 * Jeton tarayıcıya inmiyor; merkez API GitHub'a kendisi soruyor.
 * Yapılandırılmamışsa bu bir hata değil, eksik bir kurulum — öyle de
 * gösteriliyor.
 */

interface Calisma {
  id: number; ad: string; dal: string; commit: string; commitMesaji: string;
  durum: string; sonuc: string | null; basladi: string; bitti: string | null;
  sureSn: number | null; yazar: string | null; url: string;
}

interface Cevap {
  yapilandirildi: boolean;
  not: string | null;
  depolar: Array<{ depo: string; calismalar: Calisma[] }>;
}

const zaman = (iso: string) =>
  new Date(iso).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

const sure = (sn: number | null) => (sn === null ? '—' : sn < 60 ? `${sn} sn` : `${Math.floor(sn / 60)} dk ${sn % 60} sn`);

function Durum({ c }: { c: Calisma }) {
  if (c.durum !== 'completed') return <span className="rozet r-uyari">{c.durum === 'in_progress' ? 'çalışıyor' : 'sırada'}</span>;
  if (c.sonuc === 'success') return <span className="rozet r-ok">başarılı</span>;
  if (c.sonuc === 'cancelled') return <span className="rozet r-sonuk">iptal</span>;
  return <span className="rozet r-hata">{c.sonuc ?? 'hata'}</span>;
}

const TAZELE_MS = 20_000;

export default function Deploy() {
  const [d, setD] = useState<Cevap | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  const yukle = useCallback(async () => {
    try { setD(await api<Cevap>('dev/deploys')); setHata(null); }
    catch (e) { setHata(e instanceof Error ? e.message : 'Alınamadı'); }
  }, []);

  useEffect(() => { void yukle(); }, [yukle]);
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') void yukle(); }, TAZELE_MS);
    return () => clearInterval(t);
  }, [yukle]);

  return (
    <>
      <h1>Deploy</h1>
      <p className="altbaslik">GitHub Actions çalışmaları — hangi commit, ne zaman, başarılı mı.</p>

      {hata && <div className="hata-kutu">{hata}</div>}

      {d && !d.yapilandirildi && (
        <div className="uyari-kutu">
          <b>Deploy takibi yapılandırılmamış.</b> {d.not}
          <br />
          <span className="sonuk">
            Sunucuda <code>GITHUB_TOKEN</code> ve <code>GITHUB_REPOS</code> (virgülle ayrılmış
            <code> sahip/depo</code> listesi) tanımlanmalı. Jeton tarayıcıya inmiyor.
          </span>
        </div>
      )}

      {d?.depolar.map((r) => (
        <section key={r.depo} style={{ marginBottom: 26 }}>
          <h2 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--metin-2)', margin: '0 0 10px' }}>
            {r.depo}
          </h2>
          {r.calismalar.length === 0 ? (
            <div className="bos">Çalışma bulunamadı ya da depoya erişilemedi.</div>
          ) : (
            <div className="tablo-sar">
              <table>
                <thead>
                  <tr><th>Durum</th><th>İş akışı</th><th>Commit</th><th>Dal</th><th>Başladı</th><th>Süre</th><th /></tr>
                </thead>
                <tbody>
                  {r.calismalar.map((c) => (
                    <tr key={c.id}>
                      <td><Durum c={c} /></td>
                      <td>{c.ad}</td>
                      <td>
                        <span className="mono">{c.commit}</span>
                        <div className="sonuk" style={{ fontSize: 11, maxWidth: 380, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.commitMesaji}
                        </div>
                      </td>
                      <td className="mono sonuk">{c.dal}</td>
                      <td className="mono">{zaman(c.basladi)}</td>
                      <td className="sonuk">{sure(c.sureSn)}</td>
                      <td><a href={c.url} target="_blank" rel="noreferrer">aç ↗</a></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}
    </>
  );
}
