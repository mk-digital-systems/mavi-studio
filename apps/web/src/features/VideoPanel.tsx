import { useEffect, useMemo, useRef, useState } from "react";
import type { ExportAudioInfo, ExportBundle, FxSettings, VideoOrientation, VideoPalette, VideoSpec, VideoTarget } from "@siir/contracts";
import type { Draft } from "../App";
import type { Analysis } from "../audio/fx/analysis";
import { computeLineTimings, detectSpeech, toCaptions } from "../audio/timing";
import { ApiFail, startDownload } from "../export/client";
import { createVideoJob, videoMessage, waitForVideo } from "../video/client";
import { anonymousSessionId } from "../storage/repo";
import { guard } from "../shared/prefs";
import { fmt, parsePoem } from "../shared/util";
import { wakeLock } from "../shared/wakeLock";
import { getSettings } from "../shared/settings";

const TARGETS: { id: VideoTarget; label: string; orientation: VideoOrientation }[] = [
  { id: "tiktok", label: "TikTok", orientation: "portrait" },
  { id: "reels", label: "Instagram Reels", orientation: "portrait" },
  { id: "youtube", label: "YouTube", orientation: "landscape" },
];
const ORIENT: { id: VideoOrientation; label: string }[] = [
  { id: "portrait", label: "Dikey 9:16" }, { id: "landscape", label: "Yatay 16:9" }, { id: "square", label: "Kare 1:1" },
];
const PALETTES: { id: VideoPalette; label: string; css: string }[] = [
  { id: "dusk", label: "Alacakaranlık", css: "linear-gradient(135deg,#1d1530,#5a3a52,#7a3e2b)" },
  { id: "dawn", label: "Şafak", css: "linear-gradient(135deg,#2a2233,#8a5a44,#c98a5a)" },
  { id: "night", label: "Gece", css: "linear-gradient(135deg,#0b1020,#1d2a4d,#34506a)" },
  { id: "forest", label: "Orman", css: "linear-gradient(135deg,#0f1f1a,#24453b,#4a6b52)" },
  { id: "ember", label: "Kor", css: "linear-gradient(135deg,#1a0f0d,#5a1f2b,#a0502f)" },
];

type Props = { draft: Draft; audioRef: string; audioInfo: ExportAudioInfo; analysis: Analysis; fx: FxSettings };
type Phase = "idle" | "queue" | "render" | "ready" | "error";

/**
 * Video üretimi: ses modülünün verdiği ExportBundle'ı bağımsız video işçisine gönderir.
 * Bu bileşen yalnızca sözleşme tipleriyle ve /api/video uçlarıyla konuşur.
 */
