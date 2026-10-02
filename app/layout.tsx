import type { Metadata } from 'next';
import { Kabuk } from './components/Kabuk';
import './theme/apple-tokens.css';
import './globals.css';
import './theme/apple-theme.css';

export const metadata: Metadata = {
  title: 'iBERRY · Geliştirici Paneli',
  description: 'Sistem durumu, hata akışı ve denetim kayıtları',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" data-theme="apple-web-20261002">
      <body><Kabuk>{children}</Kabuk></body>
    </html>
  );
}
