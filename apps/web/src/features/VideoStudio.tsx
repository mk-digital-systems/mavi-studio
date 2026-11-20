import { useEffect, useRef, useState } from "react";
import type { Performance, Project, Take } from "@siir/contracts";
import { analysisFor } from "../audio/fx/analysisCache";
import { renderTakeToWav } from "../audio/fx/render";
import { defaultFx, sanitizeFx } from "../audio/fx/settings";
import { volumeFor } from "../audio/preview";
import { stanzaCues } from "../shared/captions";
import { effectiveFx } from "../storage/migrate";
import { getLocalTrackBlob, isLocalTrack } from "../storage/music";
import { computeCaptionTiming, getProcessedVoice, listPerformances, savePerformance } from "../storage/performances";
import { loadTakeBlob } from "../storage/repo";
import { openTakeReader } from "../storage/takeReader";
import { fmt, slug } from "../shared/util";
import { fmtDur, useLocalTracks } from "./LocalMusic";
import type { LocalData } from "../shared/useLocalData";
import { Icon } from "../shell/icons";

/** Ses Stüdyosu'ndan / Kayıtlı Şiirlerim'den gelen: şiir, ses ve fon Video Stüdyosu'na AYRI kanallar olarak gönderilir. */
export type VideoInbox = { project: Project; take: Take; performance?: Performance | null };

const EDITOR_URL = "/video-editor/index.html";

/**
 * Serbest video editörü (Mavi Kadraj). Ayrı bir sayfa olarak gömülür; şiir kaydı olmadan da tek başına
 * video üretilebilir. İsteğe bağlı olarak bir şiir okuması editöre anlatım sesi, fon müziği ise ayrı kanal olarak eklenir.
 */