export function VideoPanel({ draft, audioRef, audioInfo, analysis, fx }: Props) {
  const vd = getSettings().video; // genel varsayılanlar (Stüdyo Ayarları → Video)
  const [target, setTarget] = useState<VideoTarget>(vd.target);
  const [orientation, setOrientation] = useState<VideoOrientation>(vd.orientation);
  const [palette, setPalette] = useState<VideoPalette>(vd.palette);
  const [captions, setCaptions] = useState(vd.captions);
  const [showTitle, setShowTitle] = useState(vd.showTitle);
  const [shiftMs, setShiftMs] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [info, setInfo] = useState("");
  const abort = useRef<AbortController | null>(null);
  const busy = phase === "queue" || phase === "render";

  const lines = useMemo(() => parsePoem(draft.text).stanzas.flatMap((s) => s.lines), [draft.text]);
  const speech = useMemo(() => detectSpeech(analysis.frameRms, analysis.frameMs), [analysis]);
  // Ses, dışa aktarmada gecikmeli başlıyorsa (zamanlama kayması > 0) zamanlar o kadar ötelenir.
  const vDelay = Math.max(0, draft.mix.alignmentOffsetMs);
  const timings = useMemo(() => computeLineTimings(lines, speech, { offsetMs: vDelay + shiftMs }), [lines, speech, vDelay, shiftMs]);
  const cues = useMemo(() => toCaptions(lines, timings), [lines, timings]);

  useEffect(() => { guard.exporting = busy; if (busy) void wakeLock.acquire(); else wakeLock.release(); return () => { guard.exporting = false; wakeLock.release(); }; }, [busy]);
  useEffect(() => () => abort.current?.abort(), []);

  const pickTarget = (t: (typeof TARGETS)[number]) => { setTarget(t.id); setOrientation(t.orientation); };

  async function run() {
    setErr(""); setInfo(""); setWarnings([]); setProgress(0);
    if (!navigator.onLine) { setErr("İnternet bağlantısı yok. Bağlanıp tekrar dene."); setPhase("error"); return; }
    const ac = (abort.current = new AbortController()), session = anonymousSessionId();
    const bundle: ExportBundle = {
      bundleVersion: 1, projectId: draft.id, ownerId: draft.ownerId,
      audio: { masterAudioRef: audioRef, format: audioInfo.format, durationMs: audioInfo.durationMs },
      poem: { title: draft.title, text: draft.text },
      timings, captions: cues, music: audioInfo.music,
      credits: { poet: draft.mix.poet, reader: draft.mix.reader },
      studio: { atmosphere: fx.preset, fx },
      video: { orientation, targets: [target] },
    };
    const spec: VideoSpec = { orientation, target, palette, captions: captions && cues.length > 0, showTitle };
    try {
      setPhase("queue");
      const job = await createVideoJob(bundle, spec, session);
      const fin = await waitForVideo(job.jobId, session, (s) => { setPhase(s.state === "preparing" ? "render" : "queue"); setProgress(s.progress ?? 0); if (s.warnings?.length) setWarnings(s.warnings); }, ac.signal);
      if (fin.state === "failed") throw new ApiFail(fin.errorCode ?? "render-failed", videoMessage(fin.errorCode ?? "", fin.message ?? ""));
      if (!fin.downloadUrl) throw new ApiFail("expired", videoMessage("expired", ""));
      setInfo(`${fin.width}×${fin.height} · ${fmt(fin.durationMs ?? 0)} · MP4 (H.264 + AAC). Dosya indirildikten sonra sunucudan silinir.`);
      setPhase("ready");
      startDownload(fin.downloadUrl);
    } catch (e) {
      if ((e as DOMException)?.name === "AbortError") { setPhase("idle"); return; }
      setErr(e instanceof ApiFail ? e.message : "Video oluşturulamadı. Tekrar dene."); setPhase("error");
    }
  }

  return (
    <section className="card" aria-labelledby="vd-h" style={{ marginTop: 14 }}>
      <h2 id="vd-h">Video oluştur</h2>
      <p className="muted small">Hazırladığın ses (fon müziğiyle birleşmiş), şiir metni ve satır zamanlamalarıyla MP4 video üretilir. Video sunucuda hazırlanır; bittikten ve indirildikten sonra silinir.</p>
      {audioInfo.music.trackId && !audioInfo.music.license.allowsSocialMediaUse && audioInfo.music.license.type !== "placeholder" && (
        <div className="alert" role="alert">Seçili fon müziğinin lisansı sosyal medya videosuna izin vermiyor; video üretilemez.</div>
      )}

      <div className="sliders">
        <div role="group" aria-label="Platform">
          <label>Platform</label>
          <div className="seg">{TARGETS.map((t) => <button key={t.id} className="btn" aria-pressed={target === t.id} disabled={busy} onClick={() => pickTarget(t)}>{t.label}</button>)}</div>
        </div>
        <div role="group" aria-label="Biçim">
          <label>Biçim</label>
          <div className="seg">{ORIENT.map((o) => <button key={o.id} className="btn" aria-pressed={orientation === o.id} disabled={busy} onClick={() => setOrientation(o.id)}>{o.label}</button>)}</div>
        </div>
      </div>

      <div role="group" aria-label="Arka plan" style={{ margin: "12px 0" }}>
        <label>Arka plan</label>
        <div className="row">
          {PALETTES.map((p) => (
            <button key={p.id} className="btn" aria-pressed={palette === p.id} aria-label={p.label} disabled={busy} onClick={() => setPalette(p.id)}
              style={{ background: p.css, minWidth: 72, color: "#fff", border: palette === p.id ? "2px solid var(--accent)" : undefined }}>{p.label}</button>
          ))}
        </div>
      </div>

      <label className="row chk"><input type="checkbox" checked={captions} disabled={busy || cues.length === 0} onChange={(e) => setCaptions(e.target.checked)} /> Altyazı ekle{cues.length === 0 ? " (konuşma bulunamadığı için kullanılamıyor)" : ""}</label>
      <label className="row chk"><input type="checkbox" checked={showTitle} disabled={busy} onChange={(e) => setShowTitle(e.target.checked)} /> Başlığı göster</label>

      {cues.length > 0 && (
        <details>
          <summary>Altyazı zamanlaması ({cues.length} satır)</summary>
          <p className="small muted">Zamanlama, okuma süresinin dizelere hece oranıyla paylaştırılmasıyla tahmin edilir; kaymışsa aşağıdan düzelt.</p>
          <label htmlFor="vd-shift">Genel kaydırma: <b>{shiftMs > 0 ? "+" : ""}{(shiftMs / 1000).toFixed(1)} sn</b></label>
          <input id="vd-shift" type="range" min={-3000} max={3000} step={100} value={shiftMs} disabled={busy} onChange={(e) => setShiftMs(+e.target.value)} />
          <ol className="small" style={{ paddingLeft: 20 }}>{cues.map((c, i) => <li key={i}><span className="muted">{fmt(c.startMs)}–{fmt(c.endMs)}</span> {c.text}</li>)}</ol>
        </details>
      )}

      <div className="row" style={{ marginTop: 12 }}>
        {!busy ? <button className="btn primary" onClick={() => void run()}>Videoyu oluştur ve indir</button> : <button className="btn" onClick={() => { abort.current?.abort(); }}>Vazgeç</button>}
      </div>

      <div aria-live="polite" role="status" style={{ marginTop: 12 }}>
        {busy && (<>
          <p><b>{phase === "queue" ? "Sırada bekliyor…" : "Video hazırlanıyor…"}</b></p>
          <div className="meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}><div style={{ width: progress * 100 + "%" }} /></div>
          <p className="small muted">%{Math.round(progress * 100)}</p>
        </>)}
        {warnings.map((w, i) => <div key={i} className="warn" role="status">{w}</div>)}
        {err && <div className="alert" role="alert">{err}</div>}
        {phase === "ready" && <div className="note">✓ Video hazır. {info}</div>}
      </div>
    </section>
  );
}
