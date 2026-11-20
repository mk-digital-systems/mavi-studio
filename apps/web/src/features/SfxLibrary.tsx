import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "../shell/icons";
import { checkMusicFile } from "../storage/music";
import { addSfx, deleteSfx, getSfxBlob, listSfx, safeStartVolume, SFX_CATEGORIES, SFX_ICONS, updateSfx, type SfxItem } from "../storage/sfx";
import { EmptyState, PageHeader } from "./parts";

type Fields = Pick<SfxItem, "name" | "category" | "defaultVolume" | "fadeInSec" | "fadeOutSec" | "shortcut" | "loop" | "maxVoices" | "source" | "license">;

/** Ses efekti ayarları: hem eklerken hem düzenlerken aynı alanlar. */
function SfxFields({ v, set, others, idp }: { v: Fields; set: (p: Partial<Fields>) => void; others: SfxItem[]; idp: string }) {
  const clash = v.shortcut && others.find((o) => o.shortcut === v.shortcut);
  return (
    <div className="sliders">
      <div><label htmlFor={idp + "n"}>Efekt adı</label><input id={idp + "n"} type="text" maxLength={60} value={v.name} onChange={(e) => set({ name: e.target.value })} /></div>
      <div>
        <label htmlFor={idp + "c"}>Kategori</label>
        <select id={idp + "c"} value={v.category} onChange={(e) => set({ category: e.target.value, defaultVolume: safeStartVolume(e.target.value) })}>
          {SFX_CATEGORIES.map((c) => <option key={c} value={c}>{SFX_ICONS[c]} {c}</option>)}
        </select>
      </div>
      <div><label htmlFor={idp + "v"}>Varsayılan seviye: <b>{Math.round(v.defaultVolume * 100)}%</b></label><input id={idp + "v"} type="range" min={0} max={100} value={Math.round(v.defaultVolume * 100)} onChange={(e) => set({ defaultVolume: +e.target.value / 100 })} />
        <div className="small muted">Yüksek sesli kategorilerde güvenli başlangıç seviyesi önerilir.</div></div>
      <div><label htmlFor={idp + "fi"}>Başlangıç yumuşatma: <b>{v.fadeInSec} sn</b></label><input id={idp + "fi"} type="range" min={0} max={5} step={0.1} value={v.fadeInSec} onChange={(e) => set({ fadeInSec: +e.target.value })} /></div>
      <div><label htmlFor={idp + "fo"}>Bitiş yumuşatma: <b>{v.fadeOutSec} sn</b></label><input id={idp + "fo"} type="range" min={0} max={5} step={0.1} value={v.fadeOutSec} onChange={(e) => set({ fadeOutSec: +e.target.value })} /></div>
      <div><label htmlFor={idp + "k"}>Klavye kısayolu (tek tuş)</label><input id={idp + "k"} type="text" maxLength={1} value={v.shortcut} onChange={(e) => set({ shortcut: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "") })} placeholder="Örn. 1" />
        {clash && <div className="small" style={{ color: "var(--danger)" }}>Bu tuş “{clash.name}” efektinde kullanılıyor.</div>}</div>
      <div><label htmlFor={idp + "m"}>Aynı anda en çok: <b>{v.maxVoices}</b></label><input id={idp + "m"} type="range" min={1} max={4} value={v.maxVoices} onChange={(e) => set({ maxVoices: +e.target.value })} /></div>
      <label className="row chk"><input type="checkbox" checked={v.loop} onChange={(e) => set({ loop: e.target.checked })} /> Tekrar çalmaya izin ver (döngü)</label>
      <div><label htmlFor={idp + "s"}>Kaynak</label><input id={idp + "s"} type="text" maxLength={120} value={v.source} onChange={(e) => set({ source: e.target.value })} /></div>
      <div><label htmlFor={idp + "l"}>Lisans notu</label><input id={idp + "l"} type="text" maxLength={300} value={v.license} onChange={(e) => set({ license: e.target.value })} /></div>
    </div>
  );
}
const blank = (): Fields => ({ name: "", category: "Özel efektler", defaultVolume: safeStartVolume("Özel efektler"), fadeInSec: 0, fadeOutSec: 0.05, shortcut: "", loop: false, maxVoices: 1, source: "", license: "" });

