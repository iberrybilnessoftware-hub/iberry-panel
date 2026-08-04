'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from './lib/api';

/**
 * Sistem Durumu — "bu kurulumda neler açık, neler eksik".
 *
 * Ekranın asıl değeri listelemek değil, YANLIŞI SÖYLEMESİ. Sunucu zaten
 * bilinen yanlış yapılandırmaları tespit edip `uyari` alanlarıyla
 * gönderiyor; burası onları en üste, göze batacak şekilde koyuyor.
 */

interface Durum {
  surum: { node: string; ortam: string; calismaSuresiSn: number; baslangic: string };
  konum: {
    kapi: 'on' | 'off';
    uyari: string | null;
    kayitliKonumlar: Array<{ cidr: string; etiket: string; sube: string | null; sonGorulme: string | null }>;
  };
  sube: { varsayilanKod: string | null; varsayilanBulundu: boolean | null; uyari: string | null; subeler: string[] };
  varlik: {
    ajanAnahtari: { tanimli: boolean; uzunluk: number };
    uyari: string | null;
    kayitliCihaz: number;
    sonBildirim: string | null;
    canliEsikMs: number;
    bosluEsikMs: number;
  };
  ai: { saglayici: string | null; model: string | null; anahtar: { tanimli: boolean; uzunluk: number } };
  entegrasyon: { apiAnahtari: { tanimli: boolean; uzunluk: number }; b2bWebhook: string | null };
  hataAkisi: { adet: number; kapasite: number; enEski: string | null };
}

const sure = (sn: number) => {
  if (sn < 60) return `${sn} sn`;
  if (sn < 3600) return `${Math.floor(sn / 60)} dk`;
  if (sn < 86400) return `${Math.floor(sn / 3600)} sa ${Math.floor((sn % 3600) / 60)} dk`;
  return `${Math.floor(sn / 86400)} gün`;
};

const zaman = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

const Var = ({ v }: { v: { tanimli: boolean; uzunluk: number } }) =>
  v.tanimli
    ? <span className="rozet r-ok">tanımlı · {v.uzunluk} karakter</span>
    : <span className="rozet r-hata">tanımsız</span>;

export default function SistemDurumu() {
  const [d, setD] = useState<Durum | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  const yukle = useCallback(async () => {
    try { setD(await api<Durum>('dev/system')); setHata(null); }
    catch (e) { setHata(e instanceof Error ? e.message : 'Alınamadı'); }
  }, []);

  useEffect(() => { void yukle(); }, [yukle]);

  if (hata) return <><h1>Sistem Durumu</h1><div className="hata-kutu">{hata}</div></>;
  if (!d) return <div className="bos">Yükleniyor…</div>;

  const uyarilar = [d.konum.uyari, d.sube.uyari, d.varlik.uyari].filter(Boolean) as string[];

  return (
    <>
      <h1>Sistem Durumu</h1>
      <p className="altbaslik">Çalışan kurulumun ayarları ve bilinen yanlış yapılandırmalar</p>

      {uyarilar.length > 0
        ? uyarilar.map((u) => <div key={u} className="uyari-kutu"><b>Dikkat:</b> {u}</div>)
        : <div className="uyari-kutu" style={{ borderColor: 'color-mix(in srgb, var(--ok) 55%, transparent)', background: 'color-mix(in srgb, var(--ok) 8%, transparent)' }}>
            Bilinen bir yapılandırma sorunu yok.
          </div>}

      <div className="arac">
        <button type="button" onClick={() => void yukle()}>Yenile</button>
        <span className="sayac">
          {d.surum.ortam} · Node {d.surum.node} · {sure(d.surum.calismaSuresiSn)} ayakta
        </span>
      </div>

      <div className="izgara">
        <section className="kart">
          <h2>Konum kapısı</h2>
          <div className="satir">
            <span>Durum</span>
            <span>{d.konum.kapi === 'on'
              ? <span className="rozet r-ok">açık — engelliyor</span>
              : <span className="rozet r-sonuk">kapalı — gözlem</span>}</span>
          </div>
          <div className="satir"><span>Kayıtlı konum</span><span>{d.konum.kayitliKonumlar.length}</span></div>
          {d.konum.kayitliKonumlar.map((k) => (
            <div className="satir" key={k.cidr}>
              <span>{k.etiket}</span>
              <span>{k.cidr} → {k.sube ?? 'merkez'}</span>
            </div>
          ))}
        </section>

        <section className="kart">
          <h2>Şube belirleme</h2>
          <div className="satir">
            <span>Varsayılan şube</span>
            <span>{d.sube.varsayilanKod
              ? (d.sube.varsayilanBulundu
                ? <span className="rozet r-uyari">{d.sube.varsayilanKod}</span>
                : <span className="rozet r-hata">{d.sube.varsayilanKod} — yok</span>)
              : <span className="rozet r-sonuk">tanımsız</span>}</span>
          </div>
          <div className="satir"><span>Tanımlı şubeler</span><span>{d.sube.subeler.join(', ') || '—'}</span></div>
          <div className="satir">
            <span>Sıra</span>
            <span className="sonuk">konum → jeton → varsayılan</span>
          </div>
        </section>

        <section className="kart">
          <h2>Varlık ajanı</h2>
          <div className="satir"><span>AGENT_KEY</span><span><Var v={d.varlik.ajanAnahtari} /></span></div>
          <div className="satir"><span>Kayıtlı cihaz</span><span>{d.varlik.kayitliCihaz}</span></div>
          <div className="satir"><span>Son bildirim</span><span>{zaman(d.varlik.sonBildirim)}</span></div>
          <div className="satir"><span>Ağda sayılma</span><span>{Math.round(d.varlik.canliEsikMs / 1000)} sn</span></div>
          <div className="satir"><span>Mesai boşluğu</span><span>{Math.round(d.varlik.bosluEsikMs / 60000)} dk</span></div>
        </section>

        <section className="kart">
          <h2>Yapay zekâ</h2>
          <div className="satir"><span>Sağlayıcı</span><span>{d.ai.saglayici ?? '—'}</span></div>
          <div className="satir"><span>Model</span><span>{d.ai.model ?? '—'}</span></div>
          <div className="satir"><span>API anahtarı</span><span><Var v={d.ai.anahtar} /></span></div>
        </section>

        <section className="kart">
          <h2>Entegrasyon</h2>
          <div className="satir"><span>API anahtarı</span><span><Var v={d.entegrasyon.apiAnahtari} /></span></div>
          <div className="satir"><span>B2B webhook</span><span>{d.entegrasyon.b2bWebhook ?? '—'}</span></div>
        </section>

        <section className="kart">
          <h2>Hata akışı</h2>
          <div className="satir"><span>Tampondaki kayıt</span><span>{d.hataAkisi.adet} / {d.hataAkisi.kapasite}</span></div>
          <div className="satir"><span>En eski</span><span>{zaman(d.hataAkisi.enEski)}</span></div>
          <div className="satir">
            <span>Kalıcılık</span>
            <span className="sonuk">bellekte — sunucu yeniden başlayınca siliniyor</span>
          </div>
        </section>
      </div>
    </>
  );
}
