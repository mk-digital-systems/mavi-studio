import { CHANNELS } from "../audio/broadcast/desk";
import { updateSettings, useSettings, defaultBroadcast, type BroadcastSettings as BS } from "../shared/settings";
import { PageHeader } from "./parts";

/** Yayın Ayarları: ses masasının varsayılanları. Yayın hedefi (OBS, TikTok LIVE Studio…) bu sürümde bağlanmaz. */
export function BroadcastSettings() {
  const b = useSettings().broadcast;
  const set = (fn: (x: BS) => BS) => updateSettings((s) => ({ ...s, broadcast: fn(s.broadcast) }));
  return (
    <>
      <PageHeader title="Yayın Ayarları" sub="Yayın Stüdyosu · ses masası varsayılanları" />
      <div className="note" role="note">Ses, bilgisayarının normal ses çıkışına gider. TikTok LIVE Studio, OBS, sanal ses kablosu ve harici ses kartı bağlantıları sonraki sürümlerde eklenecek; yayın kaydı da şimdilik yok.</div>
      <section className="card sec" aria-labelledby="bs-v">
        <h2 id="bs-v">Kanal başlangıç seviyeleri</h2>
        <div className="sliders">
          {CHANNELS.map((c) => (
            <div key={c.id}>
              <label htmlFor={"bs-" + c.id}>{c.label}: <b>{Math.round(b.volumes[c.id] * 100)}%</b></label>
              <input id={"bs-" + c.id} type="range" min={0} max={100} value={Math.round(b.volumes[c.id] * 100)} onChange={(e) => set((x) => ({ ...x, volumes: { ...x.volumes, [c.id]: +e.target.value / 100 } }))} />
            </div>
          ))}
        </div>
        <button className="btn ghost" onClick={() => set((x) => ({ ...x, volumes: defaultBroadcast().volumes }))}>Varsayılanlara dön</button>
      </section>
      <section className="card sec" aria-labelledby="bs-d">
        <h2 id="bs-d">Konuşma önceliği</h2>
        <label className="row chk"><input type="checkbox" checked={b.duck.enabled} onChange={(e) => set((x) => ({ ...x, duck: { ...x.duck, enabled: e.target.checked } }))} /> Mikrofon veya kayıtlı şiir konuşurken fon müziğini otomatik kıs</label>
        <div className="sliders">
          <div><label htmlFor="bs-da">Kısma miktarı: <b>{b.duck.amountDb} dB</b></label><input id="bs-da" type="range" min={0} max={30} value={b.duck.amountDb} onChange={(e) => set((x) => ({ ...x, duck: { ...x.duck, amountDb: +e.target.value } }))} /></div>
          <div><label htmlFor="bs-dt">Konuşma eşiği: <b>{b.duck.thresholdDb} dB</b></label><input id="bs-dt" type="range" min={-70} max={-15} value={b.duck.thresholdDb} onChange={(e) => set((x) => ({ ...x, duck: { ...x.duck, thresholdDb: +e.target.value } }))} />
            <div className="small muted">Sağa çektikçe daha yüksek ses gerekir.</div></div>
        </div>
      </section>
      <section className="card sec" aria-labelledby="bs-o">
        <h2 id="bs-o">Çıkış ve görünüm</h2>
        <label className="row chk"><input type="checkbox" checked={b.micToOutput} onChange={(e) => set((x) => ({ ...x, micToOutput: e.target.checked }))} /> Mikrofonu ana çıkışa ver (yalnızca kulaklıkla)</label>
        <label className="row chk"><input type="checkbox" checked={b.darkMode} onChange={(e) => set((x) => ({ ...x, darkMode: e.target.checked }))} /> Karanlık yayın modu</label>
        <p className="small muted">Bu ayarlar yayın masası her açıldığında başlangıç değeri olarak kullanılır.</p>
      </section>
    </>
  );
}