export function VideoStudio({ data, inbox, clearInbox }: { data: LocalData; inbox?: VideoInbox | null; clearInbox?: () => void }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [openMusic, setOpenMusic] = useState(false);
  const mine = useLocalTracks();

  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== frame.current?.contentWindow) return;
      if (e.data?.type === "mk:ready") setReady(true);
      if (e.data?.type === "mk:pick-music") { setOpen(false); setOpenMusic(true); void mine.reload(); }
      if (e.data?.type === "mk:pick-voice") { setOpenMusic(false); setOpen(true); }
      if (e.data?.type === "mk:performance-imported") {
        setBusy("");
        setMsg("Şiir sesi ve fon, Video Stüdyosu’na ayrı kanallar olarak aktarıldı. Zaman çizelgesinin altındaki “Anlatım” ve “Fon” şeritlerinden yönetebilirsin.");
        const pid = e.data.performanceId as string | null, vid = e.data.videoProjectId as string | null;
        if (pid && vid) void listPerformances().then(async (all) => { const cur = all.find((x) => x.id === pid); if (cur) await savePerformance({ ...cur, videoProjectId: vid }); });
      }
      if (e.data?.type === "mk:audio-added") { setBusy(""); setMsg(e.data.slot === "amb" ? "Fon müziği editöre eklendi. Editörde Ses sekmesinden seviyesini ayarlayabilirsin." : "Şiir kaydı anlatım sesi olarak editöre eklendi. Editörde Ses sekmesinden ayarlayabilirsin."); setOpen(false); setOpenMusic(false); }
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open && !openMusic) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); setOpenMusic(false); } };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, openMusic]);

  /** Yalnızca ses (anlatım) gönderir — manuel seçim için. */
  async function send(p: Project, take: Take) {
    if (busy || !ready) return;
    setMsg(""); setBusy("Efektler uygulanıyor…");
    try {
      const reader = await openTakeReader(take);
      const analysis = await analysisFor(take, reader);
      const fx = sanitizeFx(effectiveFx(p, take) ?? defaultFx());
      const r = await renderTakeToWav(reader, fx, analysis, { normalize: true, targetLufs: -16, onProgress: (f) => setBusy(`Efektler uygulanıyor… %${Math.round(f * 100)}`) });
      frame.current?.contentWindow?.postMessage({ type: "mk:add-audio", name: `${slug(p.title || "siir")}.wav`, blob: r.blob }, location.origin);
      setBusy("Editöre aktarılıyor…");
    } catch (e) { setBusy(""); setMsg(e instanceof Error ? e.message : "Ses editöre aktarılamadı."); }
  }

  async function sendMusic(id: string, title: string) {
    if (!ready) return;
    setMsg("");
    try {
      const blob = await getLocalTrackBlob(id);
      frame.current?.contentWindow?.postMessage({ type: "mk:add-audio", slot: "amb", name: `${slug(title || "fon-muzigi")}.${blob.type.includes("wav") ? "wav" : "mp3"}`, blob }, location.origin);
    } catch (e) { setMsg(e instanceof Error ? e.message : "Fon müziği editöre aktarılamadı."); }
  }

  // Kayıttan / kayıtlı şiirden gelindiyse: editör hazır olunca ne gönderileceği sorulur (işlenmiş/kuru ses, fon).
  const [offer, setOffer] = useState<VideoInbox | null>(null);
  const [voiceKind, setVoiceKind] = useState<"processed" | "dry">("processed");
  const [withMusic, setWithMusic] = useState(true);
  const shown = useRef<string>("");
  useEffect(() => {
    if (!inbox || !ready || shown.current === inbox.take.id + (inbox.performance?.id ?? "")) return;
    shown.current = inbox.take.id + (inbox.performance?.id ?? "");
    setOffer(inbox); setVoiceKind("processed"); setWithMusic(true); clearInbox?.();
  }); // eslint-disable-line react-hooks/exhaustive-deps
  const offerMusicId = offer ? (offer.performance?.backgroundTrackId ?? offer.project.trackId) : null;

  /** Şiir sesi ve fon AYRI kanallar olarak; metin, şair, zamanlama, atmosfer ve miks ayarlarıyla birlikte gönderilir. */
  async function sendPackage() {
    if (!offer || !ready) return;
    const { project: p, take: t, performance: perf } = offer;
    setMsg(""); setBusy("Hazırlanıyor…"); setOffer(null);
    try {
      const fx = sanitizeFx(perf?.fx ?? effectiveFx(p, t) ?? defaultFx());
      const mix = perf?.mixSettings ?? p.mix;
      let voice: Blob;
      if (voiceKind === "dry") voice = await loadTakeBlob(t);
      else if (perf) voice = await getProcessedVoice(perf, (f) => setBusy(`Efektler uygulanıyor… %${Math.round(f * 100)}`));
      else {
        const reader = await openTakeReader(t), analysis = await analysisFor(t, reader);
        voice = (await renderTakeToWav(reader, fx, analysis, { normalize: true, targetLufs: -16, onProgress: (f) => setBusy(`Efektler uygulanıyor… %${Math.round(f * 100)}`) })).blob;
      }
      const timing = perf?.captionTiming ?? (await computeCaptionTiming(t, p.text));
      const cues = stanzaCues(p.text, timing.timings, t.durationMs / 1000);
      const musicId = perf?.backgroundTrackId ?? p.trackId;
      let music: Blob | null = null, musicName = "";
      if (withMusic && isLocalTrack(musicId)) { music = await getLocalTrackBlob(musicId); musicName = (mine.tracks ?? []).find((x) => x.id === musicId)?.title ?? "fon-muzigi"; }
      frame.current?.contentWindow?.postMessage({
        type: "mk:import-performance", title: p.title, poet: perf?.poet ?? p.mix.poet, text: p.text,
        voice, voiceName: `${slug(p.title || "siir")}-${voiceKind === "dry" ? "kuru" : "islenmis"}.wav`,
        music, musicName: `${slug(musicName || "fon")}.${music?.type.includes("wav") ? "wav" : "mp3"}`,
        musicCfg: { startSec: mix.music.startOffsetSec, gainDb: mix.music.gainDb, fadeInSec: mix.music.fadeInSec, fadeOutSec: mix.music.fadeOutSec, volume: volumeFor(mix.music.gainDb) },
        cues, atmosphere: fx.preset, mix, performanceId: perf?.id ?? null,
      }, location.origin);
    } catch (e) { setBusy(""); setMsg(e instanceof Error ? e.message : "Video Stüdyosu’na aktarılamadı."); }
  }

  const withTakes = (data.projects ?? []).filter((p) => (data.takes[p.id] ?? []).length > 0);

  return (
    <section className="vstudio" aria-label="Video atölyesi">
      <div className="vs-bar">
        <p className="muted small">Fotoğraf ve videolarla serbestçe video yap. İstersen şiir kaydını anlatım sesi olarak ekle; eklemeden de videoyu indirebilirsin.</p>
        <div className="vs-act">
          <button className="btn" onClick={() => { setOpenMusic(false); setOpen((o) => !o); }} aria-expanded={open} disabled={!ready}><Icon name="mic" size={18} /> Şiir kaydından ses ekle</button>
          <button className="btn" onClick={() => { setOpen(false); setOpenMusic((o) => !o); }} aria-expanded={openMusic} disabled={!ready}><Icon name="music" size={18} /> Fon müziklerimden seç</button>
          <a className="btn ghost" href={EDITOR_URL} target="_blank" rel="noopener">Ayrı sekmede aç</a>
        </div>
      </div>
      {(msg || busy) && <p className="small" role="status">{busy || msg}</p>}
      {openMusic && (
        <div className="vs-modal" role="dialog" aria-modal="true" aria-label="Fon müziği seç" onClick={(e) => { if (e.target === e.currentTarget) setOpenMusic(false); }}>
          <div className="card vs-pick">
            <div className="row" style={{ justifyContent: "space-between" }}><h3>Hangi fon müziğini ekleyelim?</h3><button className="btn ghost" onClick={() => setOpenMusic(false)}>Kapat</button></div>
            {(mine.tracks ?? []).length === 0 ? <p className="muted">Henüz fon müziği yüklemedin. Fon Müziklerim sayfasından “Fon yükle” ile ekleyebilirsin.</p> : (
              <ul className="vs-list">
                {(mine.tracks ?? []).map((t) => (
                  <li key={t.id}><ul><li><span>{t.title} · {fmtDur(t.durationSec)}</span><button className="btn primary" onClick={() => void sendMusic(t.id, t.title)}>Ekle</button></li></ul></li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
      {open && (
        <div className="vs-modal" role="dialog" aria-modal="true" aria-label="Şiir kaydı seç" onClick={(e) => { if (e.target === e.currentTarget && !busy) setOpen(false); }}>
          <div className="card vs-pick">
            <div className="row" style={{ justifyContent: "space-between" }}><h3>Hangi şiir okumasını ekleyelim?</h3><button className="btn ghost" onClick={() => setOpen(false)} disabled={!!busy}>Kapat</button></div>
            {busy && <p role="status" className="small">{busy}</p>}
            {withTakes.length === 0 ? <p className="muted">Henüz kaydı olan çalışma yok. Önce Ses Stüdyosu’nda bir deneme kaydet.</p> : (
              <ul className="vs-list">
                {withTakes.map((p) => (
                  <li key={p.id}>
                    <b>{p.title || "Adsız şiir"}</b>
                    <ul>
                      {data.takes[p.id].map((t, i) => (
                        <li key={t.id}>
                          <span>Deneme {i + 1} · {fmt(t.durationMs)}{p.primaryTakeId === t.id ? " (ana)" : ""}</span>
                          <button className="btn primary" disabled={!!busy} onClick={() => void send(p, t)}>Ekle</button>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
      {offer && (
        <div className="vs-modal" role="dialog" aria-modal="true" aria-label="Video Stüdyosu’na gönder" onClick={(e) => { if (e.target === e.currentTarget) setOffer(null); }}>
          <div className="card vs-pick">
            <div className="row between"><h3>Video Stüdyosu’na gönder</h3><button className="btn ghost" onClick={() => setOffer(null)}>Kapat</button></div>
            <p className="muted small">“{offer.project.title || "Adsız şiir"}” — şiir metni, başlık, şair, satır zamanlamaları, ses ve fon aktarılır. Ses ve fon ayrı kanallar olarak gelir.</p>
            <fieldset style={{ border: 0, padding: 0, margin: "0 0 10px" }}>
              <legend className="small muted">Şiir sesi</legend>
              <label className="row chk"><input type="radio" name="vk" checked={voiceKind === "processed"} onChange={() => setVoiceKind("processed")} /> İşlenmiş ses (atmosfer uygulanmış) — önerilen</label>
              <label className="row chk"><input type="radio" name="vk" checked={voiceKind === "dry"} onChange={() => setVoiceKind("dry")} /> Kuru mikrofon kaydı</label>
            </fieldset>
            <label className="row chk"><input type="checkbox" checked={withMusic && isLocalTrack(offerMusicId)} disabled={!isLocalTrack(offerMusicId)} onChange={(e) => setWithMusic(e.target.checked)} /> Fon müziğini de gönder{!offerMusicId ? " (bu şiirde fon yok)" : !isLocalTrack(offerMusicId) ? " (katalog fonu gönderilemez)" : ""}</label>
            <p className="small muted">Fonu Video Stüdyosu’nda kesebilir, seviyesini değiştirebilir, başka fonla değiştirebilir veya fonsuz video alabilirsin.</p>
            <div className="row"><button className="btn primary" onClick={() => void sendPackage()}>Gönder</button></div>
          </div>
        </div>
      )}
      <iframe ref={frame} className="vs-frame" src={EDITOR_URL} title="Mavi Kadraj video editörü" allow="microphone; fullscreen" />
    </section>
  );
}
