/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /*
   * Sunucuya taşınacak kendi kendine yeten çıktı.
   *
   * Panel statik değil: /api/proxy rotası sunucu tarafında çalışıyor (GitHub
   * jetonu ve merkez API adresi tarayıcıya inmesin diye). Bu yüzden yönetim
   * konsolu gibi dosya kopyalayıp bırakamıyoruz, çalışan bir süreç gerekiyor.
   * `standalone`, node_modules'ü de içine katarak tek klasör üretiyor.
   */
  output: 'standalone',
  /*
   * Dosya izini bu klasörle sınırla.
   *
   * Aksi hâlde Next yukarı doğru yürüyüp (üstteki klasörlerde lockfile
   * arıyor) çıktıyı `standalone/Desktop/IBERRY-repos/dev-console/...`
   * diye iç içe üretiyor; systemd'nin çalıştıracağı yol tahmin edilemez
   * hâle geliyor.
   */
  outputFileTracingRoot: import.meta.dirname,
  /*
   * Üretim derlemesi AYRI klasöre yazıyor.
   *
   * Varsayılanda `next build` ve `next dev` aynı `.next` klasörünü
   * kullanıyor; dev sunucusu ayaktayken derleme yapılınca dev'in parça
   * dosyaları eziliyor ve her sayfa 'Cannot find module ./705.js' ile
   * 500 dönüyor. Bir kez başımıza geldi.
   */
  distDir: process.env.NODE_ENV === 'production' ? '.next-build' : '.next',
  // Panel yalnız iç kullanım: arama motorlarına ve önbelleklere kapalı.
  async headers() {
    return [{ source: '/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] }];
  },
};
export default nextConfig;
