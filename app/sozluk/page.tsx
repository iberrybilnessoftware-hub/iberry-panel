'use client';

import { useState } from 'react';

/**
 * Hata Sözlüğü — "bu kodu gördüm, ne yapmalıyım".
 *
 * Kodlar merkez API'nin gerçekten döndürdükleri (common/error-codes.ts ve
 * servislerdeki fırlatmalar). Uydurma kod YOK: burada yazan bir şey
 * gerçekte olmuyorsa sözlük güvenilirliğini kaybeder ve kimse bakmaz.
 *
 * Her madde aynı dört soruya cevap veriyor: ne demek, ne tetikler, nereye
 * bakılır, nasıl çözülür. "Bir hata oluştu" demenin faydası yok.
 */

interface Madde {
  kod: string;
  durum: number | string;
  ozet: string;
  tetik: string;
  bakilacak: string;
  cozum: string;
  grup: string;
}

const SOZLUK: Madde[] = [
  {
    kod: 'LOCATION_UNKNOWN', durum: 403, grup: 'Konum',
    ozet: 'İsteğin geldiği ağ kayıtlı konumlardan hiçbiriyle eşleşmedi.',
    tetik: 'Konum kapısı AÇIK (LOCATION_ENFORCEMENT=on) ve istemcinin IP adresi hiçbir kayıtlı CIDR bloğuna girmiyor. Mobil veriye düşen telefon, misafir ağı ya da IP değişikliği.',
    bakilacak: 'Sistem Durumu → Konum kapısı. Yönetim → Konumlar ekranında "sizi şu adresten görüyorum" satırı gerçek adresi veriyor.',
    cozum: 'Adres doğruysa Konumlar ekranından tek tıkla ekleyin. Herkes kilitlendiyse sunucuda LOCATION_ENFORCEMENT=off yapıp API\'yi yeniden başlatın (deploy/KONUM-KURTARMA.md).',
  },
  {
    kod: 'BRANCH_UNKNOWN', durum: 400, grup: 'Konum',
    ozet: 'Hangi mağazada olunduğu belirlenemedi, satış reddedildi.',
    tetik: 'Şube zincirinin üçü de boş: konumun şubesi yok (ya da konum çözülmedi), kullanıcının ev şubesi yok, DEFAULT_BRANCH_CODE tanımsız. Sistem hangi depodan stok düşeceğini bilmiyor.',
    bakilacak: 'Sistem Durumu → Şube belirleme. Başlıktaki mağaza rozeti "VARSAYILAN" mı diyor, hiç mi yok?',
    cozum: 'Kalıcı çözüm: mağazanın adresini Konumlar\'a şubesiyle birlikte ekleyin. Geçici: DEFAULT_BRANCH_CODE ortam değişkenini tanımlayın.',
  },
  {
    kod: 'AGENT_KEY_MISSING', durum: 401, grup: 'Varlık ajanı',
    ozet: 'Ajan isteği x-agent-key başlığı olmadan geldi.',
    tetik: 'Ajan IBERRY_AGENT_KEY olmadan çalıştırılmış ya da başlık bir vekil tarafından düşürülmüş.',
    bakilacak: 'Ajanın çalıştığı makinede ortam değişkeni. `journalctl -u iberry-ajan -f`.',
    cozum: 'IBERRY_AGENT_KEY değerini sunucudaki AGENT_KEY ile aynı yapın.',
  },
  {
    kod: 'AGENT_KEY_INVALID', durum: 401, grup: 'Varlık ajanı',
    ozet: 'Ajan anahtarı sunucudakiyle eşleşmiyor.',
    tetik: 'İki taraftan biri değişmiş; genelde sunucuda anahtar döndürülüp ajanlar güncellenmemiştir.',
    bakilacak: 'Sistem Durumu → Varlık ajanı → AGENT_KEY (uzunluk karşılaştırması ipucu verir).',
    cozum: 'Anahtarı tüm ajanlarda güncelleyin, servisi yeniden başlatın.',
  },
  {
    kod: 'AGENT_KEY_NOT_CONFIGURED', durum: 401, grup: 'Varlık ajanı',
    ozet: 'Sunucuda AGENT_KEY tanımlı değil, uç nokta kapalı.',
    tetik: 'Ortam değişkeni hiç verilmemiş. Boş anahtarla açık bırakmak ağ verisini herkese açardı; bu yüzden kapalı.',
    bakilacak: 'Sistem Durumu → Varlık ajanı.',
    cozum: 'Sunucuda AGENT_KEY tanımlayıp API\'yi yeniden başlatın.',
  },
  {
    kod: 'AUTH_REQUIRED', durum: 401, grup: 'Kimlik',
    ozet: 'Geçerli bir oturum yok.',
    tetik: 'Jeton yok, süresi dolmuş (15 dk) ya da oturum iptal edilmiş. Yenileme jetonu da geçersizse kullanıcı giriş ekranına düşer.',
    bakilacak: 'Bu kod hata akışına KAYDEDİLMİYOR — normal işleyişin parçası ve akışı doldururdu.',
    cozum: 'Beklenen davranış. Sürekli tekrarlıyorsa saat kayması ya da JWT_ACCESS_SECRET değişikliğine bakın.',
  },
  {
    kod: 'PERMISSION_DENIED', durum: 403, grup: 'Kimlik',
    ozet: 'Kimlik doğru ama bu işlem için izin yok.',
    tetik: 'Rolde gereken izin tanımlı değil. Satışta ayrıca: bulunulan şubeden farklı bir şube adına satış oluşturulmaya çalışılmış.',
    bakilacak: 'Denetim Kayıtları\'nda kullanıcının rolü; hata mesajının devamı hangi iznin gerektiğini yazar.',
    cozum: 'Rol ataması yapın. Şube uyuşmazlığında istemcinin gönderdiği branchCode\'u kaldırın — şubeyi sunucu belirliyor.',
  },
  {
    kod: 'STEP_UP_REQUIRED', durum: 403, grup: 'Kimlik',
    ozet: 'İşlem kimliğin yeniden kanıtlanmasını istiyor.',
    tetik: 'Finansal ve kasa işlemleri, ödeme anında ikinci bir doğrulama istiyor.',
    bakilacak: 'İstemcinin adım-yükseltme jetonunu isteğe eklediğinden emin olun.',
    cozum: 'Kullanıcı doğrulamayı tamamlar; jeton kısa ömürlüdür, gecikirse tekrar istenir.',
  },
  {
    kod: 'VALIDATION_ERROR', durum: 400, grup: 'İstek',
    ozet: 'Gönderilen veri beklenen biçimde değil.',
    tetik: 'Eksik alan, yanlış tip, sınır aşımı. Mesajın devamı hangi alan olduğunu yazar.',
    bakilacak: 'Hata Akışı\'nda mesajın tamamı; istemcinin gönderdiği gövde.',
    cozum: 'İstemci tarafını düzeltin. Sunucu doğrulaması bilinçli olarak katı — bozuk veri kabul etmektense reddetmek.',
  },
  {
    kod: 'ENTITY_NOT_FOUND', durum: 404, grup: 'İstek',
    ozet: 'İstenen kayıt yok.',
    tetik: 'Silinmiş kayıt, yanlış id, ya da barkod eşleşmedi. Mesajın devamı hangi varlık olduğunu söyler.',
    bakilacak: 'Hata Akışı\'nda yol ve mesaj. Barkodsa ürün kartında barkod tanımlı mı.',
    cozum: 'Barkod hatalarında ürüne barkod ekleyin; kayıt silinmişse istemcinin önbelleğini tazeleyin.',
  },
  {
    kod: 'VERSION_CONFLICT', durum: 409, grup: 'İstek',
    ozet: 'Kayıt siz okuduktan sonra başkası tarafından değiştirilmiş.',
    tetik: 'İyimser kilitleme: iki kişi aynı kaydı aynı anda düzenledi. Ayrıca benzersiz alan çakışmalarında (aynı e-posta) da dönüyor.',
    bakilacak: 'Denetim Kayıtları\'nda aynı varlığa yakın zamanlı işlemler.',
    cozum: 'İstemci kaydı yeniden okuyup değişikliği tekrar uygulamalı. Veri kaybını önleyen bir koruma, hata değil.',
  },
  {
    kod: 'WRONG_TARGET_WAREHOUSE', durum: 400, grup: 'Stok',
    ozet: 'Transfer beklenen depoya gelmedi.',
    tetik: 'Koli, gönderildiği transferin hedefinden başka bir depoda okutulmuş.',
    bakilacak: 'Transfer kaydının hedef deposu ve okutmanın yapıldığı depo.',
    cozum: 'Doğru depoda okutun ya da transferin hedefini düzeltin.',
  },
  {
    kod: 'RATE_LIMITED', durum: 429, grup: 'Sistem',
    ozet: 'Çok fazla istek gönderildi.',
    tetik: 'Hız sınırı aşıldı. Giriş uçlarında sınır daha dar — kaba kuvvet denemesine karşı.',
    bakilacak: 'Hata Akışı\'nda aynı IP\'den gelen yoğunluk.',
    cozum: 'İstemcide yeniden deneme aralığı koyun. Meşru trafikse RATE_LIMIT_MAX değerini yükseltin.',
  },
  {
    kod: 'INTERNAL_ERROR', durum: 500, grup: 'Sistem',
    ozet: 'Beklenmeyen sunucu hatası.',
    tetik: 'Yakalanmamış bir istisna. Veritabanı bağlantısı, migrasyon eksikliği ya da kod hatası.',
    bakilacak: 'Sunucu günlüğü: `docker logs iberry-central-api-1`. Hata Akışı\'ndaki istek numarasıyla eşleştirin.',
    cozum: 'Yığın izini günlükten okuyun — bu kodun sebebi her seferinde farklıdır, tek bir çözümü yok.',
  },
  {
    kod: 'AI_NOT_CONFIGURED', durum: 400, grup: 'Yapay zekâ',
    ozet: 'Copilot çağrıldı ama sağlayıcı ayarlı değil.',
    tetik: 'ANTHROPIC_API_KEY ya da AI_PROVIDER tanımsız.',
    bakilacak: 'Sistem Durumu → Yapay zekâ.',
    cozum: 'Anahtarı tanımlayıp API\'yi yeniden başlatın.',
  },
  {
    kod: 'AI_UPSTREAM_ERROR', durum: 502, grup: 'Yapay zekâ',
    ozet: 'Sağlayıcıya ulaşıldı ama hata döndü.',
    tetik: 'Kota bitmiş, anahtar geçersiz ya da sağlayıcı geçici olarak erişilemiyor.',
    bakilacak: 'Hata Akışı\'ndaki mesaj sağlayıcının kendi hatasını taşır.',
    cozum: 'Kota ve anahtar geçerliliğini kontrol edin.',
  },
  {
    kod: 'AI_INVALID_RESPONSE', durum: 502, grup: 'Yapay zekâ',
    ozet: 'Sağlayıcı beklenen biçimde cevap vermedi.',
    tetik: 'Model beklenen araç çağrısı yerine serbest metin döndürmüş olabilir.',
    bakilacak: 'AiMessage kayıtları.',
    cozum: 'Genelde geçici. Tekrarlıyorsa model sürümü ve istem şablonu gözden geçirilmeli.',
  },
];

