'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';

/**
 * Deploy takibi — iş akışının kendi bildirdiği sonuç.
 *
 * ÖNCE GITHUB API'SİNDEN OKUNUYORDU ve bu bir okuma jetonu gerektiriyordu:
 * üretilecek, saklanacak, süresi dolacak, sızabilecek bir kimlik bilgisi —
 * yalnız "hangi commit ne zaman çıktı" sorusu için. İş akışının sunucuya SSH
 * erişimi zaten vardı; artık sonucu kendisi yazıyor.
 *
 * TABLO DARALDI: iş akışı adı, dal ve süre artık YOK. Uydurmak yerine
 * kaldırdık — elimizde olmayan bilgiyi göstermek, yanlış bilgi göstermektir.
 */

interface Calisma {
  sha: string;
  kisaSha: string;
  mesaj: string | null;
  kisi: string | null;
  durum: string;
  basarili: boolean;
  url: string | null;
  zaman: string;
}

interface Cevap {
  yapilandirildi: boolean;
  not: string | null;
  depolar: Array<{ depo: string; calismalar: Calisma[] }>;
}

const zaman = (iso: string) =>
  new Date(iso).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

function Durum({ c }: { c: Calisma }) {
  if (c.basarili) return <span className="rozet r-ok">başarılı</span>;
  if (c.durum === 'cancelled') return <span className="rozet r-sonuk">iptal</span>;
  return <span className="rozet r-hata">{c.durum}</span>;
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
            <div className="bos">Bu depoda henüz dağıtım kaydı yok.</div>
          ) : (
            <div className="tablo-sar">
              <table>
                <thead>
                  <tr><th>Durum</th><th>Commit</th><th>Kim</th><th>Ne zaman</th><th /></tr>
                </thead>
                <tbody>
                  {r.calismalar.map((c) => (
                    <tr key={c.sha + c.zaman}>
                      <td><Durum c={c} /></td>
                      <td>
                        <span className="mono">{c.kisaSha}</span>
                        <div className="sonuk" style={{ fontSize: 11, maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.mesaj ?? '—'}
                        </div>
                      </td>
                      <td className="sonuk">{c.kisi ?? '—'}</td>
                      <td className="mono">{zaman(c.zaman)}</td>
                      <td>{c.url ? <a href={c.url} target="_blank" rel="noreferrer">aç ↗</a> : null}</td>
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
