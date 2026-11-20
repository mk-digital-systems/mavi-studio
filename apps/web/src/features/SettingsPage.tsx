import { useEffect, useState, type ReactNode } from "react";
import type { FxControls, MixSettings } from "@siir/contracts";
import { applyPreset, CONTROL_RANGES, defaultFx, PRESET_ORDER, PRESETS } from "../audio/fx/settings";
import { START_OPTIONS } from "../shell/nav";
import type { Actions } from "../shell/types";
import { resetSettings, updateSettings, useSettings, type StudioSettings } from "../shared/settings";
import type { LocalData } from "../shared/useLocalData";
import { BackupTools, PageHeader, StoragePanel } from "./parts";

const GROUPS = [
  { id: "s-audio", label: "Kayıt ve Mikrofon" },
  { id: "s-fx", label: "Ses ve Atmosfer" },
  { id: "s-read", label: "Teleprompter" },
  { id: "s-store", label: "Depolama ve Yedekleme" },
  { id: "s-adv", label: "Gelişmiş Ayarlar" },
] as const;

function Group({ id, title, hint, children }: { id: string; title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="card sec" id={id} aria-labelledby={id + "-h"}>
      <h2 id={id + "-h"} tabIndex={-1}>{title}</h2>
      {hint && <p className="muted small">{hint}</p>}
      <div className="sliders">{children}</div>
    </section>
  );
}
function Range({ id, label, value, min, max, step, unit = "", onChange, hint }: { id: string; label: string; value: number; min: number; max: number; step: number; unit?: string; onChange: (v: number) => void; hint?: string }) {
  return (
    <div>
      <label htmlFor={id}>{label}: <b>{value}{unit}</b></label>
      <input id={id} type="range" min={min} max={max} step={step} value={value} aria-describedby={hint ? id + "-h" : undefined} onChange={(e) => onChange(+e.target.value)} />
      {hint && <div id={id + "-h"} className="small muted">{hint}</div>}
    </div>
  );
}
function Seg<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div role="group" aria-label={label}>
      <label>{label}</label>
      <div className="seg">{options.map((o) => <button key={String(o.id)} className="btn" aria-pressed={value === o.id} onClick={() => onChange(o.id)}>{o.label}</button>)}</div>
    </div>
  );
}
const Fixed = ({ label, value }: { label: string; value: string }) => <div><label>{label}</label><p className="fixed">{value} <span className="muted small">(sabit)</span></p></div>;

