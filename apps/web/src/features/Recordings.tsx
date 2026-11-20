import { useEffect, useRef, useState } from "react";
import type { Project, Take } from "@siir/contracts";
import { Icon } from "../shell/icons";
import type { Actions } from "../shell/types";
import { claim, release } from "../shared/exclusive";
import { fmt, slug } from "../shared/util";
import type { LocalData } from "../shared/useLocalData";
import { loadTakeBlob } from "../storage/repo";
import { EmptyState, PageHeader, RecoveryBanner, StoragePanel, WipeButton } from "./parts";

function Row({ p, t, i, actions }: { p: Project; t: Take; i: number; actions: Actions }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const el = useRef<HTMLAudioElement>(null);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); release("rec-" + t.id); }, [url, t.id]);
  useEffect(() => { if (url) el.current?.focus(); }, [url]);

  const prepare = async () => {
    if (url) return url;
    setBusy(true); setErr("");
    try { const u = URL.createObjectURL(await loadTakeBlob(t)); setUrl(u); return u; } catch { setErr("Kayıt yüklenemedi."); return ""; } finally { setBusy(false); }
  };
  const download = async () => {
    const u = await prepare(); if (!u) return;
    const a = document.createElement("a"); a.href = u; a.download = `${slug(p.title)}-${t.createdAt.slice(0, 10)}-${i + 1}.wav`; a.click();
  };
  return (
    <div className="take">
      <div style={{ minWidth: 150 }}>
        <b>Deneme {i + 1}</b> {p.primaryTakeId === t.id && <span className="badge">ANA</span>}
        <div className="muted small">{fmt(t.durationMs)} · {new Date(t.createdAt).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })}{t.clipped ? " · ⚠ taşma" : ""}</div>
      </div>
      {url ? <audio ref={el} controls autoPlay src={url} aria-label={`${p.title || "Adsız şiir"} — deneme ${i + 1}`} onPlay={() => claim("rec-" + t.id, () => el.current?.pause())} />
        : <button className="btn" disabled={busy} onClick={() => void prepare()}><Icon name="play" size={16} /> {busy ? "Hazırlanıyor…" : "Dinle"}</button>}
      <div className="row">
        <button className="btn" onClick={() => void download()}><Icon name="download" size={16} /> WAV</button>
        <button className="btn ghost" onClick={() => actions.open(p, "review")}>Stüdyoda aç</button>
      </div>
      {err && <div className="alert" style={{ flex: "1 1 100%", margin: 0 }}>{err}</div>}
    </div>
  );
}

/** Ses Kayıtlarım: tüm projelerdeki denemeler, projeye göre gruplanmış; depolama ve veri kaybı bilgisi. */
export function Recordings({ data, actions }: { data: LocalData; actions: Actions }) {
  const [msg, setMsg] = useState("");
  const groups = (data.projects ?? []).filter((p) => (data.takes[p.id] ?? []).length > 0);
  return (
    <>
      <PageHeader title="Ses Kayıtlarım" sub="Kaydedilmiş şiir okumaların ve farklı denemeler" />
      {data.error && <div className="alert" role="alert">{data.error}</div>}
      {msg && <div className="note" role="status">{msg}</div>}
      <RecoveryBanner orphans={data.orphans} reload={data.reload} onMsg={setMsg} />

      {data.projects === null ? <p className="muted">Yükleniyor…</p> : groups.length === 0 ? (
        <EmptyState icon="wave" title="Henüz ses kaydın yok" action={<button className="btn primary" onClick={() => actions.go("studio")}>Ses Stüdyosu’na git</button>}>
          Bir şiiri okuyup kaydettiğinde denemelerin burada, şiirinin altında toplanır.
        </EmptyState>
      ) : groups.map((p) => (
        <section key={p.id} className="card sec" aria-label={p.title || "Adsız şiir"}>
          <h2>{p.title || "Adsız şiir"}</h2>
          {(data.takes[p.id] ?? []).map((t, i) => <Row key={t.id} p={p} t={t} i={i} actions={actions} />)}
        </section>
      ))}

      <section className="card sec" aria-labelledby="sto-h">
        <h2 id="sto-h">Depolama</h2>
        <StoragePanel info={data.info} reload={data.reload} />
        <div style={{ marginTop: 12 }}><WipeButton reload={data.reload} onMsg={setMsg} /></div>
      </section>
    </>
  );
}
