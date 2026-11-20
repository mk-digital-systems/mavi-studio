import { useEffect, useMemo, useRef, useState } from "react";
import type { TrackPublic } from "@siir/contracts";
import { PreviewPlayer } from "../audio/preview";
import { Icon } from "../shell/icons";
import { updateSettings, useSettings } from "../shared/settings";
import { deleteLocalTrack, isLocalTrack } from "../storage/music";
import { recentMusic } from "../shared/recent";
import { AddMusicButton, fmtDur, fmtSize, useLocalTracks } from "./LocalMusic";
import { EmptyState } from "./parts";

type Item = { id: string; title: string; artist: string; cats: string[]; sub: string; cover?: string; local: boolean; note?: string; size?: number };

const norm = (s: string) => s.toLocaleLowerCase("tr");

/**
 * Fon müziği kütüphanesi: yüklediklerin + hazır katalog. Arama, kategori filtresi, ön izleme.
 * "library": yönetim (favori, sil, bu müzikle başla). "picker": çalışmaya seçme (müziksiz seçeneğiyle).
 */
export function MusicBrowser({ mode, selectedId, onChoose, onStart }: {
  mode: "library" | "picker"; selectedId?: string | null; onChoose?: (id: string | null) => void; onStart?: (id: string) => void;
}) {
  const settings = useSettings();
  const fav = settings.music.favorites;
  const mine = useLocalTracks();
  const [catalog, setCatalog] = useState<TrackPublic[] | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [onlyFav, setOnlyFav] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const player = useRef<PreviewPlayer>(null as unknown as PreviewPlayer);
  if (!player.current) player.current = new PreviewPlayer();

  useEffect(() => {
    // Katalog yayında olmayabilir (yalnızca yüklenen müzikler kullanılır): hata sessizce boş katalog olur.
    fetch("/api/catalog").then((r) => (r.ok ? r.json() : Promise.reject())).then((t) => setCatalog(Array.isArray(t) ? t : [])).catch(() => setCatalog([]));
    const p = player.current;
    return () => p.stop();
  }, []);

  const items: Item[] = useMemo(() => [
    ...(mine.tracks ?? []).map((t): Item => ({ id: t.id, title: t.title, artist: t.artist ?? "", cats: t.category ? [t.category] : [], sub: `${fmtDur(t.durationSec)} · ${fmtSize(t.size)}`, local: true, note: t.note, size: t.size })),
    ...(catalog ?? []).map((t): Item => ({ id: t.id, title: t.title, artist: t.artist, cats: t.mood, sub: `${t.genre} · ${t.tempoBpm} BPM`, cover: t.cover, local: false, note: t.attributionRequired ? `Atıf: ${t.attributionText ?? ""}` : undefined })),
  ], [mine.tracks, catalog]);

  const cats = useMemo(() => [...new Set(items.flatMap((i) => i.cats))].sort((a, b) => a.localeCompare(b, "tr")), [items]);
  const recent = recentMusic();
  const shown = items
    .filter((i) => (!cat || i.cats.includes(cat)) && (!onlyFav || fav.includes(i.id)) && (!q.trim() || norm(i.title + " " + i.artist + " " + i.cats.join(" ")).includes(norm(q.trim()))))
    .sort((a, b) => Number(fav.includes(b.id)) - Number(fav.includes(a.id)) || (recent.indexOf(a.id) + 99) % 100 - (recent.indexOf(b.id) + 99) % 100);

  const toggleFav = (id: string) => updateSettings((s) => ({ ...s, music: { ...s.music, favorites: s.music.favorites.includes(id) ? s.music.favorites.filter((x) => x !== id) : [...s.music.favorites, id] } }));
  const preview = async (id: string) => {
    if (playing === id) { player.current.stop(); setPlaying(null); return; }
    try { await player.current.play(id); setPlaying(id); setError(""); } catch { setPlaying(null); setError("Ön izleme çalınamadı."); }
  };
  const remove = async (i: Item) => {
    if (!confirm(`“${i.title}” fon müziklerinden silinsin mi?`)) return;
    if (playing === i.id) { player.current.stop(); setPlaying(null); }
    await deleteLocalTrack(i.id); await mine.reload();
    if (selectedId === i.id) onChoose?.(null);
  };

  const loading = mine.tracks === null || catalog === null;
  return (
    <>
      <div className="row between mb-btn">
        <div className="search" style={{ flex: "1 1 240px", margin: 0 }}>
          <label htmlFor={"mq-" + mode} className="sr">Fon müziklerinde ara</label>
          <Icon name="search" size={18} />
          <input id={"mq-" + mode} type="search" placeholder="Ad, sanatçı veya kategori ara…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <AddMusicButton primary={mode === "library"} onAdded={(t) => { void mine.reload(); if (mode === "picker") onChoose?.(t.id); }} />
      </div>
      {error && <div className="alert" role="alert">{error}</div>}

      <div className="filters" role="group" aria-label="Kategoriye göre filtrele">
        <button className="btn" aria-pressed={!cat && !onlyFav} onClick={() => { setCat(""); setOnlyFav(false); }}>Hepsi</button>
        <button className="btn" aria-pressed={onlyFav} onClick={() => setOnlyFav(!onlyFav)}>★ Favoriler ({fav.length})</button>
        {cats.map((m) => <button key={m} className="btn" aria-pressed={cat === m} onClick={() => setCat(cat === m ? "" : m)}>{m}</button>)}
      </div>

      <div className="mgrid">
        {mode === "picker" && (
          <article className="mcard">
            <div className="mcard-ic" aria-hidden>🎙</div>
            <div className="mcard-b">
              <h3>Fon kullanmadan devam et</h3>
              <p className="muted small">Yalnızca sesin</p>
              <div className="row" style={{ marginTop: 8 }}>
                <button className="btn" aria-pressed={!selectedId} onClick={() => onChoose?.(null)}>{!selectedId ? "✓ Seçili" : "Müziksiz"}</button>
              </div>
            </div>
          </article>
        )}
        {shown.map((i) => {
          const isFav = fav.includes(i.id), isSel = selectedId === i.id;
          return (
            <article key={i.id} className={"mcard" + (isSel ? " sel" : "")}>
              {i.cover ? <img src={i.cover} alt="" width={72} height={72} /> : <div className="mcard-ic" aria-hidden>🎵</div>}
              <div className="mcard-b">
                <h3>{i.title}</h3>
                <p className="muted small">{[i.artist, i.sub].filter(Boolean).join(" · ")}</p>
                {i.cats.length > 0 && <div className="chips">{i.cats.map((m) => <span key={m} className="chip">{m}</span>)}</div>}
                {i.note && <p className="small muted">{i.note}</p>}
                <div className="row" style={{ marginTop: 8 }}>
                  <button className="btn" aria-label={`${playing === i.id ? "Durdur" : "Ön izle"}: ${i.title}`} onClick={() => void preview(i.id)}><Icon name={playing === i.id ? "stop" : "play"} size={16} /> {playing === i.id ? "Durdur" : "Ön izle"}</button>
                  {mode === "picker" && <button className="btn primary" aria-pressed={isSel} onClick={() => onChoose?.(i.id)}>{isSel ? "✓ Seçili" : "Seç"}</button>}
                  {mode === "library" && <button className="btn primary" onClick={() => { player.current.stop(); onStart?.(i.id); }}>Bu müzikle başla</button>}
                  <button className="btn ghost" aria-pressed={isFav} aria-label={`Favori: ${i.title}`} onClick={() => toggleFav(i.id)}><Icon name="star" size={18} /></button>
                  {mode === "library" && isLocalTrack(i.id) && <button className="btn ghost" aria-label={`Sil: ${i.title}`} onClick={() => void remove(i)}><Icon name="trash" size={18} /></button>}
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {loading && <p className="muted">Yükleniyor…</p>}
      {!loading && items.length === 0 && <EmptyState icon="music" title="Henüz fon müziği yok" action={<AddMusicButton primary onAdded={(t) => { void mine.reload(); if (mode === "picker") onChoose?.(t.id); }} />}>MP3, WAV, M4A veya OGG yükleyebilirsin. Müzikler yalnızca bu cihazda saklanır.</EmptyState>}
      {!loading && items.length > 0 && shown.length === 0 && <p className="muted">Bu aramayla eşleşen fon yok.</p>}
    </>
  );
}
