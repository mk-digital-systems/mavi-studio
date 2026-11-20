import { useEffect, useRef, useState } from "react";
import type { Take } from "@siir/contracts";
import type { Draft, Patch } from "../App";
import { deleteTake, loadTakeBlob } from "../storage/repo";
import { fmt, slug } from "../shared/util";
import { claim, release } from "../shared/exclusive";
import { PreviewPlayer } from "../audio/preview";
import { FxStudio } from "./FxStudio";
import { ExportPanel } from "./ExportPanel";

type P = { draft: Draft; patch: Patch; takes: Take[]; reloadTakes: () => Promise<void>; back: () => void; wantVideo?: boolean };

/** Ses, yalnızca dinlenmek/indirilmek istendiğinde diskten birleştirilir (bellek tasarrufu). */
function TakeRow({ t, i, draft, patch, onRemove, onStudio }: { t: Take; i: number; draft: Draft; patch: Patch; onRemove: () => void; onStudio: () => void }) {
  const audioEl = useRef<HTMLAudioElement>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  // Dinleme önizlemesi: seçili fon müziği, deneme çalarken yanında çalar (kayıtta müzik kayda girmez; son miks Dışa aktar'da yapılır).
  const music = useRef<PreviewPlayer>(null as unknown as PreviewPlayer);
  if (!music.current) music.current = new PreviewPlayer();
  useEffect(() => { const m = music.current; return () => m.stop(); }, []);
  const startMusic = () => {
    if (!draft.trackId) return;
    music.current.setVolume(Math.min(1, Math.max(0.05, Math.pow(10, (draft.mix.music.gainDb + 6) / 20))));
    void music.current.play(draft.trackId).catch(() => setErr("Fon müziği çalınamadı; deneme müziksiz çalıyor."));
  };
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); release("take-" + t.id); }, [url, t.id]);
  useEffect(() => { if (url) audioEl.current?.focus(); }, [url]);
  useEffect(() => { const h = () => { if (url) URL.revokeObjectURL(url); }; window.addEventListener("pagehide", h); return () => window.removeEventListener("pagehide", h); }, [url]);

  const prepare = async () => {
    if (url) return url;
    setBusy(true); setErr("");
    try { const u = URL.createObjectURL(await loadTakeBlob(t)); setUrl(u); return u; }
    catch { setErr("Kayıt yüklenemedi."); return ""; }
    finally { setBusy(false); }
  };
  const download = async () => {
    const u = await prepare(); if (!u) return;
    const a = document.createElement("a");
    a.href = u; a.download = `${slug(draft.title)}-${t.createdAt.slice(0, 10)}-${i + 1}.wav`; a.click();
  };
  const isMain = draft.primaryTakeId === t.id;

  return (
    <div className="take">
      <div style={{ minWidth: 130 }}>
        <b>Deneme {i + 1}</b> {isMain && <span className="badge">ANA</span>}
        <div className="muted small">{fmt(t.durationMs)} · {new Date(t.createdAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}{t.clipped ? " · ⚠ taşma" : ""}</div>
      </div>
      {url ? <audio ref={audioEl} controls autoPlay src={url} aria-label={`Deneme ${i + 1}`} onPlay={() => { claim("take-" + t.id, () => audioEl.current?.pause()); startMusic(); }} onPause={() => music.current.stop()} onEnded={() => music.current.stop()} /> : (
        <button className="btn" disabled={busy} onClick={() => void prepare()}>{busy ? "Hazırlanıyor…" : "▶ Dinle"}</button>
      )}
      <div className="row">
        {!isMain && <button className="btn ghost" onClick={() => patch({ primaryTakeId: t.id })}>Ana yap</button>}
        <button className="btn" onClick={onStudio}>Ses stüdyosu</button>
        <button className="btn" onClick={() => void download()}>Ham ses indir (müziksiz)</button>
        <button className="btn ghost" onClick={onRemove}>Sil</button>
      </div>
      {err && <div className="alert" style={{ flex: "1 1 100%", margin: 0 }}>{err}</div>}
      {t.clipped && <div className="warn" style={{ flex: "1 1 100%", margin: 0 }}>Bu denemede ses taşmış olabilir. Mikrofondan biraz uzaklaşarak yeniden dene.</div>}
    </div>
  );
}

export function Review({ draft, patch, takes, reloadTakes, back, wantVideo }: P) {
  const [studio, setStudio] = useState<string | null>(null);
  const done = takes.filter((t) => t.status === "complete");
  const remove = async (id: string) => {
    if (!confirm("Bu deneme bu cihazdan silinsin mi?")) return;
    await deleteTake(id);
    const rest = done.filter((t) => t.id !== id);
    if (draft.primaryTakeId === id) patch({ primaryTakeId: rest[0]?.id ?? null });
    await reloadTakes();
  };
  return (
    <>
      <section className="card">
        <h1 className="h2">Denemelerin</h1>
        {done.length === 0 && <p className="muted">Henüz kayıt yok.</p>}
        {done.map((t, i) => <TakeRow key={t.id} t={t} i={i} draft={draft} patch={patch} onRemove={() => void remove(t.id)} onStudio={() => setStudio(t.id)} />)}
      </section>
      {studio && done.find((t) => t.id === studio) && (
        <FxStudio key={studio} draft={draft} patch={patch} take={done.find((t) => t.id === studio)!} reloadTakes={reloadTakes} onClose={() => setStudio(null)} />
      )}
      <ExportPanel draft={draft} patch={patch} takes={takes} defaultForVideo={wantVideo} />
      <section className="card">
        <h3>Sırada ne var?</h3>
        <p className="muted">Yukarıdaki “Dışa aktar” ile efektli ve fon müzikli son kaydını WAV veya MP3 olarak alabilirsin. “Ham ses indir” ise yalnızca efektsiz, müziksiz ham sesini verir (48 kHz · 24-bit · mono).</p>
        <p className="small muted">Kayıtların yalnızca bu tarayıcıda saklanır; tarayıcı verisi silinirse kaybolabilir. Önemli denemeleri WAV olarak indir.</p>
        {draft.trackId && <p className="small muted">Denemeyi dinlerken fon müziği yaklaşık seviyede yanında çalar; kesin denge ve okurken kısma “Dışa aktar”daki ayarlarla yapılır. Seçili fon müziği ham olarak indirilemez; yalnızca şiir sesiyle birleşmiş çıktı sunulacak.</p>}
      </section>
      <div className="bar"><div className="inner">
        <button className="btn" onClick={back}>← Yeni deneme al</button>
        <span />
      </div></div>
    </>
  );
}
