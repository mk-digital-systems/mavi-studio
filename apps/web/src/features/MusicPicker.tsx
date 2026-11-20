import { useEffect, useMemo, useRef, useState } from "react";
import type { TrackPublic } from "@siir/contracts";
import type { Draft } from "../App";
import { PreviewPlayer } from "../audio/preview";
import { useSettings } from "../shared/settings";

type P = { draft: Draft; patch: (p: Partial<Draft>) => void; back: () => void; next: () => void };

export function MusicPicker({ draft, patch, back, next }: P) {
  const [tracks, setTracks] = useState<TrackPublic[] | null>(null);
  const [error, setError] = useState("");
  const [mood, setMood] = useState("");
  const [playing, setPlaying] = useState<string | null>(null);
  const player = useRef<PreviewPlayer>(null as unknown as PreviewPlayer);
  if (!player.current) player.current = new PreviewPlayer();

  useEffect(() => {
    fetch("/api/catalog").then((r) => r.json()).then(setTracks).catch(() => setError("Fon müzikleri yüklenemedi. Bağlantını kontrol edip tekrar dene."));
    const p = player.current;
    return () => p.stop();
  }, []);

  const moods = useMemo(() => [...new Set((tracks ?? []).flatMap((t) => t.mood))].sort(), [tracks]);
  const fav = useSettings().music.favorites; // favoriler (Fon Müziklerim) listede öne çıkar
  const shown = (tracks ?? []).filter((t) => !mood || t.mood.includes(mood)).sort((a, b) => Number(fav.includes(b.id)) - Number(fav.includes(a.id)));

  const choose = (id: string | null) => patch({ trackId: id });
  const toggle = async (id: string) => {
    if (playing === id) { player.current.stop(); setPlaying(null); return; }
    try { await player.current.play(id); setPlaying(id); } catch { setError("Ön izleme çalınamadı."); }
  };
  const sel = tracks?.find((t) => t.id === draft.trackId);

  return (
    <>
      <section className="card">
        <h1 className="h2">Fon müziği</h1>
        <p className="muted">Stüdyonun hazır fonlarından birini seç; ön izleme düşük kalitelidir, nihai kayıtta tam kalite kullanılır.</p>
        {error && <div className="alert" role="alert">{error}</div>}
        <div className="filters" role="group" aria-label="Duyguya göre filtrele">
          <button className="btn" aria-pressed={!mood} onClick={() => setMood("")}>Hepsi</button>
          {moods.map((m) => <button key={m} className="btn" aria-pressed={mood === m} onClick={() => setMood(m)}>{m}</button>)}
        </div>
        <div className="grid">
          <button className="track" aria-pressed={draft.trackId === null} onClick={() => choose(null)}>
            <div style={{ width: 64, height: 64, borderRadius: 10, background: "var(--bg)", display: "grid", placeItems: "center", flex: "none" }} aria-hidden>🎙</div>
            <span><b>Müziksiz</b><span className="muted small">Yalnızca sesin</span></span>
          </button>
          {!tracks && !error && <p className="muted">Yükleniyor…</p>}
          {shown.map((t) => (
            <div key={t.id}>
              <button className="track" aria-pressed={draft.trackId === t.id} onClick={() => choose(t.id)}>
                <img src={t.cover} alt="" width={64} height={64} />
                <span>
                  <b>{fav.includes(t.id) && <span aria-label="Favori">★ </span>}{t.title}</b>
                  <span className="muted small">{t.genre} · {t.tempoBpm} BPM</span>
                  <span className="chips">{t.mood.map((m) => <span key={m} className="chip">{m}</span>)}</span>
                </span>
              </button>
              <button className="btn ghost small" style={{ marginTop: 6, minHeight: 40 }} onClick={() => toggle(t.id)} aria-label={`${playing === t.id ? "Durdur" : "Ön izle"}: ${t.title}`}>
                <span aria-hidden>{playing === t.id ? "■" : "▶"}</span> {playing === t.id ? "Durdur" : "Ön izle"}
              </button>
            </div>
          ))}
        </div>
        {sel?.attributionRequired && <p className="small muted">Atıf: {sel.attributionText}</p>}
      </section>
      <div className="bar"><div className="inner">
        <button className="btn" onClick={() => { player.current.stop(); back(); }}>← Şiir</button>
        <button className="btn primary" onClick={() => { player.current.stop(); next(); }}>Kayda geç →</button>
      </div></div>
    </>
  );
}
