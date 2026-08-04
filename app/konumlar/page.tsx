'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';

/**
 * Konumlar + Wi-Fi kapısı.
 *
 * İKİSİ AYNI EKRANDA, bilerek: kapıyı açmak, konumlar doğru tanımlı
 * değilse herkesi dışarıda bırakıyor. Ayrı ekranlarda olsalardı anahtarı
 * çeviren kişi listeyi görmeden karar verirdi.
 *
 * Bu ekran yönetim konsolundan BURAYA taşındı — sistemi ayakta tutan
 * ayarların hepsi tek yerde olsun diye.
 */

interface Konum {
  id: string; label: string; cidr: string; branchId: string | null;
  isActive: boolean; lastSeenAt: string | null;
  branch: { id: string; code: string; name: string } | null;
}

interface Neredeyim {
  ip: string;
  enforcement: 'on' | 'off';
  matched: { locationId: string; label: string; branchId: string | null } | null;
}

interface Sube { id: string; code: string; name: string; isActive: boolean; konumSayisi: number }

interface Ayar { anahtar: string; deger: string; kaynak: string }

const tarih = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

/**
 * Tek bir adresi kapsayan blok.
 *
 * MASKE ADRES AİLESİNE GÖRE DEĞİŞİYOR. Burada sabit `/32` yazılıydı ve
 * IPv6'da yanlış sonuç veriyordu: `::1/32` tek makine değil, ilk 32 biti
 * eşleşen KOCAMAN bir blok demek. Yerelde `::1/32` diye kaydedilmiş bir
 * satır bu yüzden oluştu. IPv4'te tek host /32, IPv6'da /128.
 */
const tekAdres = (ip: string) => `${ip}/${ip.includes(':') ? 128 : 32}`;

/** Bu kadar süre görülmeyen kayıt için adres değişmiş uyarısı çıkıyor. */
const BAYAT_GUN = 7;

/**
 * "Bu kayıt hâlâ doğru mu?"
 *
 * Adres değişikliği SESSİZ bir arıza: sağlayıcı IP'yi değiştirdiğinde
 * kayıt olduğu gibi duruyor, yalnız artık kimseyle eşleşmiyor. Kapı
 * kapalıysa kimse fark etmiyor — satışlar şubesiz düşmeye başlıyor.
 * `lastSeenAt` bunu görünür kılan tek işaret.
 */
function bayatlik(iso: string | null): string | null {
  if (!iso) return 'hiç görülmedi';
  const gun = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return gun >= BAYAT_GUN ? `${gun} gündür görülmedi` : null;
}

