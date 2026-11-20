import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Performance, Project } from "@siir/contracts";
import { Desk } from "../../audio/broadcast/desk";
import { nextIndex, prevIndex } from "../../audio/broadcast/ducking";
import { getSettings, updateSettings, useSettings } from "../../shared/settings";
import { fmt, parsePoem } from "../../shared/util";
import { deleteFlow, listFlows, newFlow, saveFlow, type Flow, type FlowItem } from "../../storage/flows";
import { getLocalTrackBlob, type LocalTrack } from "../../storage/music";
import { getProcessedVoice, listPerformances, takeExists } from "../../storage/performances";
import { listSfx, type SfxItem } from "../../storage/sfx";
import type { Actions } from "../../shell/types";
import type { LocalData } from "../../shared/useLocalData";
import { useLocalTracks } from "../LocalMusic";
import { Library, FlowRail } from "./LiveSide";
import { Mixer } from "./Mixer";
import { Soundboard } from "./Soundboard";
import { Teleprompter, type TeleHandle } from "./Teleprompter";

type Mode = "live" | "recorded" | "flow";
type View = "live" | "recorded" | "banner";
/** Kayıtlı şiirdeki fon seviyesi (dB, miks ayarı) → kaydırıcı konumu (0–1). */
const sliderFromDb = (db: number) => Math.min(1, Math.sqrt(Math.pow(10, (db + 9) / 20)));
const wordsOf = (t: string) => (t.match(/\S+/g) ?? []).length;

/**
 * Canlı Yayın Masası. Üç çalışma biçimi: Canlı Oku (kayıt YOK), Kayıtlı Şiiri Çal, Yayın Akışı.
 * Ses, bilgisayarın normal çıkışına gider; OBS / TikTok LIVE Studio / sanal ses kablosu bağlantıları bu sürümde yoktur.
 */