function AddDialog({ onClose, onAdded, items }: { onClose: () => void; onAdded: () => void; items: SfxItem[] }) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [v, setV] = useState<Fields>(blank());
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [busy, onClose]);
  const choose = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
    const bad = checkMusicFile(f); if (bad) { setErr(bad); setFile(null); return; }
    setErr(""); setFile(f); if (!v.name) setV({ ...v, name: f.name.replace(/\.[^.]+$/, "").slice(0, 60) });
  };
  const save = async () => { if (!file) return; setBusy(true); setErr(""); try { await addSfx(file, v); onAdded(); onClose(); } catch (x) { setErr(x instanceof Error ? x.message : "Eklenemedi."); setBusy(false); } };
  return (
    <div className="vs-modal" role="dialog" aria-modal="true" aria-labelledby="sx-h" onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="card vs-pick">
        <div className="row between"><h3 id="sx-h">Ses efekti ekle</h3><button className="btn ghost" onClick={onClose} disabled={busy}>Kapat</button></div>
        <p className="small muted">MP3, WAV, M4A veya OGG (en fazla 20 MB). Efekt yalnızca bu cihazda saklanır. Yalnızca kullanım hakkına sahip olduğun sesleri ekle.</p>
        {err && <div className="alert" role="alert">{err}</div>}
        <div className="row" style={{ marginBottom: 12 }}>
          <button className="btn" onClick={() => input.current?.click()}><Icon name="folder" size={18} /> {file ? "Başka dosya seç" : "Dosya seç"}</button>
          <span className="small muted">{file ? file.name : "Henüz dosya seçilmedi"}</span>
          <input ref={input} type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg" hidden onChange={choose} />
        </div>
        <SfxFields v={v} set={(p) => setV({ ...v, ...p })} others={items} idp="ax-" />
        <div className="row" style={{ marginTop: 16 }}><button className="btn primary" disabled={!file || busy} onClick={() => void save()}>{busy ? "Ekleniyor…" : "Kaydet ve ekle"}</button></div>
      </div>
    </div>
  );
}

function Row({ it, items, onChanged }: { it: SfxItem; items: SfxItem[]; onChanged: () => void }) {
  const [v, setV] = useState<Fields>(it);
  const [playing, setPlaying] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => { audio.current?.pause(); }, []);
  const preview = async () => {
    if (playing) { audio.current?.pause(); setPlaying(false); return; }
    const a = new Audio(URL.createObjectURL(await getSfxBlob(it.id))); a.volume = it.defaultVolume; audio.current = a; a.onended = () => setPlaying(false);
    setPlaying(true); await a.play();
  };
  return (
    <li className="pcard">
      <h3>{SFX_ICONS[it.category]} {it.name}</h3>
      <p className="muted small">{it.category} · {it.durationSec.toFixed(1)} sn · seviye {Math.round(it.defaultVolume * 100)}%{it.shortcut ? ` · kısayol ${it.shortcut.toUpperCase()}` : ""}{it.loop ? " · döngü" : ""} · {new Date(it.createdAt).toLocaleDateString("tr-TR")}</p>
      {(it.source || it.license) && <p className="small muted">{[it.source, it.license].filter(Boolean).join(" · ")}</p>}
      <div className="row pcard-act">
        <button className="btn" onClick={() => void preview()}>{playing ? "■ Durdur" : "▶ Dinle"}</button>
        <button className="btn ghost" aria-pressed={it.favorite} onClick={() => void updateSfx(it.id, { favorite: !it.favorite }).then(onChanged)}><Icon name="star" size={18} /> Favori</button>
        <button className="btn ghost" aria-label={`${it.name} efektini sil`} onClick={async () => { if (!confirm(`“${it.name}” silinsin mi?`)) return; await deleteSfx(it.id); onChanged(); }}><Icon name="trash" size={18} /></button>
      </div>
      <details><summary>Ayarlar</summary>
        <SfxFields v={v} set={(p) => setV({ ...v, ...p })} others={items.filter((o) => o.id !== it.id)} idp={"ed" + it.id + "-"} />
        <button className="btn primary" style={{ marginTop: 10 }} onClick={() => void updateSfx(it.id, v).then(onChanged)}>Kaydet</button>
      </details>
    </li>
  );
}

/** Ses Efektleri (Yayın Stüdyosu): kendi efektlerini ekle, kategorile, dinle, favorile, kısayol ata. */
export function SfxLibrary() {
  const [items, setItems] = useState<SfxItem[] | null>(null);
  const [cat, setCat] = useState("");
  const [add, setAdd] = useState(false);
  const reload = useCallback(() => { void listSfx().then(setItems).catch(() => setItems([])); }, []);
  useEffect(reload, [reload]);
  const shown = (items ?? []).filter((i) => !cat || i.category === cat);
  return (
    <>
      <PageHeader title="Ses Efektleri" sub="Yayın Stüdyosu · kendi efektlerini ekle ve yayında kullan" actions={<button className="btn primary" onClick={() => setAdd(true)}><Icon name="plus" size={18} /> Efekt ekle</button>} />
      <div className="filters" role="group" aria-label="Kategoriye göre filtrele">
        <button className="btn" aria-pressed={!cat} onClick={() => setCat("")}>Hepsi</button>
        {SFX_CATEGORIES.filter((c) => (items ?? []).some((i) => i.category === c)).map((c) => <button key={c} className="btn" aria-pressed={cat === c} onClick={() => setCat(cat === c ? "" : c)}>{SFX_ICONS[c]} {c}</button>)}
      </div>
      {items === null ? <p className="muted">Yükleniyor…</p> : items.length === 0 ? (
        <EmptyState icon="music" title="Henüz ses efekti yok" action={<button className="btn primary" onClick={() => setAdd(true)}>Efekt ekle</button>}>Alkış, yağmur, zil… Kendi ses dosyalarını yükle; yayın masasında düğme olarak çıkar.</EmptyState>
      ) : <ul className="plist sfx-list">{shown.map((i) => <Row key={i.id + i.name} it={i} items={items} onChanged={reload} />)}</ul>}
      {add && <AddDialog onClose={() => setAdd(false)} onAdded={reload} items={items ?? []} />}
    </>
  );
}
