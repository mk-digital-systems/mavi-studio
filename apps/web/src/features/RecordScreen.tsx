import { useCallback, useEffect, useRef, useState } from "react";
import type { Take } from "@siir/contracts";
import type { Draft, Patch } from "../App";
import { MicRecorder, MAX_MS, type RecResult } from "../audio/recorder";
import { PreviewPlayer } from "../audio/preview";
import { tr } from "../shared/tr";
import { fmt, parsePoem } from "../shared/util";
import { guard } from "../shared/prefs";
import { getSettings, updateSettings } from "../shared/settings";
import { wakeLock } from "../shared/wakeLock";
import { deleteTake, putChunk, putTake } from "../storage/repo";
import { requestPersist, spaceLevel, storageInfo } from "../storage/quota";

type P = {
  draft: Draft; patch: Patch; takes: Take[]; reloadTakes: () => Promise<void>;
  ensureSaved: () => Promise<void>; back: () => void; next: () => void;
};
type Phase = "idle" | "ready" | "countdown" | "recording" | "paused" | "done";

export function RecordScreen({ draft, patch, takes, reloadTakes, ensureSaved, back, next }: P) {
  const rec = useRef<MicRecorder>(null as unknown as MicRecorder);
  const music = useRef<PreviewPlayer>(null as unknown as PreviewPlayer);
  if (!rec.current) { rec.current = new MicRecorder(); music.current = new PreviewPlayer(); }
  const reader = useRef<HTMLDivElement>(null);
  const prefs = useRef(getSettings());
  const take = useRef<Take | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState(prefs.current.audio.deviceId);
  const [level, setLevel] = useState(-120);
  const [clip, setClip] = useState(false);
  const [count, setCount] = useState(0);
  const [countFrom, setCountFrom] = useState<number>(prefs.current.audio.countdownSec);
  const [elapsed, setElapsed] = useState(0);
  const [speed, setSpeed] = useState(draft.reading?.speed ?? prefs.current.reading.speed);
  const [autoScroll, setAutoScroll] = useState(prefs.current.reading.autoScroll);
  const [fs, setFs] = useState(false);
  const [monitor, setMonitor] = useState(false);
  const [bgWarn, setBgWarn] = useState("");
  const [interrupted, setInterrupted] = useState(false);
  const phaseRef = useRef<Phase>("idle");
  phaseRef.current = phase;
  const live = useRef({ draft, takes, patch, reloadTakes });
  live.current = { draft, takes, patch, reloadTakes };
  const poem = parsePoem(draft.text);

  const refreshDevices = useCallback(async () => {
    setDevices((await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "audioinput"));
  }, []);

  useEffect(() => {
    const r = rec.current, m = music.current;
    r.onLevel = (db, c) => { setLevel(db); setClip(c); };
    r.onEnd = async (res: RecResult) => {
      m.stop(); guard.recording = false; setMonitor(false); wakeLock.release(); setBgWarn(""); setInterrupted(false);
      const t = take.current; take.current = null;
      if (t) {
        if (res.durationMs < 1000) await deleteTake(t.id); // çok kısa kayıt atılır
        else {
          await putTake({ ...t, status: "complete", durationMs: res.durationMs, chunkCount: res.chunkCount, peakDbfs: res.peakDbfs, clipped: res.clipped });
          const { draft: d, patch: p } = live.current;
          p({ primaryTakeId: d.primaryTakeId ?? t.id, status: "recorded" });
        }
        await live.current.reloadTakes();
      }
      setInfo(
        res.reason === "device" ? tr.errors.deviceLost :
        res.reason === "limit" ? tr.errors.limit :
        res.reason === "storage" ? tr.errors.storage : "",
      );
      setPhase("done");
    };
    // Kesinti: bağlam çalışmaz hale gelirse bildir; sekme tekrar görününce sürdürmeyi dene.
    r.onStateChange = (st) => { if (st !== "running") setInterrupted(true); else setInterrupted(false); };
    let hidden = false;
    const vis = () => {
      const live = phaseRef.current === "recording" || phaseRef.current === "paused";
      if (document.visibilityState === "hidden") { if (live) hidden = true; return; }
      if (hidden && live) { hidden = false; setBgWarn(tr.errors.background); void r.resumeContext().then((ok) => setInterrupted(!ok)); }
    };
    document.addEventListener("visibilitychange", vis);
    const dc = () => void refreshDevices();
    navigator.mediaDevices.addEventListener("devicechange", dc);
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", dc);
      document.removeEventListener("visibilitychange", vis); wakeLock.release();
      // Ekrandan çıkılırken devam eden kayıt sessizce kaybolmasın: parçalar zaten diskte, kurtarma banner'ı çıkar.
      r.onEnd = () => {}; r.close(); m.stop(); guard.recording = false;
    };
  }, [refreshDevices]);

  useEffect(() => {
    if (phase !== "recording") return;
    const t = setInterval(() => setElapsed(rec.current.elapsedMs), 200);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== "recording" || !autoScroll) return;
    let raf = 0, last = performance.now(), pos = reader.current?.scrollTop ?? 0;
    const tick = (now: number) => {
      pos += (speed * (now - last)) / 1000; last = now;
      if (reader.current) reader.current.scrollTop = pos;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, autoScroll, speed]);

  const open = async (id?: string) => {
    setErr(""); setMonitor(false); // canlı dinleme her zaman kapalı başlar
    try {
      await rec.current.open(id || deviceId || undefined);
      await refreshDevices();
      const cur = rec.current.deviceId ?? "";
      setDeviceId(cur); updateSettings((s) => ({ ...s, audio: { ...s.audio, deviceId: cur } }));
      setPhase("ready");
    } catch (e) { setErr(tr.errors[(e as DOMException).name] ?? tr.errors.generic); }
  };

  const begin = async () => {
    setInfo(""); setErr(""); setElapsed(0);
    const sp = spaceLevel(await storageInfo());
    if (sp === "blocked") { setErr(tr.errors.noSpace); return; }
    if (sp === "low") setInfo(tr.errors.lowSpace);
    void requestPersist();
    if (reader.current) reader.current.scrollTop = 0;
    if (countFrom > 0) {
      setPhase("countdown");
      for (let n = countFrom; n > 0; n--) {
        setCount(n);
        await new Promise((r) => setTimeout(r, 1000));
        if (phaseRef.current !== "countdown") return;
      }
    }
    try {
      await ensureSaved(); // takes → project ilişkisi için proje diskte olmalı
      const t: Take = {
        id: crypto.randomUUID(), projectId: draft.id, createdAt: new Date().toISOString(), status: "recording",
        durationMs: 0, sampleRate: rec.current.sampleRate, channels: 1, chunkCount: 0, peakDbfs: -120, clipped: false,
      };
      await putTake(t); take.current = t;
      rec.current.sink = (bytes, seq) => putChunk(t.id, seq, bytes);
      if (draft.trackId) await music.current.play(draft.trackId).catch(() => setInfo("Fon müziği çalınamadı; kayıt müziksiz devam ediyor."));
      await rec.current.start();
      guard.recording = true; void wakeLock.acquire(); // ekran uyumasın
      setPhase("recording");
    } catch {
      if (take.current) { await deleteTake(take.current.id).catch(() => {}); take.current = null; }
      setErr(tr.errors.generic); setPhase("ready");
    }
  };
  const pause = () => { rec.current.pause(); music.current.stop(); setPhase("paused"); };
  const resume = () => {
    rec.current.resume();
    if (draft.trackId) void music.current.play(draft.trackId).catch(() => {});
    setPhase("recording");
  };
  const again = async () => { setPhase("idle"); setErr(""); await open(); };

  // Klavye: odaktaki düğme ekrandan kalkarsa (ör. "Kaydı başlat" → "Duraklat") odak gövdeye düşmesin.
  useEffect(() => {
    if (phase === "idle" || phase === "countdown") return;
    const t = setTimeout(() => {
      if (!document.activeElement || document.activeElement === document.body) document.querySelector<HTMLElement>("[data-af]")?.focus();
    }, 60);
    return () => clearTimeout(t);
  }, [phase]);
  const active = phase === "recording" || phase === "paused";
  const pct = Math.max(0, Math.min(100, ((level + 60) / 60) * 100));
  const nearLimit = elapsed > MAX_MS - 60_000;

  return (
    <>
      {phase === "countdown" && (
        <div className="countdown" role="alert" aria-live="assertive">
          <span>{count}</span>
          <button className="btn" style={{ position: "absolute", bottom: 40, fontSize: "1rem" }} onClick={() => setPhase("ready")}>Vazgeç</button>
        </div>
      )}
      <section className="card">
        <h1 className="h2">Kayıt</h1>
        {takes.filter((t) => t.status === "complete").length > 0 && phase !== "done" && (
          <p className="muted small">Bu şiirde {takes.filter((t) => t.status === "complete").length} kayıtlı deneme var. Yeni kayıt yenisini ekler.</p>
        )}
        {err && <div className="alert" role="alert">{err}</div>}
        {info && <div className="warn" role="status">{info}</div>}

        {phase === "idle" && (
          <>
            <p className="muted">{tr.micExplain} Fon müziği kayda karışmasın diye <b>kulaklık</b> kullanmanı öneririz.</p>
            <button className="btn primary" onClick={() => void open()}>Mikrofonu aç ve seviyeyi dene</button>
          </>
        )}

        {(phase === "ready" || active) && (
          <div className="row between" style={{ marginBottom: 12 }}>
            <div style={{ flex: "1 1 220px" }}>
              <label htmlFor="mic">Mikrofon</label>
              <select id="mic" value={deviceId} disabled={active} onChange={(e) => void open(e.target.value)}>
                {devices.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Mikrofon ${i + 1}`}</option>)}
              </select>
            </div>
            <div style={{ flex: "1 1 160px" }}>
              <label htmlFor="cd">Geri sayım</label>
              <select id="cd" value={countFrom} disabled={active} onChange={(e) => { setCountFrom(+e.target.value); updateSettings((s) => ({ ...s, audio: { ...s.audio, countdownSec: +e.target.value as 0 | 3 | 5 } })); }}>
                <option value={0}>Yok</option><option value={3}>3 sn</option><option value={5}>5 sn</option>
              </select>
            </div>
          </div>
        )}

        {(phase === "ready" || active) && (
          <div style={{ margin: "4px 0 10px" }}>
            <label className="row chk"><input type="checkbox" checked={monitor} onChange={(e) => { setMonitor(e.target.checked); rec.current.setMonitor(e.target.checked); }} /> Kendi sesimi kulaklıkta duy (canlı dinleme)</label>
            {monitor && <div className="warn" role="alert" style={{ marginTop: 8 }}>🎧 <b>Yalnızca kulaklıkla kullan.</b> Hoparlörde açarsan ses mikrofona geri girer ve çınlama olur. Duyduğun ses işlenmemiş, hafif gecikmeli olabilir; kayda girmez.</div>}
          </div>
        )}

        {(phase === "ready" || active) && (
          <>
            <div className={"meter" + (clip ? " clip" : "")} role="meter" aria-label="Giriş seviyesi" aria-valuemin={-60} aria-valuemax={0} aria-valuenow={Math.round(level)}>
              <div style={{ width: pct + "%" }} />
            </div>
            <p className="small muted" aria-live="polite">
              {level < -45 ? "Ses çok düşük veya yok — mikrofona yaklaş." : clip ? "Çok yüksek! Mikrofondan biraz uzaklaş." : level > -12 ? "Yüksek ama kabul edilebilir." : "Seviye iyi."}
            </p>
          </>
        )}

        {active && (
          <div className="row between" style={{ margin: "10px 0" }}>
            <div className="timer">{phase === "recording" && <span className="rec-dot" aria-hidden />} {fmt(elapsed)}</div>
            <span className="muted small">{phase === "paused" ? "Duraklatıldı" : "Kayıtta"} · sınır {fmt(MAX_MS)}</span>
          </div>
        )}
        {bgWarn && active && <div className="warn" role="alert">{bgWarn} <button className="btn ghost" style={{ minHeight: 36, padding: "2px 12px" }} onClick={() => setBgWarn("")}>Tamam</button></div>}
        {interrupted && active && (
          <div className="alert" role="alert">{tr.errors.interrupted}{" "}
            <button className="btn" onClick={() => void rec.current.resumeContext().then((ok) => setInterrupted(!ok))}>Devam ettir</button></div>
        )}
        {!wakeLock.supported && active && <p className="small muted">Bu tarayıcı ekranı açık tutamıyor: kayıt sırasında ekranın kapanmasını önlemek için ayarlardan uyku süresini uzat.</p>}
        {nearLimit && active && <div className="warn" role="status">15 dakikalık sınıra yaklaşıyorsun.</div>}

        {phase === "done" && (
          <>
            <p>✓ Deneme bu cihaza kaydedildi. Dinleyebilir veya yeni bir deneme alabilirsin.</p>
            <div className="row">
              <button className="btn primary" data-af onClick={next}>Dinle →</button>
              <button className="btn" onClick={() => void again()}>Yeni deneme al</button>
            </div>
          </>
        )}
      </section>

      {(phase === "ready" || active || phase === "countdown") && (
        <section className="card">
          <div className="row between" style={{ marginBottom: 10 }}>
            <h2 className="h3" style={{ margin: 0 }}>Okuma ekranı</h2>
            <div className="row">
              <label className="row chk" style={{ margin: 0 }}>
                <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} /> Otomatik kaydır
              </label>
              <button className="btn ghost" style={{ minHeight: 40, padding: "6px 14px" }} onClick={() => setFs(!fs)}>{fs ? "Küçült" : "Tam ekran"}</button>
            </div>
          </div>
          <div ref={reader} className={"reader" + (fs ? " fs" : "")} tabIndex={0} aria-label="Şiir metni" style={{ ["--rs" as string]: prefs.current.reading.fontScale, ["--rl" as string]: prefs.current.reading.lineHeight }}>
            {fs && <button className="btn" style={{ position: "fixed", top: 12, right: 12 }} onClick={() => setFs(false)}>Kapat</button>}
            <h3>{draft.title}</h3>
            {poem.stanzas.map((s) => (
              <div key={s.id} className="stanza">{s.lines.map((l) => <div key={l.id} className="line">{l.text}</div>)}</div>
            ))}
          </div>
          <label htmlFor="spd" style={{ marginTop: 12 }}>Kaydırma hızı</label>
          <input id="spd" type="range" min={8} max={90} value={speed} onChange={(e) => { setSpeed(+e.target.value); patch({ reading: { speed: +e.target.value } }); }} />
        </section>
      )}

      <div className="bar"><div className="inner">
        <button className="btn" disabled={active || phase === "countdown"} onClick={back}>← Fon</button>
        {phase === "ready" && <button className="btn primary" data-af onClick={() => void begin()}>● Kaydı başlat</button>}
        {phase === "recording" && (<>
          <button className="btn" data-af onClick={pause}>Duraklat</button>
          <button className="btn danger" onClick={() => rec.current.stop()}>Bitir</button>
        </>)}
        {phase === "paused" && (<>
          <button className="btn primary" data-af onClick={resume}>Devam</button>
          <button className="btn danger" onClick={() => rec.current.stop()}>Bitir</button>
        </>)}
        {phase === "done" && takes.length > 0 && <button className="btn primary" onClick={next}>Dinle →</button>}
      </div></div>
    </>
  );
}
