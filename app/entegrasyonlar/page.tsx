'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';

/**
 * Entegrasyon anahtarları — DURUM ekranı, düzenleme ekranı değil.
 *
 * NİYE VAR: `ANTHROPIC_API_KEY` üretimde boştu ve kimsenin haberi yoktu.
 * AI asistanı sessizce "yapılandırılmamış" davranıyordu: hata yok, uyarı
 * yok, panelde iz yok. Sunucuya SSH ile girip `.env` okumadan anlaşılmıyordu.
 *
 * NİYE AYARLAR EKRANINDA DEĞİL: Ayarlar panelden DEĞİŞTİRİLİYOR ve değerler
 * veritabanına yazılıyor. Sırlar `.env`'de kalmak zorunda — ayar tablosu düz
 * metin ve her yedeğe giriyor. Aynı ekrana koymak "burayı da düzenleyebilirim"
 * beklentisi yaratırdı.
 */

interface Sir {
  key: string;
  baslik: string;
  aciklama: string;
  /** Boşsa ne bozulur — "önemli mi" sorusunun cevabı. */
  bosDemek: string;
  tanimli: boolean;
  uzunluk: number;
  /** Maskeli ipucu (baş 6 + son 4); tanımlı değilse null. */
  ipucu: string | null;
  testEdilebilir: boolean;
}

interface TestSonucu { basarili: boolean; mesaj: string }

export default function Entegrasyonlar() {
  const [sirlar, setSirlar] = useState<Sir[] | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState<string | null>(null);
  const [sonuc, setSonuc] = useState<Record<string, TestSonucu>>({});

  const yukle = useCallback(async () => {
    try { setSirlar(await api<Sir[]>('dev/sirlar')); setHata(null); }
    catch (e) { setHata(e instanceof Error ? e.message : 'Alınamadı'); }
  }, []);
  useEffect(() => { void yukle(); }, [yukle]);

  const sina = async (s: Sir) => {
    setMesgul(s.key);
    try {
      const r = await api<TestSonucu>(`dev/sirlar/${s.key}/sina`, { method: 'POST' });
      setSonuc((x) => ({ ...x, [s.key]: r }));
    } catch (e) {
      setSonuc((x) => ({ ...x, [s.key]: { basarili: false, mesaj: e instanceof Error ? e.message : 'Sınanamadı' } }));
    } finally { setMesgul(null); }
  };

  const eksik = sirlar?.filter((s) => !s.tanimli).length ?? 0;

  return (
    <>
      <h1>Entegrasyonlar</h1>
      <p className="altbaslik">
        Anahtarlar sunucudaki <code>.env</code> dosyasında tutuluyor ve buradan <b>değiştirilemiyor</b>.
        Bu ekran hangisinin tanımlı olduğunu ve gerçekten çalışıp çalışmadığını gösteriyor.
        {sirlar !== null && eksik > 0 && <> · <span style={{ color: 'var(--uyari)' }}>{eksik} anahtar eksik</span></>}
      </p>

      {hata && <div className="hata-kutu">{hata}</div>}
      {sirlar === null && <div className="bos">Yükleniyor…</div>}

      {sirlar?.map((s) => {
        const r = sonuc[s.key];
        return (
          <article key={s.key} className="sozluk-madde">
            <h3>
              {s.baslik}
              <span className={`rozet ${s.tanimli ? 'r-ok' : 'r-hata'}`}>
                {s.tanimli ? 'tanımlı' : 'tanımlı değil'}
              </span>
              <code style={{ fontSize: 11, color: 'var(--metin-2)', fontWeight: 400 }}>{s.key}</code>
            </h3>
            <p>{s.aciklama}</p>

            {/* Eksikse SONUCUNU yazıyoruz. "Tanımlı değil" tek başına önemli mi
                belirsiz; ne bozulduğunu söylemek karar verdiriyor. */}
            {!s.tanimli && (
              <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--uyari)' }}>{s.bosDemek}</p>
            )}

            {s.ipucu && (
              /* Maskeli ipucu: doğru anahtarı koyduğunu ANLAMAYA yeter,
                 kullanmaya yetmez. */
              <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--metin-2)' }}>
                değer: <code>{s.ipucu}</code> · {s.uzunluk} karakter
              </p>
            )}

            <div className="arac" style={{ margin: '10px 0 0' }}>
              {s.testEdilebilir ? (
                <button type="button" disabled={!s.tanimli || mesgul === s.key} onClick={() => void sina(s)}>
                  {mesgul === s.key ? 'Deneniyor…' : 'Bağlantıyı sına'}
                </button>
              ) : (
                /* Test yoksa bunu SÖYLÜYORUZ. Sessiz bırakmak "sınandı ve geçti"
                   izlenimi verirdi; oysa yalnız varlığına bakıldı. */
                <span style={{ fontSize: 12, color: 'var(--metin-2)', fontStyle: 'italic' }}>
                  otomatik test yok — yalnız tanımlı olup olmadığına bakılıyor
                </span>
              )}
              {r && (
                <span style={{ fontSize: 12, color: r.basarili ? 'var(--ok)' : 'var(--uyari)' }}>{r.mesaj}</span>
              )}
            </div>
          </article>
        );
      })}
    </>
  );
}
