import { useEffect, useRef, useState } from "react";
import type { Project, Take } from "@siir/contracts";
import { analysisFor } from "../audio/fx/analysisCache";
import { renderTakeToWav } from "../audio/fx/render";
import { defaultFx, sanitizeFx } from "../audio/fx/settings";
import { effectiveFx } from "../storage/migrate";
import { openTakeReader } from "../storage/takeReader";
import { fmt, slug } from "../shared/util";
import { getLocalTrackBlob } from "../storage/music";
import { fmtDur, useLocalTracks } from "./LocalMusic";
import type { LocalData } from "../shared/useLocalData";
import { Icon } from "../shell/icons";

const EDITOR_URL = "/video-editor/index.html";

/**
 * Serbest video editörü (Mavi Kadraj). Ayrı bir sayfa olarak gömülür; şiir kaydı olmadan da tek başına
 * video üretilebilir. İsteğe bağlı olarak bir şiir okuması (efektleri uygulanmış halde) editöre anlatım sesi olarak eklenir.
 */
export function VideoStudio({ data }: { data: LocalData }) {
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
      if (e.data?.type === "mk:audio-added") { setBusy(""); setMsg(e.data.slot === "amb" ? "Fon müziği editöre eklendi. Editörde Ses sekmesinden seviyesini ayarlayabilirsin." : "Şiir kaydı anlatım sesi olarak editöre eklendi. Editörde Ses sekmesinden ayarlayabilirsin."); setOpen(false); setOpenMusic(false); }
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, []);

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
      {msg && <p className="small" role="status">{msg}</p>}
      {openMusic && (
        <div className="card vs-pick">
          <h3>Hangi fon müziğini ekleyelim?</h3>
          {(mine.tracks ?? []).length === 0 ? <p className="muted">Henüz fon müziği yüklemedin. Fon Müziklerim sayfasından “Yeni fon müziği” ile ekleyebilirsin.</p> : (
            <ul className="vs-list">
              {(mine.tracks ?? []).map((t) => (
                <li key={t.id}><ul><li><span>{t.title} · {fmtDur(t.durationSec)}</span><button className="btn primary" onClick={() => void sendMusic(t.id, t.title)}>Ekle</button></li></ul></li>
              ))}
            </ul>
          )}
        </div>
      )}
      {open && (
        <div className="card vs-pick">
          <h3>Hangi şiir okumasını ekleyelim?</h3>
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
      )}
      <iframe ref={frame} className="vs-frame" src={EDITOR_URL} title="Mavi Kadraj video editörü" allow="microphone; fullscreen" />
    </section>
  );
}
