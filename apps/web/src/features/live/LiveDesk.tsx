import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Performance, Project } from "@siir/contracts";
import { Desk } from "../../audio/broadcast/desk";
import { getSettings, updateSettings, useSettings } from "../../shared/settings";
import { fmt, parsePoem } from "../../shared/util";
import { getLocalTrackBlob, type LocalTrack } from "../../storage/music";
import { getProcessedVoice, listPerformances, takeExists } from "../../storage/performances";
import { listSfx, type SfxItem } from "../../storage/sfx";
import type { Actions } from "../../shell/types";
import type { LocalData } from "../../shared/useLocalData";
import { useLocalTracks } from "../LocalMusic";
import { LibraryPanel } from "./LiveSide";
import { MixerStrip } from "./Mixer";
import { Soundboard } from "./Soundboard";
import { Teleprompter, type TeleHandle } from "./Teleprompter";

type Mode = "live" | "recorded";
/** Kayıtlı şiirdeki fon seviyesi (dB, miks ayarı) → kaydırıcı konumu (0–1). */
const sliderFromDb = (db: number) => Math.min(1, Math.sqrt(Math.pow(10, (db + 9) / 20)));
const wordsOf = (t: string) => (t.match(/\S+/g) ?? []).length;

/**
 * Canlı Yayın Masası. İki çalışma biçimi: Canlı Oku (kayıt YOK) ve Kayıtlı Şiiri Çal.
 * Ekranın ana alanı şiirdir; kütüphane solda tek panelde, ses masası altta ince şeritte, efektler köşedeki düğmeyle açılır.
 * Ses, bilgisayarın normal çıkışına gider; OBS / TikTok LIVE Studio / sanal ses kablosu bağlantıları bu sürümde yoktur.
 */
