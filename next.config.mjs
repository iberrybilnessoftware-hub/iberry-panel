/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
