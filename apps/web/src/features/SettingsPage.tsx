import { useEffect, useState, type ReactNode } from "react";
import type { FxControls, MixSettings, VideoOrientation, VideoPalette, VideoTarget } from "@siir/contracts";
import { applyPreset, CONTROL_RANGES, defaultFx, PRESET_ORDER, PRESETS } from "../audio/fx/settings";
import { NAV } from "../shell/Sidebar";
import type { Actions } from "../shell/types";
import { resetSettings, updateSettings, useSettings, type StudioSettings } from "../shared/settings";
import type { LocalData } from "../shared/useLocalData";
import { BackupTools, PageHeader, StoragePanel } from "./parts";

const GROUPS = [
  { id: "s-audio", label: "Mikrofon ve Ses" },
  { id: "s-fx", label: "Ses Efektleri ve Miksaj" },
  { id: "s-video", label: "Video Ayarları" },
  { id: "s-music", label: "Fon Müziği Ayarları" },
  { id: "s-read", label: "Şiir Okuma Ayarları" },
  { id: "s-store", label: "Depolama ve Yedekleme" },
  { id: "s-look", label: "Görünüm ve Çalışma Alanı" },
  { id: "s-todo", label: "Henüz desteklenmeyenler" },
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

export function SettingsPage({ data, actions }: { data: LocalData; actions: Actions }) {
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
      <PageHeader title="Stüdyo Ayarları" sub="Genel varsayılanlar. Bir şiire özel değerler (müzik seviyesi, okuma hızı, efektler) o projenin içinde saklanır." />
      <div className="note" role="note">Burada yaptığın değişiklikler <b>yeni çalışmaların başlangıç değerleridir</b>; açık veya eski projelerini değiştirmez. Her ayar otomatik kaydedilir.</div>

      <nav aria-label="Ayar grupları" className="jump">
        {GROUPS.map((g) => <button key={g.id} className="btn ghost" onClick={() => jump(g.id)}>{g.label}</button>)}
      </nav>

      <Group id="s-audio" title="Mikrofon ve Ses" hint="Kayıt ekranındaki varsayılanlar.">
        <div>
          <label htmlFor="set-mic">Varsayılan mikrofon</label>
          <select id="set-mic" value={s.audio.deviceId} onChange={(e) => set((x) => ({ ...x, audio: { ...x.audio, deviceId: e.target.value } }))}>
            <option value="">Sistem varsayılanı</option>
            {devices.map((d, i) => <option key={d.deviceId || i} value={d.deviceId}>{d.label || `Mikrofon ${i + 1}`}</option>)}
          </select>
          <div className="small muted">Mikrofon adları, kayıt ekranında bir kez izin verdikten sonra görünür.</div>
        </div>
        <Seg label="Geri sayım" value={s.audio.countdownSec} options={[{ id: 0, label: "Yok" }, { id: 3, label: "3 sn" }, { id: 5, label: "5 sn" }]} onChange={(v) => set((x) => ({ ...x, audio: { ...x.audio, countdownSec: v as 0 | 3 | 5 } }))} />
        <Fixed label="Kayıt kalitesi" value="48 kHz · 24-bit · mono" />
        <Fixed label="Kayıt sırasında gürültü azaltma" value="Kapalı (ham kayıt korunur; temizlik Ses Stüdyosu’nda uygulanır)" />
        <Fixed label="Canlı dinleme" value="Her kayıtta kapalı başlar; açarsan kulaklık gerekir" />
      </Group>

      <Group id="s-fx" title="Ses Efektleri ve Miksaj" hint="Yeni şiirlerin başlangıç ses profili ve dışa aktarma varsayılanları. Projede ayrıca değiştirebilirsin.">
        <div>
          <label htmlFor="set-atm">Hazır ses profili (atmosfer)</label>
          <select id="set-atm" value={fx.preset} onChange={(e) => set((x) => ({ ...x, newProject: { ...x.newProject, fx: applyPreset(x.newProject.fx, e.target.value as typeof fx.preset) } }))}>
            {PRESET_ORDER.map((id) => <option key={id} value={id}>{PRESETS[id].label} — {PRESETS[id].description}</option>)}
          </select>
        </div>
        {(Object.keys(CONTROL_RANGES) as (keyof FxControls)[]).map((k) => {
          const r = CONTROL_RANGES[k];
          return <Range key={k} id={"set-c-" + k} label={r.label} value={fx.controls[k]} min={r.min} max={r.max} step={r.step} unit={k === "outputDb" ? " dB" : ""} hint={r.hint} onChange={(v) => setCtl(k, v)} />;
        })}
        <div><button className="btn ghost" onClick={() => set((x) => ({ ...x, newProject: { ...x.newProject, fx: defaultFx(x.newProject.fx.preset) } }))}>Bu profilin varsayılanlarına dön</button></div>
        <label className="row chk"><input type="checkbox" checked={mix.ducking.enabled} onChange={(e) => setMix({ ducking: { ...mix.ducking, enabled: e.target.checked } })} /> Okurken fon müziğini otomatik kıs</label>
        {mix.ducking.enabled && <Range id="set-duck" label="Kısma miktarı" value={mix.ducking.amountDb} min={0} max={18} step={1} unit=" dB" onChange={(v) => setMix({ ducking: { ...mix.ducking, amountDb: v } })} />}
        <Seg<"wav" | "mp3"> label="Varsayılan dışa aktarma biçimi" value={mix.format} options={[{ id: "wav", label: "WAV" }, { id: "mp3", label: "MP3" }]} onChange={(v) => setMix({ format: v })} />
        <div><label htmlFor="set-poet">Şair (künye)</label><input id="set-poet" type="text" maxLength={80} value={mix.poet} onChange={(e) => setMix({ poet: e.target.value })} /></div>
        <div><label htmlFor="set-reader">Okuyan (künye)</label><input id="set-reader" type="text" maxLength={80} value={mix.reader} onChange={(e) => setMix({ reader: e.target.value })} /></div>
      </Group>

      <Group id="s-video" title="Video Ayarları" hint="Video oluştururken ilk seçili gelen değerler.">
        <Seg<VideoTarget> label="Platform" value={s.video.target} options={[{ id: "tiktok", label: "TikTok" }, { id: "reels", label: "Reels" }, { id: "youtube", label: "YouTube" }]}
          onChange={(v) => set((x) => ({ ...x, video: { ...x.video, target: v, orientation: v === "youtube" ? "landscape" : "portrait" } }))} />
        <Seg<VideoOrientation> label="Biçim" value={s.video.orientation} options={[{ id: "portrait", label: "9:16" }, { id: "landscape", label: "16:9" }, { id: "square", label: "1:1" }]} onChange={(v) => set((x) => ({ ...x, video: { ...x.video, orientation: v } }))} />
        <div>
          <label htmlFor="set-pal">Arka plan</label>
          <select id="set-pal" value={s.video.palette} onChange={(e) => set((x) => ({ ...x, video: { ...x.video, palette: e.target.value as VideoPalette } }))}>
            {([["dusk", "Alacakaranlık"], ["dawn", "Şafak"], ["night", "Gece"], ["forest", "Orman"], ["ember", "Kor"]] as const).map(([id, l]) => <option key={id} value={id}>{l}</option>)}
          </select>
        </div>
        <label className="row chk"><input type="checkbox" checked={s.video.captions} onChange={(e) => set((x) => ({ ...x, video: { ...x.video, captions: e.target.checked } }))} /> Altyazı ekle</label>
        <label className="row chk"><input type="checkbox" checked={s.video.showTitle} onChange={(e) => set((x) => ({ ...x, video: { ...x.video, showTitle: e.target.checked } }))} /> Başlığı göster</label>
        <Fixed label="Çözünürlük · FPS · kalite" value="1080p · 30 fps · H.264" />
      </Group>

      <Group id="s-music" title="Fon Müziği Ayarları" hint="Yeni şiirlerde fon müziğinin başlangıç değerleri.">
        <Range id="set-mg" label="Varsayılan müzik seviyesi" value={mix.music.gainDb} min={-40} max={0} step={1} unit=" dB" hint="Sağa çektikçe müzik yükselir." onChange={(v) => setMusic({ gainDb: v })} />
        <Range id="set-fi" label="Giriş yumuşatma" value={mix.music.fadeInSec} min={0} max={8} step={0.5} unit=" sn" onChange={(v) => setMusic({ fadeInSec: v })} />
        <Range id="set-fo" label="Çıkış yumuşatma" value={mix.music.fadeOutSec} min={0} max={8} step={0.5} unit=" sn" onChange={(v) => setMusic({ fadeOutSec: v })} />
        <Range id="set-tail" label="Şiir bitince müzik" value={mix.music.tailSec} min={0} max={10} step={0.5} unit=" sn" onChange={(v) => setMusic({ tailSec: v })} />
        <div><label>Favoriler</label><p className="fixed">{s.music.favorites.length} parça <button className="btn ghost" onClick={() => actions.go("music")}>Fon Müziklerim’e git</button></p></div>
      </Group>

      <Group id="s-read" title="Şiir Okuma Ayarları" hint="Kayıt ekranındaki okuma ekranı (teleprompter). Okuma hızı şiire özel olarak projenin içinde de saklanır.">
        <Range id="set-spd" label="Varsayılan kaydırma hızı" value={s.reading.speed} min={8} max={90} step={1} onChange={(v) => set((x) => ({ ...x, reading: { ...x.reading, speed: v } }))} />
        <Range id="set-fs" label="Yazı boyutu" value={Math.round(s.reading.fontScale * 100)} min={80} max={160} step={5} unit="%" onChange={(v) => set((x) => ({ ...x, reading: { ...x.reading, fontScale: v / 100 } }))} />
        <Range id="set-lh" label="Satır aralığı" value={s.reading.lineHeight} min={1.3} max={2} step={0.1} onChange={(v) => set((x) => ({ ...x, reading: { ...x.reading, lineHeight: Math.round(v * 10) / 10 } }))} />
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

      <Group id="s-look" title="Görünüm ve Çalışma Alanı">
        <Seg<"system" | "dark" | "light"> label="Tema" value={s.appearance.theme} options={[{ id: "system", label: "Sistem" }, { id: "dark", label: "Koyu" }, { id: "light", label: "Açık" }]} onChange={(v) => set((x) => ({ ...x, appearance: { ...x.appearance, theme: v } }))} />
        <Seg<number> label="Yazı boyutu" value={s.appearance.textScale} options={[{ id: 0.9, label: "Küçük" }, { id: 1, label: "Normal" }, { id: 1.15, label: "Büyük" }, { id: 1.3, label: "Çok büyük" }]} onChange={(v) => set((x) => ({ ...x, appearance: { ...x.appearance, textScale: v } }))} />
        <Seg<"full" | "compact"> label="Sol menü" value={s.appearance.sidebar} options={[{ id: "full", label: "Geniş" }, { id: "compact", label: "Dar (yalnızca simge)" }]} onChange={(v) => set((x) => ({ ...x, appearance: { ...x.appearance, sidebar: v } }))} />
        <div>
          <label htmlFor="set-start">Açılış ekranı</label>
          <select id="set-start" value={s.appearance.startSection} onChange={(e) => set((x) => ({ ...x, appearance: { ...x.appearance, startSection: e.target.value as StudioSettings["appearance"]["startSection"] } }))}>
            {NAV.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
          </select>
        </div>
      </Group>

      <section className="card sec" id="s-todo" aria-labelledby="s-todo-h">
        <h2 id="s-todo-h" tabIndex={-1}>Henüz desteklenmeyenler</h2>
        <p className="muted small">Aşağıdakiler için ayar düğmesi koymadım: arkasında çalışan bir motor yok ya da bilinçli olarak kapalı. Düğme eklemek yeterli olmaz; önce ilgili motor desteklemeli.</p>
        <ul className="dashes">
          <li><b>4K çözünürlük, FPS ve video kalitesi seçimi</b> — video motoru şu an 1080p · 30 fps sabit kalitede üretir; 4K için render süresi ve bellek maliyeti ölçülüp motor genişletilmeli.</li>
          <li><b>Müzik klasörü / kendi müziğini yükleme</b> — bilinçli olarak yok: lisans ve telif güvenliği için fon müzikleri yalnızca yönetici tarafından eklenir.</li>
          <li><b>Dosyaları belirli bir klasöre otomatik kaydetme</b> — tarayıcı güvenlik modeli buna izin vermez (yalnızca bazı tarayıcılarda, kullanıcı onaylı klasör erişimiyle mümkün); güvenilir yerel/sunucu depolama düzeniyle birlikte planlanıyor.</li>
          <li><b>Ekolayzır ve kompresör için sayısal ayar</b> — ses motoru bu modülleri içerir ama sade kontrollerle açılır; ince ayar “Ses Stüdyosu → Gelişmiş” içinde modül aç/kapa olarak var.</li>
          <li><b>Kayıt kalitesi seçimi (44,1 kHz, 16-bit vb.)</b> — kayıt hattı 48 kHz · 24-bit mono olarak kuruldu.</li>
          <li><b>Panel düzenini serbestçe değiştirme</b> — şimdilik yalnızca sol menüyü daraltma var.</li>
        </ul>
        <button className="btn ghost" onClick={() => { if (confirm("Tüm stüdyo ayarları varsayılana dönsün mü? Projelerin değişmez.")) resetSettings(); }}>Ayarları varsayılana döndür</button>
      </section>
    </>
  );
}
