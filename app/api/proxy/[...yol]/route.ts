import { NextRequest } from 'next/server';

/**
 * Merkez API'ye vekil.
 *
 * NİYE VEKİL: tarayıcı doğrudan merkez API'ye gitseydi, bu paneli her
 * ortamda CORS listesine eklemek gerekirdi — yeni bir alan adı her
 * açıldığında sunucu ayarı değişecekti. Vekil sunucu tarafında çalıştığı
 * için CORS hiç devreye girmiyor.
 *
 * Jetonu İSTEMCİDEN alıp geçiriyoruz; panel kendi kimlik deposunu
 * kurmuyor, merkez API neye izin veriyorsa o geçerli. Yani panelde ekstra
 * bir yetki yolu yok: `audit.view` izniniz yoksa buradan da göremezsiniz.
 */

const API = process.env.IBERRY_API ?? 'http://localhost:3001';

/**
 * Yalnız bu alanlar geçiyor — panel API'nin tamamına açık bir kapı olmasın.
 *
 * İLK SEGMENTE bakılıyor, önek metnine değil. Önce `['dev/', 'auth/',
 * 'locations/']` diye yazmıştım ve liste ucu (`locations`, eğik çizgisiz)
 * hiçbir önekle eşleşmediği için reddediliyordu. Segment karşılaştırması
 * bu tuzağı tamamen kaldırıyor.
 */
const IZINLI = new Set(['dev', 'auth', 'locations']);

async function gecir(req: NextRequest, yol: string[]) {
  const path = yol.join('/');
  if (!IZINLI.has(yol[0] ?? '')) {
    return Response.json({ error: { message: `Bu yol vekilden geçmiyor: ${path}` } }, { status: 403 });
  }

  const url = new URL(`${API}/api/${path}`);
  req.nextUrl.searchParams.forEach((v, k) => url.searchParams.set(k, v));

  const auth = req.headers.get('authorization');
  const govde = req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.text();

  try {
    /*
     * GERÇEK İSTEMCİ ADRESİNİ TAŞI.
     *
     * Vekil sunucu tarafında çalıştığı için merkez API, isteği panelin
     * adresinden (Docker köprüsü) geliyor sanıyordu. Konum eşleşmesi bu
     * yüzden hep başarısızdı: kullanıcı kayıtlı bir ağdan bağlansa bile
     * "tanınmayan ağ" hatası alıyordu.
     *
     * Zinciri Caddy kuruyor, biz yalnız devam ettiriyoruz. Tarayıcının
     * iddiasına değil, Caddy'nin yazdığına güveniliyor.
     */
    const gercekIp = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip');

    const res = await fetch(url, {
      method: req.method,
      headers: {
        'content-type': 'application/json',
        ...(auth ? { authorization: auth } : {}),
        ...(gercekIp ? { 'x-forwarded-for': gercekIp } : {}),
      },
      body: govde,
      cache: 'no-store',
    });
    const metin = await res.text();
    return new Response(metin, {
      status: res.status,
      headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
    });
  } catch (e) {
    // Merkez API kapalıysa bunu açıkça söylemek gerekiyor: panelin işi zaten
    // "neden çalışmıyor"u anlatmak, burada sessiz kalmak ironik olurdu.
    return Response.json(
      { error: { message: `Merkez API'ye ulaşılamıyor (${API}): ${(e as Error).message}` } },
      { status: 502 },
    );
  }
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ yol: string[] }> }) {
  return gecir(req, (await ctx.params).yol);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ yol: string[] }> }) {
  return gecir(req, (await ctx.params).yol);
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ yol: string[] }> }) {
  return gecir(req, (await ctx.params).yol);
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ yol: string[] }> }) {
  return gecir(req, (await ctx.params).yol);
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ yol: string[] }> }) {
  return gecir(req, (await ctx.params).yol);
}
