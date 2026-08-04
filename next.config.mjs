/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Panel yalnız iç kullanım: arama motorlarına ve önbelleklere kapalı.
  async headers() {
    return [{ source: '/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] }];
  },
};
export default nextConfig;
