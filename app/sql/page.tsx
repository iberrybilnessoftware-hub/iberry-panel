'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiHatasi } from '../lib/api';

/**
 * SQL konsolu — salt okuma.
 *
 * Ekranın işi sorguyu göndermek değil yalnızca; SINIRLARI GÖRÜNÜR KILMAK.
 * "500 satırda kırpıldı" yazmayan bir konsol, eksik veriye tam sanıp
 * bakmanıza yol açar. Sunucu kırpıldığını söylüyor, burası da yazıyor.
 */

interface Sonuc {
  sutunlar: string[];
  satirlar: Array<Record<string, unknown>>;
  toplam: number;
  kirpildi: boolean;
  azamiSatir: number;
  sureMs: number;
}

interface Tablo { tablo: string; boyut: string; yaklasik_satir: string }

const ORNEKLER = [
  { ad: 'Şubeler', sql: 'select code, name from branches where is_active order by code' },
  { ad: 'Bugünkü satışlar', sql: "select b.code, count(*) adet\nfrom business_partner_sales s\njoin branches b on b.id = s.branch_id\nwhere s.created_at::date = current_date\ngroup by b.code" },
  { ad: 'Şubelere göre stok', sql: "select b.code, sum(sl.on_hand) toplam\nfrom stock_levels sl\njoin warehouses w on w.id = sl.warehouse_id\njoin branches b on b.id = w.branch_id\ngroup by b.code order by 2 desc" },
  { ad: 'Son girişler', sql: "select u.full_name, s.ip, s.created_at\nfrom sessions s join users u on u.id = s.user_id\norder by s.created_at desc limit 20" },
  { ad: 'Kayıtlı konumlar', sql: 'select cidr, label, last_seen_at from network_locations where is_active' },
];

export default function SqlKonsolu() {
  const [sql, setSql] = useState(ORNEKLER[0]!.sql);
  const [sonuc, setSonuc] = useState<Sonuc | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [kapali, setKapali] = useState(false);
  const [bekliyor, setBekliyor] = useState(false);
  const [tablolar, setTablolar] = useState<Tablo[]>([]);

  useEffect(() => {
    void api<Tablo[]>('dev/schema').then(setTablolar).catch(() => setTablolar([]));
  }, []);

  const calistir = useCallback(async () => {
    setBekliyor(true); setHata(null); setKapali(false);
    try {
      setSonuc(await api<Sonuc>('dev/sql', { method: 'POST', body: JSON.stringify({ sql }) }));
    } catch (e) {
      setSonuc(null);
      const m = e instanceof Error ? e.message : 'Sorgu çalıştırılamadı';
      // Konsol hiç yapılandırılmamışsa bu bir sorgu hatası değil, kurulum
      // eksiği — ayrı gösteriyoruz ki SQL'de hata aranmasın.
      if (e instanceof ApiHatasi && m.includes('SQL_CONSOLE_DISABLED')) setKapali(true);
      else setHata(m);
    } finally {
      setBekliyor(false);
    }
  }, [sql]);

  return (
    <>
      <h1>SQL Konsolu</h1>
      <p className="altbaslik">
        Salt okuma. Yazma, veritabanı rolü seviyesinde engelli — tek sorgu, 5 sn süre sınırı,
        her sorgu denetime yazılıyor.
      </p>

      {kapali && (
        <div className="uyari-kutu">
          <b>Konsol yapılandırılmamış.</b> Salt-okuma veritabanı rolü oluşturulup
          <code> DATABASE_URL_RO</code> tanımlanmalı. Kurulum: <code>deploy/SQL-KONSOLU.md</code>.
          <br />
          <span className="sonuk">
            Uygulamanın kendi bağlantısına düşmüyoruz — bu ekranı açabilen herkese
            yazma yetkisi vermek olurdu.
          </span>
        </div>
      )}

      <div className="arac">
        {ORNEKLER.map((o) => (
          <button key={o.ad} type="button" onClick={() => setSql(o.sql)}>{o.ad}</button>
        ))}
      </div>

      <textarea
        className="sql-alan"
        value={sql}
        onChange={(e) => setSql(e.target.value)}
        spellCheck={false}
        rows={7}
        onKeyDown={(e) => {
          // Ctrl/Cmd+Enter ile çalıştır — konsol beklentisi.
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); void calistir(); }
        }}
      />

      <div className="arac">
        <button type="button" onClick={() => void calistir()} disabled={bekliyor}>
          {bekliyor ? 'Çalışıyor…' : 'Çalıştır'}
        </button>
        <span className="sonuk" style={{ fontSize: 12 }}>⌘/Ctrl + Enter</span>
        {sonuc && (
          <span className="sayac">
            {sonuc.toplam} satır · {sonuc.sureMs} ms
            {sonuc.kirpildi && <> · <span style={{ color: 'var(--uyari)' }}>ilk {sonuc.azamiSatir} gösteriliyor</span></>}
          </span>
        )}
      </div>

      {hata && <div className="hata-kutu"><code>{hata}</code></div>}

      {sonuc && sonuc.satirlar.length === 0 && !hata && (
        <div className="bos">Sorgu çalıştı, sonuç boş.</div>
      )}

      {sonuc && sonuc.satirlar.length > 0 && (
        <>
          {sonuc.kirpildi && (
            <div className="uyari-kutu">
              Sonuç <b>{sonuc.azamiSatir} satırda kırpıldı</b> (toplam {sonuc.toplam}).
              Tamamı için sorguya <code>limit</code> ya da bir süzgeç ekleyin.
            </div>
          )}
          <div className="tablo-sar">
            <table>
              <thead><tr>{sonuc.sutunlar.map((s) => <th key={s}>{s}</th>)}</tr></thead>
              <tbody>
                {sonuc.satirlar.map((r, i) => (
                  <tr key={i}>
                    {sonuc.sutunlar.map((s) => (
                      <td key={s} className="mono">
                        {r[s] === null ? <span className="sonuk">null</span> : String(r[s])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tablolar.length > 0 && (
        <section style={{ marginTop: 28 }}>
          <h2 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--metin-2)', margin: '0 0 10px' }}>
            Tablolar
          </h2>
          <div className="tablo-sar">
            <table>
              <thead><tr><th>Tablo</th><th>Boyut</th><th>Yaklaşık satır</th></tr></thead>
              <tbody>
                {tablolar.map((t) => (
                  <tr key={t.tablo} style={{ cursor: 'pointer' }} onClick={() => setSql(`select * from ${t.tablo} limit 50`)}>
                    <td className="mono">{t.tablo}</td>
                    <td className="sonuk">{t.boyut}</td>
                    <td className="sonuk">{Number(t.yaklasik_satir) < 0 ? '—' : Number(t.yaklasik_satir).toLocaleString('tr-TR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="sonuk" style={{ fontSize: 12, marginTop: 8 }}>
            Satır sayıları yaklaşık (PostgreSQL istatistiklerinden) — kesin sayı için <code>count(*)</code>.
          </p>
        </section>
      )}
    </>
  );
}
