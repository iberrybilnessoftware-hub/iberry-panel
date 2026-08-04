'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, girisYap, jetonAl, jetonSil } from '../lib/api';

const BOLUMLER = [
  { yol: '/', ad: 'Sistem Durumu', ikon: '◉' },
  { yol: '/sql', ad: 'SQL Konsolu', ikon: '⌗' },
  { yol: '/gunluk', ad: 'Sunucu Günlüğü', ikon: '▤' },
  { yol: '/hatalar', ad: 'Hata Akışı', ikon: '⚠' },
  { yol: '/deploy', ad: 'Deploy', ikon: '↑' },
  { yol: '/ayarlar', ad: 'Ayarlar', ikon: '⚙' },
  { yol: '/denetim', ad: 'Denetim Kayıtları', ikon: '☰' },
  { yol: '/sozluk', ad: 'Hata Sözlüğü', ikon: '⌘' },
];

/**
 * Panelin kabuğu ve kapısı.
 *
 * Panelin kendi kullanıcı yönetimi YOK: merkez API'ye giriş yapılıyor ve
 * `audit.view` izni olmayan zaten hiçbir veriyi göremiyor. Ayrı bir yetki
 * yolu açmak, korumak istediğimiz sistemde ikinci bir kapı açmak olurdu.
 */
export function Kabuk({ children }: { children: React.ReactNode }) {
  const yol = usePathname();
  const [girisli, setGirisli] = useState<boolean | null>(null);
  const [kisi, setKisi] = useState<string | null>(null);

  useEffect(() => {
    if (!jetonAl()) { setGirisli(false); return; }
    // Jeton duruyor diye geçerli sayılmaz: süresi dolmuş olabilir.
    api<{ fullName: string }>('auth/me')
      .then((u) => { setKisi(u.fullName); setGirisli(true); })
      .catch(() => { jetonSil(); setGirisli(false); });
  }, []);

  if (girisli === null) return <div className="bos">Yükleniyor…</div>;
  if (!girisli) return <Giris onOldu={(ad) => { setKisi(ad); setGirisli(true); }} />;

  return (
    <div className="kabuk">
      <aside className="yan">
        <div className="marka">
          <b>iBERRY</b>
          <span>geliştirici paneli</span>
        </div>
        <nav>
          {BOLUMLER.map((b) => (
            <Link key={b.yol} href={b.yol} className={yol === b.yol ? 'etkin' : ''}>
              <em>{b.ikon}</em>{b.ad}
            </Link>
          ))}
        </nav>
        <div className="yan-alt">
          {kisi}
          <button type="button" onClick={() => { jetonSil(); location.reload(); }}>Çıkış</button>
        </div>
      </aside>
      <main className="icerik">{children}</main>
    </div>
  );
}

function Giris({ onOldu }: { onOldu: (ad: string) => void }) {
  const [email, setEmail] = useState('');
  const [sifre, setSifre] = useState('');
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, setBekliyor] = useState(false);

  return (
    <div className="giris">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBekliyor(true); setHata(null);
          try {
            const u = await girisYap(email, sifre);
            // İzni olmayan içeri girip her yerde boş ekran görmesin.
            // Panelin izni `platform.manage` — yöneticinin (admin) üstünde.
            // Önce audit.view'a bakıyordu; o izin manager ve auditor
            // rollerinde de var, yani şube müdürü ham SQL çalıştırabiliyordu.
            if (!u.permissions.includes('platform.manage')) {
              jetonSil();
              setHata('Bu hesap platform sahibi değil. Panel platform.manage izni istiyor.');
              return;
            }
            onOldu(u.fullName);
          } catch (err) {
            setHata(err instanceof Error ? err.message : 'Giriş yapılamadı');
          } finally {
            setBekliyor(false);
          }
        }}
      >
        <h1>Geliştirici paneli</h1>
        <p>Merkez hesabınızla girin.</p>
        {hata && <div className="hata-kutu">{hata}</div>}
        <label>
          <span>E-posta</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
        </label>
        <label>
          <span>Şifre</span>
          <input type="password" value={sifre} onChange={(e) => setSifre(e.target.value)} autoComplete="current-password" required />
        </label>
        <button type="submit" disabled={bekliyor}>{bekliyor ? 'Giriliyor…' : 'Giriş'}</button>
      </form>
    </div>
  );
}
