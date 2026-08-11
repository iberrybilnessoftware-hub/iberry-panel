'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';

/**
 * Entegrasyon anahtarları — durum + düzenleme.
 *
 * NİYE VAR: `ANTHROPIC_API_KEY` üretimde boştu ve kimsenin haberi yoktu.
 * AI asistanı sessizce "yapılandırılmamış" davranıyordu: hata yok, uyarı
 * yok, panelde iz yok. Sunucuya SSH ile girip `.env` okumadan anlaşılmıyordu.
 *
 * DEĞER GERİ OKUNMUYOR — yalnız yazılıyor. Sunucu maskeli ipucundan başka
 * bir şey döndürmüyor; bu ekranı gören biri var olan anahtarları öğrenemiyor,
 * yalnız değiştirebiliyor.
 *
 * AYARLAR EKRANINDAN AYRI: Ayarlar düz metin saklıyor, sırlar şifreli. İkisi
 * aynı ekranda olsaydı hangisinin nasıl saklandığı belirsizleşirdi.
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
  /** Değer nereden geliyor — panelden mi, sunucudaki .env'den mi. */
  kaynak: 'panel' | 'ortam' | 'yok';
}

const KAYNAK: Record<Sir['kaynak'], { ad: string; sinif: string }> = {
  panel: { ad: 'panelden', sinif: 'r-ok' },
  ortam: { ad: 'sunucu .env', sinif: 'r-sonuk' },
  yok: { ad: 'tanımlı değil', sinif: 'r-hata' },
};

interface TestSonucu { basarili: boolean; mesaj: string }

export default function Entegrasyonlar() {
  const [sirlar, setSirlar] = useState<Sir[] | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState<string | null>(null);
  const [sonuc, setSonuc] = useState<Record<string, TestSonucu>>({});
  /** Hangi anahtar düzenleniyor + yazılan değer. Değer EKRANDAN OKUNMUYOR,
      yalnız yazılıyor: sunucu zaten geri döndürmüyor. */
  const [duzenlenen, setDuzenlenen] = useState<string | null>(null);
  const [taslak, setTaslak] = useState('');

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

  const kaydet = async (s: Sir) => {
    if (!taslak.trim()) return;
    setMesgul(s.key);
    try {
      await api(`dev/sirlar/${s.key}`, { method: 'PUT', body: JSON.stringify({ value: taslak.trim() }) });
      setDuzenlenen(null); setTaslak('');
      await yukle();
      // Kaydetmek "çalışıyor" demek değil — eski sonucu silip yeniden sınatıyoruz.
      setSonuc((x) => { const y = { ...x }; delete y[s.key]; return y; });
    } catch (e) { setHata(e instanceof Error ? e.message : 'Kaydedilemedi'); }
    finally { setMesgul(null); }
  };

  const paneldenKaldir = async (s: Sir) => {
    if (!confirm(`${s.baslik} panelden kaldırılsın mı?\n\nSunucudaki .env değerine geri dönülecek.`)) return;
    setMesgul(s.key);
    try { await api(`dev/sirlar/${s.key}`, { method: 'DELETE' }); await yukle(); }
    catch (e) { setHata(e instanceof Error ? e.message : 'Kaldırılamadı'); }
    finally { setMesgul(null); }
  };

  const eksik = sirlar?.filter((s) => !s.tanimli).length ?? 0;

  return (
    <>
      <h1>Entegrasyonlar</h1>
      <p className="altbaslik">
        Buradan değiştirilen anahtar <b>şifreli</b> saklanıyor ve en geç 15 saniyede geçerli oluyor.
        Değiştirilmeyenler sunucudaki <code>.env</code> dosyasından geliyor. Değer bir daha
        <b>geri okunamıyor</b> — yalnız maskeli ipucu görünüyor.
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
              <span className={`rozet ${KAYNAK[s.kaynak].sinif}`}>{KAYNAK[s.kaynak].ad}</span>
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

            {duzenlenen === s.key ? (
              <div className="arac" style={{ margin: '10px 0 0' }}>
                {/* `password` tipi: omuz üstünden okunmasın ve tarayıcı
                    geçmişine/otomatik doldurmaya düşmesin. */}
                <input type="password" autoFocus placeholder="Yeni değeri yapıştırın"
                  value={taslak} onChange={(e) => setTaslak(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void kaydet(s); }} />
                <button type="button" disabled={!taslak.trim() || mesgul === s.key} onClick={() => void kaydet(s)}>
                  {mesgul === s.key ? 'Kaydediliyor…' : 'Kaydet'}
                </button>
                <button type="button" onClick={() => { setDuzenlenen(null); setTaslak(''); }}>Vazgeç</button>
              </div>
            ) : null}

            <div className="arac" style={{ margin: '10px 0 0' }}>
              {duzenlenen !== s.key && (
                <button type="button" onClick={() => { setDuzenlenen(s.key); setTaslak(''); }}>
                  {s.tanimli ? 'Değiştir' : 'Tanımla'}
                </button>
              )}
              {s.kaynak === 'panel' && duzenlenen !== s.key && (
                <button type="button" disabled={mesgul === s.key} onClick={() => void paneldenKaldir(s)}>
                  Panelden kaldır
                </button>
              )}
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
