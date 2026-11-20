import { useEffect, useMemo, useRef, useState } from "react";
import type { ExportAudioInfo, ExportStatus, MixSettings, Take } from "@siir/contracts";
import type { Analysis } from "../audio/fx/analysis";
import { VideoPanel } from "./VideoPanel";
import type { Draft, Patch } from "../App";
import { analysisFor } from "../audio/fx/analysisCache";
import { renderTakeToWav, RenderAborted } from "../audio/fx/render";
import { defaultFx, sanitizeFx } from "../audio/fx/settings";
import { ApiFail, createJob, friendly, startDownload, uploadVoice, waitForJob, getStatus } from "../export/client";
import { getBotToken } from "../export/turnstile";
import { sanitizeMix, toRecipe } from "../shared/mix";
import { anonymousSessionId } from "../storage/repo";
import { effectiveFx } from "../storage/migrate";
import { openTakeReader } from "../storage/takeReader";
import { fmt, slug } from "../shared/util";
import { guard } from "../shared/prefs";
import { tr } from "../shared/tr";
import { wakeLock } from "../shared/wakeLock";

type Phase = "idle" | "render" | "create" | "upload" | "queue" | "mix" | "ready" | "local-ready" | "error";
type Props = { draft: Draft; patch: Patch; takes: Take[]; defaultForVideo?: boolean };

const STEP_TEXT: Partial<Record<Phase, string>> = {
  create: "İş hazırlanıyor…", render: "Efektler uygulanıyor…", upload: "Ses sunucuya gönderiliyor…",
  queue: "Sırada bekliyor…", mix: "Stüdyoda mikslenip son seviyeye getiriliyor…",
};