const GRUPLAR = [...new Set(SOZLUK.map((m) => m.grup))];

export default function Sozluk() {
  const [q, setQ] = useState('');
  // Teknik kodlarda Türkçe küçültme kullanılmıyor: 'VALIDATION_ERROR'
  // Türkçe kurallarıyla 'valıdatıon_error' olur ve aranan kelimeyle eşleşmez.
  const aranan = q.trim().toLowerCase();
  const liste = aranan
    ? SOZLUK.filter((m) =>
        m.kod.toLowerCase().includes(aranan)
        || m.ozet.toLowerCase().includes(aranan)
        || m.tetik.toLowerCase().includes(aranan))
    : SOZLUK;

  return (
    <>
      <h1>Hata Sözlüğü</h1>
      <p className="altbaslik">
        Merkez API&apos;nin döndürdüğü kodlar: ne demek, ne tetikler, nereye bakılır, nasıl çözülür.
      </p>

      <div className="arac">
        <input placeholder="kod ya da belirti ara — örn. BRANCH_UNKNOWN" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="sayac">{liste.length} / {SOZLUK.length} madde</span>
      </div>

      {GRUPLAR.map((g) => {
        const grup = liste.filter((m) => m.grup === g);
        if (!grup.length) return null;
        return (
          <section key={g} style={{ marginBottom: 26 }}>
            <h2 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--metin-2)', margin: '0 0 10px' }}>{g}</h2>
            {grup.map((m) => (
              <article key={m.kod} id={m.kod} className="sozluk-madde">
                <h3>
                  {m.kod}
                  <span className="rozet r-sonuk">{m.durum}</span>
                </h3>
                <p>{m.ozet}</p>
                <dl>
                  <dt>Ne tetikler</dt><dd>{m.tetik}</dd>
                  <dt>Nereye bak</dt><dd>{m.bakilacak}</dd>
                  <dt>Nasıl çözülür</dt><dd>{m.cozum}</dd>
                </dl>
              </article>
            ))}
          </section>
        );
      })}

      {liste.length === 0 && <div className="bos">Bu aramaya uyan madde yok.</div>}
    </>
  );
}