export function LiveDesk({ data, initialPerformance, onConsumed }: { data: LocalData; actions?: Actions; initialPerformance?: Performance | null; onConsumed?: () => void }) {
  const settings = useSettings(), bc = settings.broadcast;
  const [desk, setDesk] = useState<Desk | null>(null);
  const [tick, setTick] = useState(0);
  const [warning, setWarning] = useState("");
  const [err, setErr] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const tele = useRef<TeleHandle>(null);

  const [mode, setMode] = useState<Mode>("live");
  const [poem, setPoem] = useState<Project | null>(null);
  const [speed, setSpeed] = useState(settings.reading.speed);
  const [fontScale, setFontScale] = useState(1.5);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [big, setBig] = useState(false);          // tam ekran (yan panel ve uygulama menüsü gizlenir)
  const [libOpen, setLibOpen] = useState(true);
  const [fxOpen, setFxOpen] = useState(false);
  const [musicTrack, setMusicTrack] = useState<LocalTrack | null>(null);
  const [perf, setPerf] = useState<Performance | null>(null);
  const [perfBusy, setPerfBusy] = useState("");
  const [bgOn, setBgOn] = useState(true);
  const [pos, setPos] = useState(0);
  const [micErr, setMicErr] = useState("");
  const [performances, setPerformances] = useState<Performance[]>([]);
  const [sfx, setSfx] = useState<SfxItem[] | null>(null);
  const mine = useLocalTracks();
  const perfRef = useRef<Performance | null>(null); perfRef.current = perf;

  const reloadSfx = useCallback(() => { void listSfx().then(setSfx).catch(() => setSfx([])); }, []);
  useEffect(() => { void listPerformances().then(setPerformances).catch(() => setPerformances([])); reloadSfx(); }, [reloadSfx]);

  // Masa: sayfadan ayrılırken (bileşen kapanınca veya sayfa gizlenince) çalışan bütün ses kaynakları kapatılır.
  useEffect(() => {
    const d = new Desk(getSettings().broadcast, { onChange: () => setTick((n) => n + 1), onWarning: setWarning });
    d.onVoiceEnded = () => { const p = perfRef.current; if (p) d.stopMusic(Math.max(1, p.mixSettings.music.fadeOutSec)); };
    setDesk(d);
    const off = () => d.dispose();
    window.addEventListener("pagehide", off);
    return () => { window.removeEventListener("pagehide", off); d.dispose(); setDesk(null); };
  }, []);

  // Tam ekran: uygulama kabuğu da gizlenir; tarayıcı tam ekranı varsa ona da geçer. Esc ikisinden de çıkarır.
  useEffect(() => { const f = () => { if (!document.fullscreenElement) setBig(false); }; document.addEventListener("fullscreenchange", f); return () => document.removeEventListener("fullscreenchange", f); }, []);
  useEffect(() => { document.body.classList.toggle("live-big", big); return () => document.body.classList.remove("live-big"); }, [big]);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape" && fxOpen) setFxOpen(false); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [fxOpen]);
  const toggleBig = () => {
    if (big) { setBig(false); if (document.fullscreenElement) void document.exitFullscreen(); }
    else { setBig(true); void root.current?.requestFullscreen?.().catch(() => {}); }
  };
  useEffect(() => { if (!running) return; const t0 = performance.now() - elapsed; const i = setInterval(() => setElapsed(performance.now() - t0), 250); return () => clearInterval(i); }, [running]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!desk || mode !== "recorded") return; const i = setInterval(() => setPos(desk.voicePosition), 120); return () => clearInterval(i); }, [desk, mode]);

  const poems = data.projects ?? [];
  const tracks = mine.tracks ?? [];

  // ---------- Canlı okuma ----------
  const pickPoem = useCallback((p: Project) => {
    setMode("live"); setPoem(p); setRunning(false); setElapsed(0); setLibOpen(false);
    setSpeed(p.reading?.speed ?? getSettings().reading.speed); setFontScale(Math.max(1.2, (p.reading?.fontScale ?? 1) * 1.5));
  }, []);
  const toggleScroll = () => setRunning((r) => { if (r) return false; void desk?.resume(); return true; });

  const playTrack = useCallback(async (t: LocalTrack) => {
    if (!desk) return;
    setMusicTrack(t); setErr("");
    try { await desk.playMusic(await getLocalTrackBlob(t.id), t.id, { startSec: 0, fadeInSec: 2 }); } catch (e) { setErr(e instanceof Error ? e.message : "Fon çalınamadı."); }
  }, [desk]);

  // ---------- Kayıtlı şiir ----------
  const startBg = useCallback(async (p: Performance, at = 0) => {
    if (!desk || !p.backgroundTrackId || !p.backgroundTrackId.startsWith("loc_")) return;
    try { await desk.playMusic(await getLocalTrackBlob(p.backgroundTrackId), p.backgroundTrackId, { startSec: p.mixSettings.music.startOffsetSec + at, fadeInSec: at > 0 ? 0.5 : p.mixSettings.music.fadeInSec }); }
    catch (e) { setErr(e instanceof Error ? e.message : "Fon çalınamadı."); }
  }, [desk]);
  const loadPerf = useCallback(async (p: Performance, autoplay: boolean) => {
    if (!desk) return;
    setErr(""); setMode("recorded"); setRunning(false); setPerf(p); setLibOpen(false);
    if (!(await takeExists(p))) { setErr("Bu kaydın ses denemesi silinmiş; çalınamaz."); return; }
    setPerfBusy("İşlenmiş ses hazırlanıyor…");
    try {
      const blob = await getProcessedVoice(p, (f) => setPerfBusy(`İşlenmiş ses hazırlanıyor… %${Math.round(f * 100)}`));
      desk.stopMusic(0); await desk.loadVoice(blob, p.id);
      desk.setVolume("music", sliderFromDb(p.mixSettings.music.gainDb));
      const hasBg = !!p.backgroundTrackId; setBgOn(hasBg);
      const poemOf = data.projects?.find((x) => x.id === p.poemId); if (poemOf) setPoem(poemOf);
      setSpeed(p.teleprompterSettings.speed); setFontScale(Math.max(1.2, p.teleprompterSettings.fontScale * 1.5));
      if (autoplay) { await desk.playVoice(); if (hasBg) await startBg(p); }
    } catch (e) { setErr(e instanceof Error ? e.message : "Kayıtlı şiir hazırlanamadı."); }
    finally { setPerfBusy(""); }
  }, [desk, data.projects, startBg]);
  const voiceToggle = async () => {
    if (!desk || !perf) return;
    if (desk.voicePlaying) { desk.pauseVoice(); desk.pauseMusic(); }
    else { await desk.playVoice(); if (bgOn) { if (desk.musicId) await desk.resumeMusic(); else await startBg(perf, desk.voicePosition); } }
  };
  const musicToggle = async () => {
    if (!desk) return;
    if (desk.musicPlaying) desk.pauseMusic();
    else if (desk.musicId) await desk.resumeMusic();
    else if (mode === "recorded" && perf?.backgroundTrackId && bgOn) await startBg(perf, desk.voicePosition);
    else if (musicTrack) await playTrack(musicTrack);
  };
  const toggleBg = async (on: boolean) => {
    setBgOn(on); if (!desk || !perf) return;
    if (!on) desk.stopMusic(1); else if (desk.voicePlaying) await startBg(perf, desk.voicePosition);
  };
  const restart = async () => {
    if (!desk || !perf) return;
    desk.restartVoice(); desk.stopMusic(0);
    if (desk.voicePlaying && bgOn) await startBg(perf, 0);
  };

  // "Yayında çal" ile gelindiyse kayıtlı şiir hazırlanır (otomatik başlamaz; yayıncı başlatır).
  const consumed = useRef("");
  useEffect(() => {
    if (!initialPerformance || !desk || consumed.current === initialPerformance.id) return;
    consumed.current = initialPerformance.id;
    void loadPerf(initialPerformance, false).finally(() => onConsumed?.());
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const panic = () => { desk?.panic(); setRunning(false); };
  const micToggle = async () => { if (!desk) return; setMicErr(""); try { if (desk.micOn) desk.closeMic(); else await desk.openMic(); } catch { setMicErr("Mikrofon açılamadı. İzin verilmemiş veya kullanımda olabilir."); } };

  const stanzas = useMemo(() => parsePoem(poem?.text ?? "").stanzas, [poem?.text]);
  const activeLine = useMemo(() => {
    if (mode !== "recorded" || !perf) return undefined;
    const ms = pos * 1000; let cur: string | null = null;
    for (const x of perf.captionTiming.timings) if (ms >= x.startMs) cur = x.lineId;
    return cur;
  }, [mode, perf, pos]);
  const estimate = Math.round((wordsOf(poem?.text ?? "") / 2.2) * 1000);

  if (!desk) return <div className="live-root dark"><p className="muted">Yayın masası hazırlanıyor…</p></div>;
  const sfxActive = desk.anySfxPlaying;
  return (
    <div ref={root} className={"live-root" + (bc.darkMode ? " dark" : "") + (big ? " big" : "")} data-testid="live-desk">
      <header className="live-top">
        <div className="live-modes" role="tablist" aria-label="Çalışma biçimi">
          {([["live", "Canlı Oku"], ["recorded", "Kayıtlı Şiiri Çal"]] as const).map(([id, l]) => (
            <button key={id} role="tab" aria-selected={mode === id} className="btn" onClick={() => setMode(id)}>{l}</button>
          ))}
        </div>
        <span className={"live-badge" + (mode === "live" ? " nr" : "")} role="status" data-testid="live-badge">
          {mode === "live" ? "● Canlı Okuma — Kayıt yapılmıyor" : "▶ Kayıtlı şiir çalınıyor — yeni kayıt oluşmaz"}
        </span>
        <span className="live-top-r">
          <button className="btn" onClick={() => setLibOpen((o) => !o)} aria-pressed={libOpen}>📚 Kütüphane</button>
          <button className={"btn" + (sfxActive ? " on" : "")} onClick={() => setFxOpen((o) => !o)} aria-pressed={fxOpen} data-testid="fx-toggle">✨ Efektler{sfxActive ? " ●" : ""}</button>
          <button className="btn" onClick={() => updateSettings((s) => ({ ...s, broadcast: { ...s.broadcast, darkMode: !s.broadcast.darkMode } }))} aria-pressed={bc.darkMode} aria-label="Karanlık mod">🌙</button>
          <button className="btn" onClick={toggleBig} aria-pressed={big}>{big ? "⤓ Küçült" : "⛶ Tam ekran"}</button>
          <button className="btn danger live-stop" onClick={panic} data-testid="panic">■ Tüm Sesleri Durdur</button>
        </span>
      </header>
      {err && <div className="alert" role="alert" style={{ margin: 0 }}>{err}</div>}

      <div className={"live-body" + (libOpen ? "" : " lib-closed")}>
        {libOpen && (
          <aside className="live-lib" aria-label="Kütüphane paneli">
            <LibraryPanel poems={poems} performances={performances} tracks={tracks}
              poemId={poem?.id ?? null} perfId={perf?.id ?? null} trackId={musicTrack?.id ?? null} musicPlayingId={desk.musicPlaying ? desk.musicId : null}
              onPoem={pickPoem} onPerf={(p) => void loadPerf(p, false)} onMusic={(t) => { if (desk.musicPlaying && desk.musicId === t.id) { desk.stopMusic(1); setMusicTrack(t); } else void playTrack(t); }} />
          </aside>
        )}
        <main className="live-stage">
          <div className="live-meta">
            <b className="live-name">{poem?.title || perf?.title || "Şiir seçilmedi — soldaki kütüphaneden seç"}</b>
            {(poem?.mix.poet || perf?.poet) && <span className="muted">{poem?.mix.poet || perf?.poet}</span>}
            {mode === "live" && <span className="muted small">Okuma süresi <b>{fmt(elapsed)}{estimate ? ` / ≈${fmt(estimate)}` : ""}</b></span>}
            <span className="muted small">Fon: <b>{mode === "recorded" && perf?.backgroundTrackId ? (bgOn ? "kayıtlı şiirin fonu" : "kapalı") : musicTrack?.title ?? "yok"}</b>{desk.musicPlaying ? " ▶ çalıyor" : musicTrack ? " (durdu)" : ""}</span>
          </div>
          <Teleprompter ref={tele} title={poem?.title ?? perf?.title ?? ""} poet={poem?.mix.poet ?? perf?.poet ?? ""} stanzas={stanzas}
            fontScale={fontScale} speed={speed} running={mode === "live" && running} activeLineId={mode === "recorded" ? (activeLine ?? null) : undefined} resetKey={(poem?.id ?? "") + (perf?.id ?? "")} />
          {mode === "live" ? (
            <div className="tele-ctl">
              <button className="btn primary big" onClick={toggleScroll} disabled={!poem} aria-pressed={running}>{running ? "⏸ Kaydırmayı durdur" : "▶ Otomatik kaydır"}</button>
              <button className="btn" onClick={() => tele.current?.stanza(-1)}>← Önceki kıta</button>
              <button className="btn" onClick={() => tele.current?.stanza(1)}>Sonraki kıta →</button>
              <label className="fs-l">Hız {speed}<input type="range" min={8} max={90} value={speed} aria-label="Kaydırma hızı" onChange={(e) => setSpeed(+e.target.value)} /></label>
              <label className="fs-l">Yazı {Math.round(fontScale * 100)}%<input type="range" min={80} max={320} step={5} value={Math.round(fontScale * 100)} aria-label="Yazı büyüklüğü" onChange={(e) => setFontScale(+e.target.value / 100)} /></label>
            </div>
          ) : (
            <div className="tele-ctl">
              {perfBusy && <span role="status">{perfBusy}</span>}
              <button className="btn primary big" onClick={() => void voiceToggle()} disabled={!perf || !desk.voiceLoaded}>{desk.voicePlaying ? "⏸ Duraklat" : "▶ Oynat"}</button>
              <button className="btn" onClick={() => void restart()} disabled={!desk.voiceLoaded}>⏮ Baştan başlat</button>
              <label className="fs-l" style={{ flex: "2 1 220px" }}>{fmt(pos * 1000)} / {fmt(desk.voiceDuration * 1000)}
                <input type="range" min={0} max={Math.max(1, Math.round(desk.voiceDuration * 10))} value={Math.round(pos * 10)} aria-label="Oynatma konumu" onChange={(e) => { desk.seekVoice(+e.target.value / 10); setPos(+e.target.value / 10); }} /></label>
              <label className="row chk" style={{ margin: 0 }}><input type="checkbox" checked={bgOn} disabled={!perf?.backgroundTrackId} onChange={(e) => void toggleBg(e.target.checked)} /> Fonlu oynat{perf?.backgroundTrackId ? "" : " (fon yok)"}</label>
              <label className="fs-l">Yazı {Math.round(fontScale * 100)}%<input type="range" min={80} max={320} step={5} value={Math.round(fontScale * 100)} aria-label="Yazı büyüklüğü" onChange={(e) => setFontScale(+e.target.value / 100)} /></label>
            </div>
          )}
        </main>
      </div>

      <MixerStrip desk={desk} tick={tick} warning={warning}
        mic={{ on: desk.micOn, toggle: () => void micToggle(), err: micErr }}
        music={{ playing: desk.musicPlaying, toggle: () => void musicToggle(), can: !!(musicTrack || desk.musicId || (mode === "recorded" && perf?.backgroundTrackId)), label: mode === "recorded" && perf?.backgroundTrackId ? (bgOn ? "kayıtlı şiirin fonu" : "fon kapalı") : musicTrack?.title ?? "" }}
        voice={{ playing: desk.voicePlaying, toggle: () => void voiceToggle(), can: desk.voiceLoaded, label: perf?.title ?? "" }}
        onStopSfx={() => { for (const s of sfx ?? []) desk.stopSfx(s.id); }}
        ducking={{ enabled: desk.ducker.cfg.enabled, set: (on) => desk.setDuck({ enabled: on }) }}
        micToOutput={{ on: desk.micToOutput, set: (on) => desk.setMicToOutput(on) }} />

      {/* Efekt paneli köşedeki düğmeyle açılır; kapalıyken de bağlı kalır, böylece klavye kısayolları çalışmaya devam eder. */}
      <section className="fx-sheet" hidden={!fxOpen} aria-label="Ses efektleri paneli">
        <div className="row between"><h2 className="h3" style={{ margin: 0 }}>Ses efektleri</h2><button className="btn" onClick={() => setFxOpen(false)} aria-label="Efekt panelini kapat">✕ Kapat</button></div>
        <Soundboard desk={desk} items={sfx} tick={tick} onChanged={reloadSfx} onError={setErr} />
      </section>
    </div>
  );
}
