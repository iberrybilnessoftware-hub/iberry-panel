'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';

/**
 * Çalışma zamanı ayarları — SSH ve yeniden başlatma gerekmeden.
 *
 * BU EKRAN SİSTEMİN DAVRANIŞINI DEĞİŞTİRİYOR, o yüzden her ayarın yanında
 * "ne ters gidebilir" yazıyor ve değişiklik onay istiyor. Sessizce
 * uygulanan bir ayar, sonucunu saatler sonra fark ettiğiniz bir arıza olur.
 */

interface Ayar {
  anahtar: string;
  baslik: string;
  aciklama: string;
  tip: 'secim' | 'metin' | 'sayi';
  secenekler: string[] | null;
  tehlike: string;
  deger: string;
  kaynak: 'veritabani' | 'ortam' | 'varsayilan';
}

const KAYNAK_ETIKET: Record<Ayar['kaynak'], { ad: string; sinif: string }> = {
  veritabani: { ad: 'panelden', sinif: 'r-ok' },
  ortam: { ad: 'ortam değişkeni', sinif: 'r-sonuk' },
  varsayilan: { ad: 'kod varsayılanı', sinif: 'r-sonuk' },
};

export default function Ayarlar() {
  const [ayarlar, setAyarlar] = useState<Ayar[] | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState<string | null>(null);
  const [taslak, setTaslak] = useState<Record<string, string>>({});

  const yukle = useCallback(async () => {
    try {
      const a = await api<Ayar[]>('dev/settings');
      setAyarlar(a);
      setTaslak(Object.fromEntries(a.map((x) => [x.anahtar, x.deger])));
      setHata(null);
    } catch (e) { setHata(e instanceof Error ? e.message : 'Alınamadı'); }
  }, []);

  useEffect(() => { void yukle(); }, [yukle]);

  const kaydet = async (a: Ayar) => {
    const yeni = (taslak[a.anahtar] ?? '').trim();
    if (yeni === a.deger) return;
    if (!confirm(`${a.baslik}\n\n"${a.deger}" → "${yeni}"\n\n${a.tehlike}\n\nUygulansın mı?`)) return;

    setMesgul(a.anahtar); setHata(null);
    try {
      await api(`dev/settings/${a.anahtar}`, { method: 'PUT', body: JSON.stringify({ value: yeni }) });
      await yukle();
    } catch (e) { setHata(e instanceof Error ? e.message : 'Kaydedilemedi'); }
    finally { setMesgul(null); }
  };

  const sifirla = async (a: Ayar) => {
    if (!confirm(`${a.baslik} ayarı panelden kaldırılsın mı?\n\nOrtam değişkenine (ya da kod varsayılanına) geri dönülecek.`)) return;
    setMesgul(a.anahtar);
    try {
      await api(`dev/settings/${a.anahtar}`, { method: 'DELETE' });
      await yukle();
    } catch (e) { setHata(e instanceof Error ? e.message : 'Sıfırlanamadı'); }
    finally { setMesgul(null); }
  };

  return (
    <>
      <h1>Ayarlar</h1>
      <p className="altbaslik">
        Çalışma zamanında değişiyor — sunucuya bağlanmaya ve yeniden başlatmaya gerek yok.
        Değişiklikler ~15 saniye içinde geçerli oluyor ve denetime yazılıyor.
      </p>

      {hata && <div className="hata-kutu">{hata}</div>}
      {ayarlar === null && <div className="bos">Yükleniyor…</div>}

      {ayarlar?.map((a) => (
        <article key={a.anahtar} className="sozluk-madde">
          <h3>
            {a.baslik}
            <span className={`rozet ${KAYNAK_ETIKET[a.kaynak].sinif}`}>{KAYNAK_ETIKET[a.kaynak].ad}</span>
            <code style={{ fontSize: 11, color: 'var(--metin-2)', fontWeight: 400 }}>{a.anahtar}</code>
          </h3>
          <p>{a.aciklama}</p>

          <div className="arac" style={{ margin: '10px 0 0' }}>
            {a.tip === 'secim' ? (
              <select
                value={taslak[a.anahtar] ?? ''}
                onChange={(e) => setTaslak((t) => ({ ...t, [a.anahtar]: e.target.value }))}
              >
                {a.secenekler?.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            ) : (
              <input
                value={taslak[a.anahtar] ?? ''}
                inputMode={a.tip === 'sayi' ? 'numeric' : 'text'}
                onChange={(e) => setTaslak((t) => ({ ...t, [a.anahtar]: e.target.value }))}
              />
            )}
            <button
              type="button"
              disabled={mesgul === a.anahtar || (taslak[a.anahtar] ?? '') === a.deger}
              onClick={() => void kaydet(a)}
            >
              {mesgul === a.anahtar ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
            {a.kaynak === 'veritabani' && (
              <button type="button" disabled={mesgul === a.anahtar} onClick={() => void sifirla(a)}>
                Panelden kaldır
              </button>
            )}
          </div>

          <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--uyari)' }}>
            ⚠ {a.tehlike}
          </p>
        </article>
      ))}

      <p className="altbaslik" style={{ marginTop: 20, fontSize: 12 }}>
        Sıra: <b>panel</b> → ortam değişkeni → kod varsayılanı. Ortam değişkeni yedek olarak
        duruyor; veritabanına hiç erişilemezse sistem yine de ayağa kalkabilsin ve
        kilitlenmede sunucudan açılabilsin diye.
      </p>
    </>
  );
}
