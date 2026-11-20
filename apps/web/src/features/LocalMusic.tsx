import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "../shell/icons";
import { addLocalTrack, listLocalTracks, type LocalTrack } from "../storage/music";

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

/** "+ Yeni fon müziği": cihazdan ses dosyası seçer ve yerel kütüphaneye ekler. Dosya sunucuya gönderilmez. */
export function AddMusicButton({ onAdded, onError, primary }: { onAdded: (t: LocalTrack[]) => void; onError?: (m: string) => void; primary?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])]; e.target.value = "";
    if (!files.length) return;
    setBusy(true); onError?.("");
    const added: LocalTrack[] = [], errs: string[] = [];
    for (const f of files) {
      try { added.push(await addLocalTrack(f)); } catch (x) { errs.push(`${f.name}: ${x instanceof Error ? x.message : "eklenemedi"}`); }
    }
    setBusy(false);
    if (errs.length) onError?.(errs.join(" "));
    if (added.length) onAdded(added);
  }
  return (
    <>
      <button className={"btn" + (primary ? " primary" : "")} disabled={busy} onClick={() => input.current?.click()}>
        <Icon name="plus" size={18} /> {busy ? "Ekleniyor…" : "Yeni fon müziği"}
      </button>
      <input ref={input} type="file" accept="audio/*" multiple hidden onChange={pick} />
    </>
  );
}
