# iBERRY Geliştirici Paneli

Merkez sistemin tanılama ekranı. Tek soruya cevap veriyor: **"bir hata
gördüm, nerede sorun var?"** — sunucuya SSH ile girip log kurcalamadan.

Yönetim konsolundan AYRI bir uygulama ve kasıtlı olarak farklı görünüyor
(koyu, teknik), yanlışlıkla müşteriye gösterilen ekran sanılmasın diye.

## Bölümler

| | Ne işe yarar |
|---|---|
| **Sistem Durumu** | Çalışan ayarlar tek ekranda. Bilinen yanlış yapılandırmaları kendisi söylüyor: kapı açık ama konum yok, varsayılan şube bulunamıyor, ajan anahtarı tanımsız. |
| **Hata Akışı** | Son başarısız istekler: yol, kod, kullanıcı, konum. 5 saniyede bir tazeleniyor. |
| **Hata Sözlüğü** | Her hata kodu: ne demek, ne tetikler, nereye bakılır, nasıl çözülür. |
| **Denetim Kayıtları** | Kim ne zaman neyi değiştirdi. |

Hata Akışı'ndaki kod, sözlükteki maddeye bağlı — `BRANCH_UNKNOWN` görüp
tıklayınca ne yapılacağını okuyorsunuz. Korelasyon numarası da Denetim
Kayıtları'yla eşleşiyor: aynı isteğin neye dokunduğunu görebiliyorsunuz.

## Çalıştırma

```bash
corepack pnpm install
IBERRY_API=http://localhost:3001 corepack pnpm run dev   # http://localhost:3010
```

| Değişken | Varsayılan | Ne işe yarar |
|---|---|---|
| `IBERRY_API` | `http://localhost:3001` | Merkez API adresi |

## Güvenlik

**Kendi kullanıcı yönetimi yok.** Giriş merkez API'ye yapılıyor ve
`audit.view` izni olmayan hiçbir veri göremiyor. Ayrı bir yetki yolu
açmak, korumak istediğimiz sistemde ikinci bir kapı açmak olurdu.

**Sırların değeri hiçbir zaman dönmüyor.** Sistem Durumu yalnız "tanımlı
mı, kaç karakter" diyor. Yanlış yapılandırmayı teşhis etmeye bu yetiyor;
değeri göstermek bu ekranı gören herkese sistemin anahtarlarını vermek
olurdu.

**Vekil dar.** Tarayıcı merkez API'ye doğrudan gitmiyor; `/api/proxy/...`
üzerinden ve yalnız `dev/`, `auth/`, `locations/` önekleri geçiyor. Panel,
API'nin tamamına açılan bir kapı değil.

**Arama motorlarına kapalı** (`X-Robots-Tag: noindex`).

## Bilinmesi gerekenler

**Hata akışı bellekte.** 300 kayıt tutuluyor, sunucu yeniden başlayınca
siliniyor. Tabloya yazmak her hatada bir INSERT demekti; hata fırtınasında
veritabanını da yormak istemedik. Arayüz bu sınırı yazıyor.

**401 kaydedilmiyor.** Jeton süresinin dolması normal işleyişin parçası;
akışı doldurup asıl sorunları görünmez yapardı.

**Sözlükteki kodlar gerçek.** Merkez API'nin döndürdükleriyle sınırlı
(`common/error-codes.ts` ve servislerdeki fırlatmalar). Uydurma kod
eklenmemeli — bir madde gerçekte olmuyorsa sözlük güvenilirliğini kaybeder.