export default function Konumlar() {
  const [konumlar, setKonumlar] = useState<Konum[] | null>(null);
  const [ben, setBen] = useState<Neredeyim | null>(null);
  const [subeler, setSubeler] = useState<Sube[]>([]);
  const [hata, setHata] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState(false);

  const [etiket, setEtiket] = useState('');
  const [cidr, setCidr] = useState('');
  const [sube, setSube] = useState('');
  const [hizliSube, setHizliSube] = useState('');

  /*
   * Satır içi düzenleme.
   *
   * NİYE GEREKLİ: mağazaların adresi sabit değil, sağlayıcı değiştiriyor.
   * Düzenleme olmadan tek yol "sil + yeniden ekle" idi ve bu kapı açıkken
   * TEHLİKELİ: silme ile ekleme arasındaki anda o ağdan kimse giremiyor,
   * yanlış adres yazılırsa da geri dönülemiyor.
   */
  const [duzenlenen, setDuzenlenen] = useState<string | null>(null);
  const [dAd, setDAd] = useState('');
  const [dCidr, setDCidr] = useState('');
  const [dSube, setDSube] = useState('');

  const duzenlemeBaslat = (k: Konum) => {
    setDuzenlenen(k.id);
    setDAd(k.label);
    setDCidr(k.cidr);
    setDSube(k.branchId ?? '');
    setHata(null);
  };

  /*
   * Üçü birlikte tazeleniyor: her konum değişikliği şubenin bağlı ağ
   * sayısını da değiştiriyor, ayrı yüklenselerdi "adres bekliyor" rozeti
   * ekleme sonrası kırmızı kalırdı.
   *
   * ŞUBE LİSTESİ ÖNCEDEN SQL KONSOLUNDAN geliyordu; canlıda konsol kapalı
   * (DATABASE_URL_RO tanımsız) olduğu için liste sessizce yedeğe düşüyor,
   * yalnız ZATEN bir konuma bağlı şubeler görünüyordu. Yeni açılan şube
   * listede çıkmıyor, konum bağlanmadan da çıkamıyordu — kısır döngü.
   *
   * `/dev/branches` panelin tek yetkisiyle (`platform.manage`) çalışıyor;
   * `/branches` ucu `branch.view` isteseydi panel ikinci bir yetkiye
   * bağlanırdı.
   */
  const yukle = useCallback(async () => {
    try {
      const [k, b, s] = await Promise.all([
        api<Konum[]>('locations'),
        api<Neredeyim>('locations/whoami'),
        api<Sube[]>('dev/branches'),
      ]);
      setKonumlar(k); setBen(b); setSubeler(s); setHata(null);
    } catch (e) { setHata(e instanceof Error ? e.message : 'Alınamadı'); }
  }, []);

  useEffect(() => { void yukle(); }, [yukle]);

  const kapiDegistir = async (yeni: 'on' | 'off') => {
    // KİLİTLENME KORUMASI: kapıyı açarken şu anki adres eşleşmiyorsa, bu
    // ekrana bir daha ulaşamazsınız. Sunucuya girip ortam değişkeni
    // kapatmaktan başka yol kalmaz.
    if (yeni === 'on' && !ben?.matched) {
      if (!confirm(
        `DİKKAT: şu an bulunduğunuz adres (${ben?.ip}) hiçbir konumla eşleşmiyor.\n\n`
        + 'Kapıyı açarsanız bu ağdan kimse giriş yapamaz ve bu ekrana ulaşamazsınız.\n'
        + 'Kurtarmak için sunucuda LOCATION_ENFORCEMENT=off yapmak gerekir.\n\n'
        + 'Yine de açılsın mı?',
      )) return;
    }
    setMesgul(true);
    try {
      await api('dev/settings/LOCATION_ENFORCEMENT', { method: 'PUT', body: JSON.stringify({ value: yeni }) });
      // Ayar 15 sn önbellekli; hemen sorarsak eski değeri görürüz.
      setTimeout(() => void yukle(), 1200);
      setBen((b) => (b ? { ...b, enforcement: yeni } : b));
    } catch (e) { setHata(e instanceof Error ? e.message : 'Değiştirilemedi'); }
    finally { setMesgul(false); }
  };

  const ekle = async (adres: string, ad: string, subeId: string) => {
    if (!adres.trim() || !ad.trim()) { setHata('Ad ve adres zorunlu'); return; }
    setMesgul(true);
    try {
      await api('locations', {
        method: 'POST',
        body: JSON.stringify({ label: ad.trim(), cidr: adres.trim(), branchId: subeId || null }),
      });
      setEtiket(''); setCidr(''); setSube('');
      await yukle();
    } catch (e) { setHata(e instanceof Error ? e.message : 'Eklenemedi'); }
    finally { setMesgul(false); }
  };

  const degistir = async (k: Konum, alan: Partial<Konum>) => {
    if (ben?.matched?.locationId === k.id && ben.enforcement === 'on' && alan.isActive === false) {
      if (!confirm(`"${k.label}" şu an SİZİN bağlandığınız kayıt ve kapı açık.\nKapatırsanız bu ağdan kimse giriş yapamaz.\n\nYine de kapatılsın mı?`)) return;
    }
    setMesgul(true);
    try { await api(`locations/${k.id}`, { method: 'PATCH', body: JSON.stringify(alan) }); await yukle(); }
    catch (e) { setHata(e instanceof Error ? e.message : 'Güncellenemedi'); }
    finally { setMesgul(false); }
  };

  /**
   * Düzenlemeyi kaydeder.
   *
   * KİLİTLENME UYARISI yalnız GERÇEKTEN riskli durumda çıkıyor: şu an bu
   * kayıt üzerinden bağlıysanız, kapı açıksa ve adresi değiştiriyorsanız.
   * Adresi değişmiş bir mağazada duruyorsanız zaten hiçbir kayda
   * eşleşmiyorsunuz (`matched` boş), dolayısıyla kaydı kendi adresinize
   * çekmek erişiminizi yalnız İYİLEŞTİREBİLİR — orada uyarı gürültü olurdu.
   */
  const duzenlemeKaydet = async (k: Konum) => {
    const yeniCidr = dCidr.trim();
    const yeniAd = dAd.trim();
    if (!yeniAd || !yeniCidr) { setHata('Ad ve adres boş olamaz'); return; }

    if (ben?.matched?.locationId === k.id && ben.enforcement === 'on' && yeniCidr !== k.cidr) {
      if (!confirm(
        `"${k.label}" şu an SİZİN bağlandığınız kayıt ve kapı açık.\n\n`
        + `Adres ${k.cidr} → ${yeniCidr} olarak değişecek. Yeni adres sizi kapsamıyorsa `
        + 'bu ağdan kimse giriş yapamaz ve bu ekrana ulaşamazsınız.\n\nDevam edilsin mi?',
      )) return;
    }

    setMesgul(true);
    try {
      await api(`locations/${k.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ label: yeniAd, cidr: yeniCidr, branchId: dSube || null }),
      });
      setDuzenlenen(null);
      await yukle();
    } catch (e) { setHata(e instanceof Error ? e.message : 'Güncellenemedi'); }
    finally { setMesgul(false); }
  };

  const sil = async (k: Konum) => {
    const kendimiz = ben?.matched?.locationId === k.id;
    if (!confirm(kendimiz && ben?.enforcement === 'on'
      ? `"${k.label}" şu an SİZİN bağlandığınız kayıt ve kapı açık. Silerseniz bu ağdan kimse giriş yapamaz.\n\nSilinsin mi?`
      : `"${k.label}" silinsin mi?`)) return;
    setMesgul(true);
    try { await api(`locations/${k.id}`, { method: 'DELETE' }); await yukle(); }
    catch (e) { setHata(e instanceof Error ? e.message : 'Silinemedi'); }
    finally { setMesgul(false); }
  };

  const buAdresKayitli = konumlar?.some((k) => k.cidr === tekAdres(ben?.ip ?? '') || k.cidr === ben?.ip);

  return (
    <>
      <h1>Konumlar</h1>
      <p className="altbaslik">Hangi ağdan bağlanan hangi mağazada sayılıyor — ve Wi-Fi kapısı.</p>

      {hata && <div className="hata-kutu">{hata}</div>}

      {ben && (
        <div className="kart" style={{ marginBottom: 16 }}>
          <h2>Wi-Fi kapısı</h2>
          <div className="satir">
            <span>Durum</span>
            <span>
              {ben.enforcement === 'on'
                ? <span className="rozet r-ok">AÇIK — tanınmayan ağdan giriş yok</span>
                : <span className="rozet r-sonuk">KAPALI — engelleme yok, yalnız şube belirleniyor</span>}
            </span>
          </div>
          <div className="satir">
            <span>Sizi şu adresten görüyorum</span>
            <span>
              <code>{ben.ip}</code>{' '}
              {ben.matched
                ? <span className="rozet r-ok">{ben.matched.label}</span>
                : <span className="rozet r-hata">kayıtlı değil</span>}
            </span>
          </div>
          <div className="arac" style={{ margin: '12px 0 0' }}>
            <button type="button" disabled={mesgul || ben.enforcement === 'on'} onClick={() => void kapiDegistir('on')}>
              Kapıyı aç (engellemeyi başlat)
            </button>
            <button type="button" disabled={mesgul || ben.enforcement === 'off'} onClick={() => void kapiDegistir('off')}>
              Kapıyı kapat
            </button>
          </div>
          {ben.enforcement === 'off' && (
            <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--metin-2)' }}>
              Kapı kapalıyken konum kayıtları yine de çalışıyor: hangi mağazada olduğunuzu,
              dolayısıyla satışın hangi stoktan düşeceğini belirliyorlar. Kapatmak yalnız
              <b> giriş engellemesini</b> kaldırıyor.
            </p>
          )}
        </div>
      )}

      {ben && !buAdresKayitli && (
        <div className="uyari-kutu">
          <b>Bu adresi kaydet</b> — bulunduğunuz ağı bir mağazaya bağlayın. IP yazmanıza gerek yok.
          <div className="arac" style={{ margin: '10px 0 0' }}>
            <select value={hizliSube} onChange={(e) => setHizliSube(e.target.value)}>
              <option value="">Merkez / ofis (şubesiz)</option>
              {subeler.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <button
              type="button"
              disabled={mesgul}
              onClick={() => void ekle(tekAdres(ben.ip), subeler.find((s) => s.id === hizliSube)?.name ?? 'Ofis', hizliSube)}
            >
              {ben.ip} adresini ekle
            </button>
          </div>
        </div>
      )}

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--metin-2)', margin: '0 0 10px' }}>
          Kayıtlı konumlar ({konumlar?.length ?? 0})
        </h2>
        {konumlar?.length === 0 && (
          <div className="bos">
            Hiç konum tanımlı değil.<br />
            <span className="sonuk">Kapıyı açarsanız kimse giriş yapamaz.</span>
          </div>
        )}
        {!!konumlar?.length && (
          <div className="tablo-sar">
            <table>
              <thead><tr><th>Ad</th><th>Adres</th><th>Mağaza</th><th>Son görülme</th><th /></tr></thead>
              <tbody>
                {konumlar.map((k) => (duzenlenen === k.id ? (
                  <tr key={k.id}>
                    <td><input value={dAd} onChange={(e) => setDAd(e.target.value)} style={{ width: '100%' }} /></td>
                    <td>
                      <input className="mono" value={dCidr} onChange={(e) => setDCidr(e.target.value)} style={{ width: '100%' }} />
                      {/*
                        Asıl işlem bu: mağazadasınız, adres değişmiş, tek tıkla
                        şu anki adresi alıyorsunuz. Doldurur, kaydetmez —
                        Kaydet'e basmadan hiçbir şey değişmiyor.
                      */}
                      {ben && dCidr !== tekAdres(ben.ip) && (
                        <button type="button" className="mini" style={{ marginTop: 4 }} onClick={() => setDCidr(tekAdres(ben.ip))}>
                          şu anki adresi kullan ({ben.ip})
                        </button>
                      )}
                    </td>
                    <td>
                      <select value={dSube} onChange={(e) => setDSube(e.target.value)} style={{ width: '100%' }}>
                        <option value="">Merkez / ofis (şubesiz)</option>
                        {subeler.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </td>
                    <td className="mono sonuk">{tarih(k.lastSeenAt)}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button type="button" className="mini" disabled={mesgul} onClick={() => void duzenlemeKaydet(k)}>Kaydet</button>
                      <button type="button" className="mini" disabled={mesgul} onClick={() => setDuzenlenen(null)}>Vazgeç</button>
                    </td>
                  </tr>
                ) : (
                  <tr key={k.id} style={{ opacity: k.isActive ? 1 : 0.5 }}>
                    <td>
                      {k.label}
                      {ben?.matched?.locationId === k.id && <span className="rozet r-ok" style={{ marginLeft: 8 }}>buradasınız</span>}
                    </td>
                    <td className="mono">{k.cidr}</td>
                    <td>{k.branch ? k.branch.name : <span className="sonuk">merkez / ofis</span>}</td>
                    <td className="mono sonuk">
                      {tarih(k.lastSeenAt)}
                      {k.isActive && bayatlik(k.lastSeenAt) && (
                        <div>
                          <span className="rozet r-uyari" title="Sağlayıcı adresi değiştirmiş olabilir — Düzenle ile güncelleyin">
                            {bayatlik(k.lastSeenAt)}
                          </span>
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button type="button" className="mini" disabled={mesgul} onClick={() => duzenlemeBaslat(k)}>Düzenle</button>
                      <button type="button" className="mini" disabled={mesgul} onClick={() => void degistir(k, { isActive: !k.isActive })}>
                        {k.isActive ? 'Kapat' : 'Aç'}
                      </button>
                      <button type="button" className="mini sil" disabled={mesgul} onClick={() => void sil(k)}>Sil</button>
                    </td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/*
        Şubeler — Central'da açılanlar burada görünür ve adres bekleyenler
        işaretlenir. Şube açmak Central'ın işi, adres vermek panelin işi;
        bu liste ikisi arasındaki devir teslim noktası.
      */}
      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--metin-2)', margin: '0 0 10px' }}>
          Şubeler ({subeler.length})
        </h2>
        {subeler.length === 0 ? (
          <div className="bos">Şube listesi alınamadı.</div>
        ) : (
          <div className="tablo-sar">
            <table>
              <thead><tr><th>Şube</th><th>Kod</th><th>Bağlı ağ</th><th /></tr></thead>
              <tbody>
                {subeler.map((s) => (
                  <tr key={s.id} style={{ opacity: s.isActive ? 1 : 0.5 }}>
                    <td>
                      {s.name}
                      {!s.isActive && <span className="rozet r-sonuk" style={{ marginLeft: 8 }}>kapalı</span>}
                    </td>
                    <td className="mono sonuk">{s.code}</td>
                    <td>
                      {s.konumSayisi > 0
                        ? <span className="rozet r-ok">{s.konumSayisi} ağ</span>
                        : <span className="rozet r-hata">adres bekliyor</span>}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {s.konumSayisi === 0 && ben && !buAdresKayitli && (
                        <button
                          type="button"
                          className="mini"
                          disabled={mesgul}
                          title={`Şu an bulunduğunuz ${ben.ip} adresini bu şubeye bağla`}
                          onClick={() => void ekle(tekAdres(ben.ip), s.name, s.id)}
                        >
                          Buradaki adresi bağla
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="altbaslik" style={{ fontSize: 12, marginTop: 8 }}>
          Ağı olmayan şubede satış o şubeye yazılmaz — kasiyerin hangi mağazada
          olduğu bu adreslerden çözülüyor. Şube açma/kapama Central&apos;da
          (Yönetim → Ayarlar → Şubeler).
        </p>
      </section>

      <section>
        <h2 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--metin-2)', margin: '0 0 10px' }}>
          Elle ekle
        </h2>
        <p className="altbaslik" style={{ fontSize: 12.5 }}>
          Tek adres için <code>88.230.14.7</code>, blok için <code>88.230.14.0/24</code>.
          Sistem mağazanın <b>dış</b> adresine bakıyor — <code>192.168.x.x</code> yazmanın faydası yok,
          o adres her mağazada aynı.
        </p>
        <div className="arac">
          <input placeholder="Ad — örn. Ümraniye" value={etiket} onChange={(e) => setEtiket(e.target.value)} />
          <input placeholder="Adres ya da blok" value={cidr} onChange={(e) => setCidr(e.target.value)} />
          <select value={sube} onChange={(e) => setSube(e.target.value)}>
            <option value="">Merkez / ofis (şubesiz)</option>
            {subeler.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button type="button" disabled={mesgul} onClick={() => void ekle(cidr, etiket, sube)}>Ekle</button>
        </div>
      </section>

      <p className="altbaslik" style={{ marginTop: 20, fontSize: 12 }}>
        Değişiklikler ~30 saniye içinde geçerli oluyor — sunucu konum listesini kısa süre önbellekliyor.
      </p>
    </>
  );
}
