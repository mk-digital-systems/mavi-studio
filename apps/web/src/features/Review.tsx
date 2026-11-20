import { useEffect, useRef, useState } from "react";
import type { Take } from "@siir/contracts";
import type { Draft, Patch } from "../App";
import { deleteTake, loadTakeBlob } from "../storage/repo";
import { fmt, slug } from "../shared/util";
import { claim, release } from "../shared/exclusive";
import { PreviewPlayer, volumeFor } from "../audio/preview";
import type { Actions } from "../shell/types";
import { buildPerformance, computeCaptionTiming, listPerformances, savePerformance } from "../storage/performances";
import { FxStudio } from "./FxStudio";
import { ExportPanel } from "./ExportPanel";

type P = { draft: Draft; patch: Patch; takes: Take[]; reloadTakes: () => Promise<void>; back: () => void; wantVideo?: boolean; actions: Actions };

/** Ses, yalnızca dinlenmek/indirilmek istendiğinde diskten birleştirilir (bellek tasarrufu). */
function TakeRow({ t, i, draft, patch, onRemove, onStudio, actions }: { t: Take; i: number; draft: Draft; patch: Patch; onRemove: () => void; onStudio: () => void; actions: Actions }) {
  const audioEl = useRef<HTMLAudioElement>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  // Dinleme önizlemesi: seçili fon müziği, deneme çalarken yanında çalar (kayıtta müzik kayda girmez; son miks Dışa aktar'da yapılır).
  const music = useRef<PreviewPlayer>(null as unknown as PreviewPlayer);
  if (!music.current) music.current = new PreviewPlayer();
  useEffect(() => { const m = music.current; return () => m.stop(); }, []);
  const [withMusic, setWithMusic] = useState(true);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  /** Kayıtlı Şiirlerim'e kaydet: şiir + bu deneme + fon + miks AYRI kayıtlara bağlanır; hiçbir ses kopyalanmaz. */
  const keep = async () => {
    setSaving(true); setErr("");
    try {
      patch({ primaryTakeId: t.id, status: "recorded" });
      const timing = await computeCaptionTiming(t, draft.text);
      const fresh = buildPerformance(draft, t, timing);
      const old = (await listPerformances()).find((x) => x.poemId === draft.id && x.selectedTakeId === t.id);
      await savePerformance(old ? { ...fresh, id: old.id, createdAt: old.createdAt, videoProjectId: old.videoProjectId } : fresh);
      setSaved(true);
    } catch { setErr("Kayıtlı şiir saklanamadı. Tekrar dene."); } finally { setSaving(false); }
  };
  const startMusic = () => {
    if (!draft.trackId || !withMusic) return;
    music.current.setVolume(volumeFor(draft.mix.music.gainDb));
    void music.current.play(draft.trackId, draft.mix.music.startOffsetSec).catch(() => setErr("Fon müziği çalınamadı; deneme müziksiz çalıyor."));
  };
  /** Fonlu / fonsuz karşılaştırma: çalarken de açılıp kapanır. */
  const toggleMusic = (on: boolean) => {
    setWithMusic(on);
    const el = audioEl.current;
    if (!on) music.current.stop();
    else if (el && !el.paused && draft.trackId) {
      music.current.setVolume(volumeFor(draft.mix.music.gainDb));
      void music.current.play(draft.trackId, draft.mix.music.startOffsetSec).catch(() => setErr("Fon müziği çalınamadı."));
    }
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
      {draft.trackId && <label className="row chk" style={{ margin: 0 }}><input type="checkbox" checked={withMusic} onChange={(e) => toggleMusic(e.target.checked)} /> Fonla dinle</label>}
      <div className="row" style={{ flex: "1 1 100%" }}>
        <button className="btn" onClick={onStudio}>İşlenmiş / ham karşılaştır</button>
        <button className="btn" disabled={saving} onClick={() => void keep()}>{saving ? "Saklanıyor…" : "Kayıtlı Şiirlerime kaydet"}</button>
        <button className="btn" onClick={() => document.getElementById("export-sec")?.scrollIntoView({ behavior: "smooth", block: "start" })}>Ses dosyası oluştur</button>
        <button className="btn primary" onClick={() => actions.sendToVideo(draft, t)}>Video Stüdyosu’na gönder</button>
        <button className="btn ghost" onClick={() => void download()}>Ham ses indir (müziksiz)</button>
        <button className="btn ghost" onClick={onRemove}>Sil</button>
      </div>
      {saved && <div className="note" role="status" style={{ flex: "1 1 100%" }}>✓ Kayıtlı Şiirlerim’e kaydedildi{!isMain ? " (ana deneme yapıldı)" : ""}. <button className="btn ghost" style={{ minHeight: 36, padding: "2px 12px" }} onClick={() => actions.go("performances")}>Kayıtlı Şiirlerim’de gör</button></div>}
      {err && <div className="alert" style={{ flex: "1 1 100%", margin: 0 }}>{err}</div>}
      {t.clipped && <div className="warn" style={{ flex: "1 1 100%", margin: 0 }}>Bu denemede ses taşmış olabilir. Mikrofondan biraz uzaklaşarak yeniden dene.</div>}
    </div>
  );
}

export function Review({ draft, patch, takes, reloadTakes, back, wantVideo, actions }: P) {
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
        <div className="row between"><h1 className="h2">Kayıt tamamlandı</h1><button className="btn" onClick={back}>↻ Yeniden oku</button></div>
        {done.length === 0 && <p className="muted">Henüz kayıt yok.</p>}
        {done.map((t, i) => <TakeRow key={t.id} t={t} i={i} draft={draft} patch={patch} onRemove={() => void remove(t.id)} onStudio={() => setStudio(t.id)} actions={actions} />)}
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
        <button className="btn" onClick={back}>↻ Yeniden oku</button>
        <span />
      </div></div>
    </>
  );
}
