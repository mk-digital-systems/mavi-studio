import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "../shell/icons";
import { addLocalTrack, checkMusicFile, listLocalTracks, type LocalTrack } from "../storage/music";

export function useLocalTracks() {
  const [tracks, setTracks] = useState<LocalTrack[] | null>(null);
  const reload = useCallback(async () => {
    try { setTracks(await listLocalTracks()); } catch { setTracks([]); }
  }, []);
  useEffect(() => { void reload(); }, [reload]);
  return { tracks, reload };
}

export const fmtSize = (b: number) => (b >= 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1024)) + " KB");
export const fmtDur = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

export const CATEGORIES = ["sakin", "hüzünlü", "umutlu", "dramatik", "nostaljik", "doğa", "enstrümantal"];

/**
 * "+ Fon Yükle": ses dosyasını doğrular, adı / sanatçısı / kategorisi / telif notuyla cihazdaki fon kütüphanesine ekler.
 * Dosya sunucuya gönderilmez ve ham olarak indirilemez.
 */
export function UploadMusicDialog({ onClose, onAdded }: { onClose: () => void; onAdded: (t: LocalTrack) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [busy, onClose]);

  const choose = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    const bad = checkMusicFile(f);
    if (bad) { setErr(bad); setFile(null); return; }
    setErr(""); setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, "").slice(0, 80));
  };
  const save = async () => {
    if (!file) return;
    setBusy(true); setErr("");
    try { onAdded(await addLocalTrack(file, { title, artist, category, note })); onClose(); }
    catch (x) { setErr(x instanceof Error ? x.message : "Eklenemedi."); setBusy(false); }
  };

  return (
    <div className="vs-modal" role="dialog" aria-modal="true" aria-labelledby="um-h" onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="card vs-pick">
        <div className="row between"><h3 id="um-h">Fon müziği yükle</h3><button className="btn ghost" onClick={onClose} disabled={busy}>Kapat</button></div>
        <p className="small muted">MP3, WAV, M4A veya OGG (en fazla 80 MB). Dosya yalnızca bu cihazda saklanır, sunucuya gönderilmez ve ham olarak indirilemez. Yalnızca kullanım hakkına sahip olduğun müzikleri yükle.</p>
        {err && <div className="alert" role="alert">{err}</div>}
        <div className="row" style={{ marginBottom: 12 }}>
          <button className="btn" onClick={() => input.current?.click()}><Icon name="folder" size={18} /> {file ? "Başka dosya seç" : "Dosya seç"}</button>
          <span className="small muted">{file ? `${file.name} · ${(file.size / 1048576).toFixed(1)} MB` : "Henüz dosya seçilmedi"}</span>
          <input ref={input} type="file" accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a,audio/ogg,.mp3,.wav,.m4a,.ogg" hidden onChange={choose} />
        </div>
        <div className="sliders">
          <div><label htmlFor="um-t">Fon adı</label><input id="um-t" type="text" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div><label htmlFor="um-a">Sanatçı</label><input id="um-a" type="text" maxLength={80} value={artist} onChange={(e) => setArtist(e.target.value)} /></div>
          <div>
            <label htmlFor="um-c">Kategori</label>
            <input id="um-c" type="text" list="um-cats" maxLength={30} value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Örn. sakin" />
            <datalist id="um-cats">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <label htmlFor="um-n">Telif notu (isteğe bağlı)</label>
          <input id="um-n" type="text" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Örn. Kendi bestem / CC-BY, kaynak: …" />
        </div>
        <div className="row" style={{ marginTop: 16 }}>
          <button className="btn primary" disabled={!file || busy} onClick={() => void save()}>{busy ? "Ekleniyor…" : "Kaydet ve ekle"}</button>
        </div>
      </div>
    </div>
  );
}

/** Tek düğme: tıklanınca yükleme penceresini açar. */
export function AddMusicButton({ onAdded, primary }: { onAdded: (t: LocalTrack) => void; primary?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={"btn" + (primary ? " primary" : "")} onClick={() => setOpen(true)}><Icon name="plus" size={18} /> Fon yükle</button>
      {open && <UploadMusicDialog onClose={() => setOpen(false)} onAdded={onAdded} />}
    </>
  );
}
