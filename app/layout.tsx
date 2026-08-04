import type { Metadata } from 'next';
import { Kabuk } from './components/Kabuk';
import './globals.css';

export const metadata: Metadata = {
  title: 'iBERRY · Geliştirici Paneli',
  description: 'Sistem durumu, hata akışı ve denetim kayıtları',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body><Kabuk>{children}</Kabuk></body>
    </html>
  );
}