export function ExportPanel({ draft, patch, takes, defaultForVideo }: Props) {
  const done = takes.filter((t) => t.status === "complete");
  const [takeId, setTakeId] = useState(draft.primaryTakeId && done.some((t) => t.id === draft.primaryTakeId) ? draft.primaryTakeId : done[0]?.id ?? "");
  const [consent, setConsent] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState("");
  const [remaining, setRemaining] = useState<number | null>(null);
  const [forVideo, setForVideo] = useState(!!defaultForVideo);
  const [videoData, setVideoData] = useState<{ audioRef: string; audioInfo: ExportAudioInfo; analysis: Analysis } | null>(null);
  const [result, setResult] = useState<{ url?: string; name: string; note: string } | null>(null);
  const abort = useRef<AbortController | null>(null);
  const localUrl = useRef("");
  const mix = draft.mix;
  const take = done.find((t) => t.id === takeId);
  const hasMusic = !!draft.trackId;
  // Müziksiz WAV tamamen cihazda üretilir; video isteniyorsa ses sunucuya gitmek zorundadır (video işçisi onu okur).
  const local = !hasMusic && mix.format === "wav" && !forVideo;
  const busy = !["idle", "ready", "local-ready", "error"].includes(phase);

  // Dışa aktarma sürerken: sayfadan çıkarken uyar, ekran uyumasın (render/yükleme uzun sürebilir).
  useEffect(() => { guard.exporting = busy; if (busy) void wakeLock.acquire(); else wakeLock.release(); return () => { guard.exporting = false; wakeLock.release(); }; }, [busy]);
  useEffect(() => () => { abort.current?.abort(); if (localUrl.current) URL.revokeObjectURL(localUrl.current); }, []);
  useEffect(() => { if (!done.some((t) => t.id === takeId)) setTakeId(done[0]?.id ?? ""); }, [takes]); // eslint-disable-line react-hooks/exhaustive-deps

  const setMix = (p: Partial<MixSettings>) => patch({ mix: sanitizeMix({ ...mix, ...p }) });
  const setMusic = (p: Partial<MixSettings["music"]>) => setMix({ music: { ...mix.music, ...p } });
  const setDuck = (p: Partial<MixSettings["ducking"]>) => setMix({ ducking: { ...mix.ducking, ...p } });
  const fxFor = useMemo(() => (take ? sanitizeFx(effectiveFx(draft, take) ?? defaultFx()) : defaultFx()), [draft, take]);

  const cancel = () => { abort.current?.abort(); setPhase("idle"); setProgress(0); };

  async function run() {
    if (!take || busy) return;
    setErr(""); setResult(null); setProgress(0); setVideoData(null);
    if (!local && !navigator.onLine) { setErr(tr.errors.offline); setPhase("error"); return; }
    const ac = (abort.current = new AbortController());
    try {
      const reader = await openTakeReader(take);
      const analysis = await analysisFor(take, reader);
      const base = `${slug(draft.title)}-${new Date().toISOString().slice(0, 10)}`;

      if (local) {
        // Cihazda: sunucuya hiçbir şey gönderilmez.
        setPhase("render");
        const r = await renderTakeToWav(reader, fxFor, analysis, { normalize: true, targetLufs: -16, onProgress: setProgress, signal: ac.signal });
        if (localUrl.current) URL.revokeObjectURL(localUrl.current);
        localUrl.current = URL.createObjectURL(r.blob);
        setResult({ url: localUrl.current, name: `${base}.wav`, note: `${fmt(r.durationSec * 1000)} · stereo 48 kHz · 24-bit · yaklaşık ${r.lufs.toFixed(1)} LUFS · cihazında oluşturuldu` });
        setPhase("local-ready");
        startDownload(localUrl.current, `${base}.wav`);
        return;
      }

      // Sunucu: önce iş açılır (günlük sınır/bot kontrolü), sonra efektler uygulanıp ses gönderilir.
      const session = anonymousSessionId();
      setPhase("create");
      const bot = await getBotToken();
      const job = await createJob(toRecipe(draft, mix, { forVideo }), session, bot);
      setRemaining(job.remainingToday);
      setPhase("render");
      const r = await renderTakeToWav(reader, fxFor, analysis, { normalize: false, onProgress: setProgress, signal: ac.signal });
      setPhase("upload"); setProgress(0);
      await uploadVoice(job, session, r.blob, setProgress, ac.signal);
      setPhase("queue");
      const fin = await waitForJob(job.jobId, session, (s: ExportStatus) => setPhase(s.state === "preparing" ? "mix" : "queue"), ac.signal);
      if (fin.state === "failed") throw new ApiFail(fin.errorCode ?? "mix-failed", friendly(fin.errorCode ?? "", fin.message ?? ""));
      if (fin.downloadUrl) {
        setResult({ url: fin.downloadUrl, name: `${base}.${mix.format}`, note: "Sunucuda hazırlandı. Dosya indirildikten sonra sunucudan silinir." });
        setPhase("ready");
        if (forVideo && fin.audioRef && fin.audioInfo) setVideoData({ audioRef: fin.audioRef, audioInfo: fin.audioInfo, analysis });
        startDownload(fin.downloadUrl);
      } else throw new ApiFail("expired", friendly("expired", ""));
      // başka bir tıklamada yeni adres almak için iş kimliğini sakla
      (window as unknown as { __siirJob?: string }).__siirJob = job.jobId;
    } catch (e) {
      if (e instanceof RenderAborted || (e as DOMException)?.name === "AbortError") { setPhase("idle"); return; }
      setErr(e instanceof ApiFail ? e.message : "Dışa aktarma başarısız oldu. Tekrar dene.");
      setPhase("error");
    }
  }

  /** İndirme adresi 2 dk geçerlidir; tıklanınca yenisi alınır. */
  async function redownload() {
    const id = (window as unknown as { __siirJob?: string }).__siirJob;
    if (!id) return;
    try {
      const s = await getStatus(id, anonymousSessionId());
      if (s.downloadUrl) startDownload(s.downloadUrl); else setErr(friendly(s.errorCode ?? "expired", s.message ?? ""));
    } catch (e) { setErr(e instanceof ApiFail ? e.message : "İndirilemedi."); }
  }

  if (done.length === 0) return null;
  return (
    <>
    <section className="card" aria-labelledby="ex-h">
      <h2 id="ex-h">Dışa aktar</h2>
      <p className="muted small">Efektler ve fon müziği dışa aktarmada kalıcı olarak uygulanır. Ham fon müziği hiçbir zaman indirilemez; yalnızca şiir sesinle birleşmiş son kayıt verilir.</p>

      <div className="sliders">
        <div>
          <label htmlFor="ex-take">Deneme</label>
          <select id="ex-take" value={takeId} disabled={busy} onChange={(e) => setTakeId(e.target.value)}>
            {done.map((t, i) => <option key={t.id} value={t.id}>Deneme {i + 1} · {fmt(t.durationMs)}{t.id === draft.primaryTakeId ? " (ana)" : ""}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="ex-fmt">Biçim</label>
          <select id="ex-fmt" value={mix.format} disabled={busy} onChange={(e) => setMix({ format: e.target.value as "wav" | "mp3" })}>
            <option value="wav">WAV — yüksek kalite (48 kHz · 24-bit · stereo)</option>
            <option value="mp3">MP3 — paylaşım (192 kbps · stereo)</option>
          </select>
        </div>
        <div><label htmlFor="ex-poet">Şair (isteğe bağlı)</label><input id="ex-poet" type="text" value={mix.poet} maxLength={80} disabled={busy} onChange={(e) => setMix({ poet: e.target.value })} /></div>
        <div><label htmlFor="ex-rd">Okuyan (isteğe bağlı)</label><input id="ex-rd" type="text" value={mix.reader} maxLength={80} disabled={busy} onChange={(e) => setMix({ reader: e.target.value })} /></div>
      </div>

      {hasMusic ? (
        <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: "14px 0 0" }}>
          <h3>Ses ve müzik dengesi</h3>
          <div className="sliders">
            <Slider id="m-gain" label="Müzik seviyesi" value={mix.music.gainDb} min={-40} max={0} step={1} unit=" dB" onChange={(v) => setMusic({ gainDb: v })} hint="Sağa çektikçe müzik yükselir." />
            <Slider id="m-start" label="Müziğin başlangıç noktası" value={mix.music.startOffsetSec} min={0} max={60} step={1} unit=" sn" onChange={(v) => setMusic({ startOffsetSec: v })} hint="Parçanın kaçıncı saniyesinden başlasın." />
            <Slider id="m-tail" label="Şiir bitince müzik" value={mix.music.tailSec} min={0} max={10} step={0.5} unit=" sn" onChange={(v) => setMusic({ tailSec: v })} hint="Şiirden sonra müziğin devam edeceği süre (kesme noktası)." />
            <Slider id="m-fi" label="Giriş yumuşatma" value={mix.music.fadeInSec} min={0} max={8} step={0.5} unit=" sn" onChange={(v) => setMusic({ fadeInSec: v })} />
            <Slider id="m-fo" label="Çıkış yumuşatma" value={mix.music.fadeOutSec} min={0} max={8} step={0.5} unit=" sn" onChange={(v) => setMusic({ fadeOutSec: v })} />
            <Slider id="m-al" label="Ses–müzik zamanlaması" value={mix.alignmentOffsetMs} min={-300} max={300} step={10} unit=" ms" onChange={(v) => setMix({ alignmentOffsetMs: v })} hint="Artı: ses müzikten geç başlar." />
          </div>
          <label className="row chk"><input type="checkbox" checked={mix.ducking.enabled} onChange={(e) => setDuck({ enabled: e.target.checked })} /> Okurken müziği otomatik kıs (sessiz bölümlerde müzik geri gelir)</label>
          {mix.ducking.enabled && <Slider id="m-duck" label="Kısma miktarı" value={mix.ducking.amountDb} min={0} max={18} step={1} unit=" dB" onChange={(v) => setDuck({ amountDb: v })} />}
        </fieldset>
      ) : <p className="small muted">Fon müziği seçilmedi: yalnızca sesin efektlerle ve −16 LUFS seviyesine getirilerek dışa aktarılır.</p>}

      <label className="row chk"><input type="checkbox" checked={forVideo} disabled={busy} onChange={(e) => setForVideo(e.target.checked)} /> Bu kayıttan video da hazırla (TikTok, Reels, YouTube){local ? " — ses sunucuya gönderilir" : ""}</label>
      {local ? (
        <div className="note" role="note" style={{ margin: "14px 0" }}>🔒 Bu dışa aktarma <b>tamamen cihazında</b> yapılır; ses sunucuya gönderilmez.</div>
      ) : (
        <div className="warn" style={{ margin: "14px 0" }}>
          <label className="row chk" style={{ margin: 0 }}>
            <input type="checkbox" checked={consent} disabled={busy} onChange={(e) => setConsent(e.target.checked)} />
            <span>Ses kaydımın, miks için <b>geçici olarak sunucuya gönderilmesini</b> ve işlem sonrası silinmesini kabul ediyorum.</span>
          </label>
          <div className="small muted">Yüklenen ses en fazla 1 saat, hazırlanan dosya en fazla 30 dakika tutulur; indirildiğinde veya işlem bittiğinde hemen silinir{forVideo ? " (video için hazırlanan ses, indirildikten sonra da en fazla 30 dakika sunucuda kalır)" : ""}. Günlük 10 dışa aktarma hakkın var{remaining !== null ? ` (bugün kalan: ${remaining})` : ""}.</div>
        </div>
      )}

      <div className="row">
        {!busy
          ? <button className="btn primary" disabled={!take || (!local && !consent)} onClick={() => void run()}>{local ? "Cihazımda oluştur ve indir" : "Dışa aktar"}</button>
          : <button className="btn" onClick={cancel}>Vazgeç</button>}
      </div>

      <div aria-live="polite" role="status" style={{ marginTop: 12 }}>
        {busy && (<>
          <p><b>{STEP_TEXT[phase] ?? "Çalışıyor…"}</b></p>
          {(phase === "render" || phase === "upload") && <div className="meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}><div style={{ width: progress * 100 + "%" }} /></div>}
          {phase === "render" && <p className="small muted">%{Math.round(progress * 100)} — uzun kayıtlarda birkaç dakika sürebilir; sekmeyi açık tut.</p>}
        </>)}
        {err && <div className="alert" role="alert">{err}</div>}
        {result && (phase === "ready" || phase === "local-ready") && (
          <div className="note">
            <span>✓ <b>{result.name}</b> hazır. {result.note}{" "}
              {phase === "local-ready" && result.url && <a href={result.url} download={result.name} style={{ color: "var(--accent)" }}>Tekrar indir</a>}
              {phase === "ready" && <button className="btn ghost" style={{ minHeight: 44, padding: "8px 14px" }} onClick={() => void redownload()}>İndirme başlamadıysa tekrar dene</button>}
            </span>
          </div>
        )}
      </div>
    </section>
    {videoData && take && <VideoPanel draft={draft} audioRef={videoData.audioRef} audioInfo={videoData.audioInfo} analysis={videoData.analysis} fx={fxFor} />}
    </>
  );
}

function Slider({ id, label, value, min, max, step, unit, onChange, hint }: { id: string; label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void; hint?: string }) {
  return (
    <div>
      <label htmlFor={id}>{label}: <b>{value}{unit}</b></label>
      <input id={id} type="range" min={min} max={max} step={step} value={value} aria-describedby={hint ? id + "-h" : undefined} onChange={(e) => onChange(+e.target.value)} />
      {hint && <div id={id + "-h"} className="small muted">{hint}</div>}
    </div>
  );
}