/** Stüdyo Ayarları: yalnızca temel ayarlar görünür; teknik ayarlar "Gelişmiş" içinde kapalı başlar. */
export function SettingsPage({ data }: { data: LocalData; actions: Actions }) {
  const s = useSettings();
  const set = (fn: (x: StudioSettings) => StudioSettings) => updateSettings(fn);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const load = () => void navigator.mediaDevices.enumerateDevices().then((d) => setDevices(d.filter((x) => x.kind === "audioinput"))).catch(() => {});
    load(); navigator.mediaDevices.addEventListener("devicechange", load);
    return () => navigator.mediaDevices.removeEventListener("devicechange", load);
  }, []);

  const fx = s.newProject.fx, mix = s.newProject.mix;
  const setMix = (p: Partial<MixSettings>) => set((x) => ({ ...x, newProject: { ...x.newProject, mix: { ...x.newProject.mix, ...p } } }));
  const setMusic = (p: Partial<MixSettings["music"]>) => setMix({ music: { ...mix.music, ...p } });
  const setCtl = (k: keyof FxControls, v: number) => set((x) => ({ ...x, newProject: { ...x.newProject, fx: { ...x.newProject.fx, controls: { ...x.newProject.fx.controls, [k]: v } } } }));
  const jump = (id: string) => { const el = document.getElementById(id); el?.scrollIntoView({ behavior: "smooth", block: "start" }); (document.getElementById(id + "-h") as HTMLElement | null)?.focus({ preventScroll: true }); };

  return (
    <>
      <PageHeader title="Stüdyo Ayarları" sub="Ses Stüdyosu · yeni çalışmaların başlangıç değerleri" />
      <div className="note" role="note">Buradaki değişiklikler <b>yeni çalışmaların başlangıç değerleridir</b>; mevcut çalışmalarını değiştirmez. Her ayar otomatik kaydedilir. Fon seviyesi ve başlangıç noktası her kayıtta “Yeni Kayıt” ekranında ayarlanır.</div>

      <nav aria-label="Ayar grupları" className="jump">
        {GROUPS.map((g) => <button key={g.id} className="btn ghost" onClick={() => jump(g.id)}>{g.label}</button>)}
      </nav>

      <Group id="s-audio" title="Kayıt ve Mikrofon" hint="Kayıt ekranındaki varsayılanlar.">
        <div>
          <label htmlFor="set-mic">Varsayılan mikrofon</label>
          <select id="set-mic" value={s.audio.deviceId} onChange={(e) => set((x) => ({ ...x, audio: { ...x.audio, deviceId: e.target.value } }))}>
            <option value="">Sistem varsayılanı</option>
            {devices.map((d, i) => <option key={d.deviceId || i} value={d.deviceId}>{d.label || `Mikrofon ${i + 1}`}</option>)}
          </select>
          <div className="small muted">Mikrofon adları, kayıt ekranında bir kez izin verdikten sonra görünür.</div>
        </div>
        <Seg label="Geri sayım" value={s.audio.countdownSec} options={[{ id: 0, label: "Yok" }, { id: 3, label: "3 sn" }, { id: 5, label: "5 sn" }]} onChange={(v) => set((x) => ({ ...x, audio: { ...x.audio, countdownSec: v as 0 | 3 | 5 } }))} />
      </Group>

      <Group id="s-fx" title="Ses ve Atmosfer" hint="Yeni şiirlerin başlangıç ses profili.">
        <div>
          <label htmlFor="set-atm">Ses atmosferi</label>
          <select id="set-atm" value={fx.preset} onChange={(e) => set((x) => ({ ...x, newProject: { ...x.newProject, fx: applyPreset(x.newProject.fx, e.target.value as typeof fx.preset) } }))}>
            {PRESET_ORDER.map((id) => <option key={id} value={id}>{PRESETS[id].label} — {PRESETS[id].description}</option>)}
          </select>
        </div>
      </Group>

      <Group id="s-read" title="Teleprompter" hint="Kayıt ekranındaki okuma ekranı. Hız ve yazı büyüklüğü her şiir için ayrıca saklanır.">
        <Range id="set-spd" label="Kaydırma hızı" value={s.reading.speed} min={8} max={90} step={1} onChange={(v) => set((x) => ({ ...x, reading: { ...x.reading, speed: v } }))} />
        <Range id="set-fs" label="Yazı büyüklüğü" value={Math.round(s.reading.fontScale * 100)} min={80} max={160} step={5} unit="%" onChange={(v) => set((x) => ({ ...x, reading: { ...x.reading, fontScale: v / 100 } }))} />
        <label className="row chk"><input type="checkbox" checked={s.reading.autoScroll} onChange={(e) => set((x) => ({ ...x, reading: { ...x.reading, autoScroll: e.target.checked } }))} /> Otomatik kaydırma açık başlasın</label>
        <div className="reader sample" aria-label="Okuma ekranı önizlemesi" style={{ ["--rs" as string]: s.reading.fontScale, ["--rl" as string]: s.reading.lineHeight }}>
          <div className="line">Gece sessiz, yıldızlar uyanık</div><div className="line">Bir ses geliyor uzaklardan</div>
        </div>
      </Group>

      <section className="card sec" id="s-store" aria-labelledby="s-store-h">
        <h2 id="s-store-h" tabIndex={-1}>Depolama ve Yedekleme</h2>
        {err && <div className="alert" role="alert">{err}</div>}
        {msg && <div className="note" role="status">{msg}</div>}
        <StoragePanel info={data.info} reload={data.reload} />
        <p className="small muted" style={{ marginTop: 12 }}>Otomatik kaydetme her zaman açıktır: şiir metni ve ayarlar yazdıkça, kayıtlar parça parça cihaza yazılır.</p>
        <BackupTools projects={data.projects ?? []} reload={data.reload} onMsg={setMsg} onErr={setErr} />
      </section>

      <section className="card sec" id="s-adv" aria-labelledby="s-adv-h">
        <details>
          <summary id="s-adv-h">Gelişmiş Ayarlar</summary>
          <p className="muted small">Teknik ayarlar. Çoğu kullanıcının buraya girmesi gerekmez.</p>
          <div className="sliders">
            {(Object.keys(CONTROL_RANGES) as (keyof FxControls)[]).map((k) => {
              const r = CONTROL_RANGES[k];
              return <Range key={k} id={"set-c-" + k} label={r.label} value={fx.controls[k]} min={r.min} max={r.max} step={r.step} unit={k === "outputDb" ? " dB" : ""} hint={r.hint} onChange={(v) => setCtl(k, v)} />;
            })}
            <div><button className="btn ghost" onClick={() => set((x) => ({ ...x, newProject: { ...x.newProject, fx: defaultFx(x.newProject.fx.preset) } }))}>Bu atmosferin varsayılanlarına dön</button></div>
            <label className="row chk"><input type="checkbox" checked={mix.ducking.enabled} onChange={(e) => setMix({ ducking: { ...mix.ducking, enabled: e.target.checked } })} /> Okurken fon müziğini otomatik kıs</label>
            {mix.ducking.enabled && <Range id="set-duck" label="Kısma miktarı" value={mix.ducking.amountDb} min={0} max={18} step={1} unit=" dB" onChange={(v) => setMix({ ducking: { ...mix.ducking, amountDb: v } })} />}
            <Range id="set-fi" label="Fon giriş yumuşatma" value={mix.music.fadeInSec} min={0} max={8} step={0.5} unit=" sn" onChange={(v) => setMusic({ fadeInSec: v })} />
            <Range id="set-fo" label="Fon çıkış yumuşatma" value={mix.music.fadeOutSec} min={0} max={8} step={0.5} unit=" sn" onChange={(v) => setMusic({ fadeOutSec: v })} />
            <Range id="set-tail" label="Şiir bitince fon" value={mix.music.tailSec} min={0} max={10} step={0.5} unit=" sn" onChange={(v) => setMusic({ tailSec: v })} />
            <Seg<"wav" | "mp3"> label="Varsayılan dışa aktarma biçimi" value={mix.format} options={[{ id: "wav", label: "WAV" }, { id: "mp3", label: "MP3" }]} onChange={(v) => setMix({ format: v })} />
            <div><label htmlFor="set-poet">Şair (künye)</label><input id="set-poet" type="text" maxLength={80} value={mix.poet} onChange={(e) => setMix({ poet: e.target.value })} /></div>
            <div><label htmlFor="set-reader">Okuyan (künye)</label><input id="set-reader" type="text" maxLength={80} value={mix.reader} onChange={(e) => setMix({ reader: e.target.value })} /></div>
            <Range id="set-lh" label="Satır aralığı" value={s.reading.lineHeight} min={1.3} max={2} step={0.1} onChange={(v) => set((x) => ({ ...x, reading: { ...x.reading, lineHeight: Math.round(v * 10) / 10 } }))} />
            <Seg<"system" | "dark" | "light"> label="Tema" value={s.appearance.theme} options={[{ id: "system", label: "Sistem" }, { id: "dark", label: "Koyu" }, { id: "light", label: "Açık" }]} onChange={(v) => set((x) => ({ ...x, appearance: { ...x.appearance, theme: v } }))} />
            <Seg<number> label="Arayüz yazı boyutu" value={s.appearance.textScale} options={[{ id: 0.9, label: "Küçük" }, { id: 1, label: "Normal" }, { id: 1.15, label: "Büyük" }, { id: 1.3, label: "Çok büyük" }]} onChange={(v) => set((x) => ({ ...x, appearance: { ...x.appearance, textScale: v } }))} />
            <Seg<"full" | "compact"> label="Sol menü" value={s.appearance.sidebar} options={[{ id: "full", label: "Geniş" }, { id: "compact", label: "Dar (yalnızca simge)" }]} onChange={(v) => set((x) => ({ ...x, appearance: { ...x.appearance, sidebar: v } }))} />
            <div>
              <label htmlFor="set-start">Açılış ekranı</label>
              <select id="set-start" value={START_OPTIONS.some((o) => o.id === s.appearance.startSection) ? s.appearance.startSection : "home"} onChange={(e) => set((x) => ({ ...x, appearance: { ...x.appearance, startSection: e.target.value as StudioSettings["appearance"]["startSection"] } }))}>
                {START_OPTIONS.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
              </select>
            </div>
            <Fixed label="Kayıt kalitesi" value="48 kHz · 24-bit · mono" />
            <Fixed label="Kayıtta gürültü azaltma" value="Kapalı (ham kayıt korunur; temizlik atmosferle uygulanır)" />
            <Fixed label="Canlı dinleme" value="Her kayıtta kapalı başlar; açarsan kulaklık gerekir" />
            <div><button className="btn ghost" onClick={() => { if (confirm("Tüm stüdyo ayarları varsayılana dönsün mü? Şiirlerin ve kayıtların değişmez.")) resetSettings(); }}>Ayarları varsayılana döndür</button></div>
          </div>
        </details>
      </section>
    </>
  );
}