export function LiveDesk({ data, actions, initialPerformance, onConsumed }: { data: LocalData; actions: Actions; initialPerformance?: Performance | null; onConsumed?: () => void }) {
  const settings = useSettings(), bc = settings.broadcast;
  const [desk, setDesk] = useState<Desk | null>(null);
  const [tick, setTick] = useState(0);
  const [warning, setWarning] = useState("");
  const [err, setErr] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const tele = useRef<TeleHandle>(null);

  const [mode, setMode] = useState<Mode>("live");
  const [view, setView] = useState<View>("live");
  const [banner, setBanner] = useState<{ title: string; text: string } | null>(null);
  const [poem, setPoem] = useState<Project | null>(null);
  const [speed, setSpeed] = useState(settings.reading.speed);
  const [fontScale, setFontScale] = useState(1.3);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [fs, setFs] = useState(false);
  const [musicTrack, setMusicTrack] = useState<LocalTrack | null>(null);
  const [perf, setPerf] = useState<Performance | null>(null);
  const [perfBusy, setPerfBusy] = useState("");
  const [bgOn, setBgOn] = useState(true);
  const [pos, setPos] = useState(0);
  const [micErr, setMicErr] = useState("");

  const [performances, setPerformances] = useState<Performance[]>([]);
  const [sfx, setSfx] = useState<SfxItem[] | null>(null);
  const [flows, setFlows] = useState<Flow[]>([]);
  const [flow, setFlow] = useState<Flow | null>(null);
  const [idx, setIdx] = useState(-1);
  const mine = useLocalTracks();
  const perfRef = useRef<Performance | null>(null); perfRef.current = perf;

  const reloadSfx = useCallback(() => { void listSfx().then(setSfx).catch(() => setSfx([])); }, []);
  const reloadFlows = useCallback(() => { void listFlows().then(setFlows).catch(() => setFlows([])); }, []);
  useEffect(() => { void listPerformances().then(setPerformances).catch(() => setPerformances([])); reloadSfx(); reloadFlows(); }, [reloadSfx, reloadFlows]);

  // Masa: sayfadan ayrılırken (bileşen kapanınca veya sayfa gizlenince) çalışan bütün ses kaynakları kapatılır.
  useEffect(() => {
    const d = new Desk(getSettings().broadcast, { onChange: () => setTick((n) => n + 1), onWarning: setWarning });
    d.onVoiceEnded = () => { const p = perfRef.current; if (p) d.stopMusic(Math.max(1, p.mixSettings.music.fadeOutSec)); };
    setDesk(d);
    const off = () => d.dispose();
    window.addEventListener("pagehide", off);
    return () => { window.removeEventListener("pagehide", off); d.dispose(); setDesk(null); };
  }, []);

  useEffect(() => { const f = () => setFs(document.fullscreenElement === root.current); document.addEventListener("fullscreenchange", f); return () => document.removeEventListener("fullscreenchange", f); }, []);
  useEffect(() => { if (!running) return; const t0 = performance.now() - elapsed; const i = setInterval(() => setElapsed(performance.now() - t0), 250); return () => clearInterval(i); }, [running]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!desk || view !== "recorded") return; const i = setInterval(() => setPos(desk.voicePosition), 120); return () => clearInterval(i); }, [desk, view]);

  // "Yayında çal" ile gelindiyse kayıtlı şiir hazırlanır (otomatik başlamaz; yayıncı başlatır).
  const consumed = useRef("");
  useEffect(() => {
    if (!initialPerformance || !desk || consumed.current === initialPerformance.id) return;
    consumed.current = initialPerformance.id; setMode("recorded");
    void loadPerf(initialPerformance, false).finally(() => onConsumed?.());
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const poems = data.projects ?? [];
  const tracks = mine.tracks ?? [];

  // ---------- Canlı okuma ----------
  const pickPoem = useCallback((p: Project) => {
    setView("live"); setMode((m) => (m === "flow" ? m : "live")); setPoem(p); setRunning(false); setElapsed(0);
    setSpeed(p.reading?.speed ?? getSettings().reading.speed); setFontScale(Math.max(1.1, p.reading?.fontScale ?? 1.3));
  }, []);
  const toggleScroll = () => setRunning((r) => { if (r) return false; void desk?.resume(); return true; });

  const playTrack = useCallback(async (t: LocalTrack) => {
    if (!desk) return;
    setMusicTrack(t); setErr("");
    try { await desk.playMusic(await getLocalTrackBlob(t.id), t.id, { startSec: 0, fadeInSec: 2 }); } catch (e) { setErr(e instanceof Error ? e.message : "Fon çalınamadı."); }
  }, [desk]);
  const musicToggle = async () => {
    if (!desk) return;
    if (desk.musicPlaying) desk.pauseMusic();
    else if (desk.musicId) await desk.resumeMusic();
    else if (perf?.backgroundTrackId && bgOn) await startBg(perf, desk.voicePosition);
    else if (musicTrack) await playTrack(musicTrack);
  };

  // ---------- Kayıtlı şiir ----------
  const startBg = useCallback(async (p: Performance, at = 0) => {
    if (!desk || !p.backgroundTrackId || !p.backgroundTrackId.startsWith("loc_")) return;
    try { await desk.playMusic(await getLocalTrackBlob(p.backgroundTrackId), p.backgroundTrackId, { startSec: p.mixSettings.music.startOffsetSec + at, fadeInSec: at > 0 ? 0.5 : p.mixSettings.music.fadeInSec }); }
    catch (e) { setErr(e instanceof Error ? e.message : "Fon çalınamadı."); }
  }, [desk]);
  const loadPerf = useCallback(async (p: Performance, autoplay: boolean) => {
    if (!desk) return;
    setErr(""); setView("recorded"); setRunning(false); setPerf(p);
    if (!(await takeExists(p))) { setErr("Bu kaydın ses denemesi silinmiş; çalınamaz."); return; }
    setPerfBusy("İşlenmiş ses hazırlanıyor…");
    try {
      const blob = await getProcessedVoice(p, (f) => setPerfBusy(`İşlenmiş ses hazırlanıyor… %${Math.round(f * 100)}`));
      desk.stopMusic(0); await desk.loadVoice(blob, p.id);
      desk.setVolume("music", sliderFromDb(p.mixSettings.music.gainDb));
      const hasBg = !!p.backgroundTrackId; setBgOn(hasBg);
      const poemOf = data.projects?.find((x) => x.id === p.poemId); if (poemOf) setPoem(poemOf);
      setSpeed(p.teleprompterSettings.speed); setFontScale(Math.max(1.1, p.teleprompterSettings.fontScale * 1.3));
      if (autoplay) { await desk.playVoice(); if (hasBg) await startBg(p); }
    } catch (e) { setErr(e instanceof Error ? e.message : "Kayıtlı şiir hazırlanamadı."); }
    finally { setPerfBusy(""); }
  }, [desk, data.projects, startBg]);
  const voiceToggle = async () => {
    if (!desk || !perf) return;
    if (desk.voicePlaying) { desk.pauseVoice(); desk.pauseMusic(); }
    else { await desk.playVoice(); if (bgOn) { if (desk.musicId) await desk.resumeMusic(); else await startBg(perf, desk.voicePosition); } }
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

  // ---------- Akış ----------
  const runItem = useCallback(async (it: FlowItem) => {
    if (!desk) return;
    setErr("");
    if (it.kind === "live-poem") { const p = poems.find((x) => x.id === it.refId); if (p) pickPoem(p); else setErr("Bu şiir bulunamadı."); }
    else if (it.kind === "recorded") { const p = performances.find((x) => x.id === it.refId); if (p) await loadPerf(p, true); else setErr("Bu kayıtlı şiir bulunamadı."); }
    else if (it.kind === "music") { const t = tracks.find((x) => x.id === it.refId); if (t) await playTrack(t); else setErr("Bu fon müziği bulunamadı."); }
    else if (it.kind === "sfx") { const s = sfx?.find((x) => x.id === it.refId); if (s) { const { getSfxBlob } = await import("../../storage/sfx"); await desk.playSfx(s, () => getSfxBlob(s.id)); } else setErr("Bu efekt bulunamadı."); }
    else if (it.kind === "break") { desk.stopMusic(1.5); desk.pauseVoice(); setRunning(false); setBanner({ title: "Ara", text: it.text }); setView("banner"); }
    else { setBanner({ title: it.label || (it.kind === "opening" ? "Açılış" : it.kind === "closing" ? "Kapanış" : "Konuşma notu"), text: it.text }); setView("banner"); }
  }, [desk, poems, performances, tracks, sfx, pickPoem, loadPerf, playTrack]);

  const persist = (items: FlowItem[]) => { if (!flow) return; const next = { ...flow, items }; setFlow(next); void saveFlow(next).then(reloadFlows); };
  const step = (to: number) => { if (!flow || to < 0 || to >= flow.items.length) return; setIdx(to); void runItem(flow.items[to]); };
  const createFlow = async () => {
    const name = window.prompt("Akışın adı?", "Yeni akış"); if (!name) return;
    const f = newFlow(name); await saveFlow(f); reloadFlows(); setFlow(f); setIdx(-1); setMode("flow");
  };
  const addToFlow = (item: Omit<FlowItem, "id">) => persist([...(flow?.items ?? []), { ...item, id: crypto.randomUUID() }]);

  const panic = () => { desk?.panic(); setRunning(false); };
  const goFs = () => { if (document.fullscreenElement) void document.exitFullscreen(); else void root.current?.requestFullscreen?.().catch(() => {}); };
  const micToggle = async () => { if (!desk) return; setMicErr(""); try { if (desk.micOn) desk.closeMic(); else await desk.openMic(); } catch { setMicErr("Mikrofon açılamadı. İzin verilmemiş veya kullanımda olabilir."); } };

  const stanzas = useMemo(() => parsePoem(poem?.text ?? "").stanzas, [poem?.text]);
  const activeLine = useMemo(() => {
    if (view !== "recorded" || !perf) return undefined;
    const ms = pos * 1000, t = perf.captionTiming.timings;
    let cur: string | null = null; for (const x of t) if (ms >= x.startMs) cur = x.lineId;
    return cur;
  }, [view, perf, pos]);
  const estimate = Math.round((wordsOf(poem?.text ?? "") / 2.2) * 1000);

  if (!desk) return <div className="live-root dark"><p className="muted">Yayın masası hazırlanıyor…</p></div>;
  return (
    <div ref={root} className={"live-root" + (bc.darkMode ? " dark" : "") + (fs ? " fs" : "")} data-testid="live-desk">
      <header className="live-top">
        <div className="live-modes" role="tablist" aria-label="Çalışma biçimi">
          {([["live", "Canlı Oku"], ["recorded", "Kayıtlı Şiiri Çal"], ["flow", "Yayın Akışı"]] as const).map(([id, l]) => (
            <button key={id} role="tab" aria-selected={mode === id} className="btn" onClick={() => { setMode(id); if (id !== "flow") setView(id); }}>{l}</button>
          ))}
        </div>
        <span className={"live-badge" + (view === "live" ? " nr" : "")} role="status" data-testid="live-badge">
          {view === "live" ? "● Canlı Okuma — Kayıt yapılmıyor" : view === "recorded" ? "▶ Kayıtlı şiir çalınıyor — yeni kayıt oluşmaz" : "Yayın akışı"}
        </span>
        <span className="live-top-r">
          <button className="btn" onClick={() => updateSettings((s) => ({ ...s, broadcast: { ...s.broadcast, darkMode: !s.broadcast.darkMode } }))} aria-pressed={bc.darkMode}>🌙 Karanlık</button>
          <button className="btn" onClick={goFs} aria-pressed={fs}>⛶ Tam ekran</button>
          <button className="btn danger live-stop" onClick={panic} data-testid="panic">■ Tüm Sesleri Durdur</button>
        </span>
      </header>
      {err && <div className="alert" role="alert">{err}</div>}

      <div className="live-grid">
        <aside className="live-left"><h2 className="h3">Yayın akışı</h2>
          <FlowRail flow={flow} idx={idx} flows={flows}
            onPick={(id) => { const f = flows.find((x) => x.id === id) ?? null; setFlow(f); setIdx(-1); if (f) setMode("flow"); }}
            onNew={() => void createFlow()} onItems={persist}
            onNext={() => step(nextIndex(idx, flow?.items.length ?? 0))} onPrev={() => step(prevIndex(idx, flow?.items.length ?? 0))} onJump={step} />
        </aside>

        <main className="live-center">
          {view === "banner" && banner ? (
            <div className="live-banner"><h2>{banner.title}</h2>{banner.text && <p>{banner.text}</p>}</div>
          ) : (
            <>
              <div className="live-meta">
                <div><span className="small muted">Şu an</span> <b>{poem?.title || perf?.title || "Şiir seçilmedi"}</b></div>
                <div><span className="small muted">Sıradaki</span> <b>{flow && idx >= 0 && flow.items[idx + 1] ? flow.items[idx + 1].label : "—"}</b></div>
                {view === "live" && <div><span className="small muted">Okuma süresi</span> <b>{fmt(elapsed)}{estimate ? ` / ≈${fmt(estimate)}` : ""}</b></div>}
              </div>
              <Teleprompter ref={tele} title={poem?.title ?? perf?.title ?? ""} poet={poem?.mix.poet ?? perf?.poet ?? ""} stanzas={stanzas}
                fontScale={fontScale} speed={speed} running={view === "live" && running} activeLineId={view === "recorded" ? (activeLine ?? null) : undefined} resetKey={(poem?.id ?? "") + (perf?.id ?? "")} />
              {view === "live" ? (
                <div className="tele-ctl">
                  <button className="btn primary big" onClick={toggleScroll} disabled={!poem} aria-pressed={running}>{running ? "⏸ Kaydırmayı durdur" : "▶ Otomatik kaydır"}</button>
                  <button className="btn" onClick={() => tele.current?.stanza(-1)}>← Önceki kıta</button>
                  <button className="btn" onClick={() => tele.current?.stanza(1)}>Sonraki kıta →</button>
                  <label className="fs-l">Hız {speed}<input type="range" min={8} max={90} value={speed} aria-label="Kaydırma hızı" onChange={(e) => setSpeed(+e.target.value)} /></label>
                  <label className="fs-l">Yazı {Math.round(fontScale * 100)}%<input type="range" min={80} max={260} step={5} value={Math.round(fontScale * 100)} aria-label="Yazı büyüklüğü" onChange={(e) => setFontScale(+e.target.value / 100)} /></label>
                  <span className="muted small">Fon: {musicTrack ? musicTrack.title : "seçilmedi"}</span>
                </div>
              ) : (
                <div className="tele-ctl">
                  {perfBusy && <span role="status">{perfBusy}</span>}
                  <button className="btn primary big" onClick={() => void voiceToggle()} disabled={!perf || !desk.voiceLoaded}>{desk.voicePlaying ? "⏸ Duraklat" : "▶ Oynat"}</button>
                  <button className="btn" onClick={() => void restart()} disabled={!desk.voiceLoaded}>⏮ Baştan başlat</button>
                  <label className="fs-l" style={{ flex: "2 1 220px" }}>{fmt(pos * 1000)} / {fmt(desk.voiceDuration * 1000)}
                    <input type="range" min={0} max={Math.max(1, Math.round(desk.voiceDuration * 10))} value={Math.round(pos * 10)} aria-label="Oynatma konumu" onChange={(e) => { desk.seekVoice(+e.target.value / 10); setPos(+e.target.value / 10); }} /></label>
                  <label className="row chk" style={{ margin: 0 }}><input type="checkbox" checked={bgOn} disabled={!perf?.backgroundTrackId} onChange={(e) => void toggleBg(e.target.checked)} /> Fonlu oynat{perf?.backgroundTrackId ? "" : " (fon yok)"}</label>
                </div>
              )}
            </>
          )}
        </main>

        <section className="live-right">
          <h2 className="h3">Ses masası</h2>
          <Mixer desk={desk} tick={tick} warning={warning}
            mic={{ on: desk.micOn, toggle: () => void micToggle(), err: micErr }}
            music={{ playing: desk.musicPlaying, toggle: () => void musicToggle(), can: !!(musicTrack || desk.musicId || perf?.backgroundTrackId), label: perf?.backgroundTrackId && view === "recorded" ? (bgOn ? "kayıtlı şiirin fonu" : "fon kapalı") : musicTrack?.title ?? "" }}
            voice={{ playing: desk.voicePlaying, toggle: () => void voiceToggle(), can: desk.voiceLoaded, label: perf?.title ?? "" }}
            onStopSfx={() => { for (const s of sfx ?? []) desk.stopSfx(s.id); }}
            ducking={{ enabled: desk.ducker.cfg.enabled, set: (on) => desk.setDuck({ enabled: on }) }}
            micToOutput={{ on: desk.micToOutput, set: (on) => desk.setMicToOutput(on) }} />
        </section>
      </div>

      <section className="live-sb" aria-label="Ses efektleri paneli"><h2 className="h3">Ses efektleri</h2>
        <Soundboard desk={desk} items={sfx} tick={tick} onChanged={reloadSfx} onError={setErr} />
      </section>

      <details className="live-lib" open>
        <summary>Kütüphane</summary>
        <Library poems={poems} performances={performances} tracks={tracks} sfx={sfx ?? []} flows={flows}
          onPoem={(p) => { setMode("live"); pickPoem(p); }} onPerf={(p) => { setMode("recorded"); void loadPerf(p, false); }}
          onMusic={(t) => { setMusicTrack(t); }} onFlow={(f) => { setFlow(f); setIdx(-1); setMode("flow"); }}
          addToFlow={addToFlow} canAdd={!!flow} />
        {flow && <div className="row" style={{ marginTop: 10 }}>
          <button className="btn ghost" onClick={() => actions.go("flows")}>Akışı ayrıntılı düzenle</button>
          <button className="btn ghost" onClick={async () => { if (!confirm(`“${flow.name}” akışı silinsin mi?`)) return; await deleteFlow(flow.id); setFlow(null); setIdx(-1); reloadFlows(); }}>Akışı sil</button>
        </div>}
      </details>
    </div>
  );
}
