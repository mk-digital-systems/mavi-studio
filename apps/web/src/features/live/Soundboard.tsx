import { useEffect } from "react";
import type { Desk } from "../../audio/broadcast/desk";
import { getSfxBlob, SFX_ICONS, updateSfx, type SfxItem } from "../../storage/sfx";

type P = { desk: Desk; items: SfxItem[] | null; tick: number; onChanged: () => void; onError: (m: string) => void };

/** Klavye kısayolu yazı alanlarında çalışmaz. */
const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) && (t as HTMLInputElement).type !== "range" && (t as HTMLInputElement).type !== "checkbox");

/** Büyük düğmelerden oluşan efekt paneli: dokununca çalar, tekrar dokununca durur; favoriler üstte; klavye kısayolları. */
export function Soundboard({ desk, items, tick, onChanged, onError }: P) {
  void tick;
  const play = (it: SfxItem) => { desk.playSfx(it, () => getSfxBlob(it.id)).catch((e) => onError(e instanceof Error ? e.message : "Efekt çalınamadı.")); };

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
      const it = items?.find((x) => x.shortcut && x.shortcut === e.key.toLowerCase());
      if (it) { e.preventDefault(); play(it); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  if (items === null) return <p className="muted">Efektler yükleniyor…</p>;
  if (items.length === 0) return <p className="muted">Henüz ses efekti yok. “Ses Efektleri” sayfasından ekleyebilirsin.</p>;
  return (
    <>
      <div className="sb-grid" role="group" aria-label="Ses efektleri">
        {items.map((it) => {
          const on = desk.sfxPlaying(it.id);
          return (
            <button key={it.id} className={"sb-btn" + (on ? " on" : "")} aria-pressed={on} onClick={() => play(it)} title={`${it.category}${it.shortcut ? ` · kısayol: ${it.shortcut.toUpperCase()}` : ""}`}>
              <span className="sb-ic" aria-hidden>{SFX_ICONS[it.category] ?? "✨"}</span>
              <span className="sb-n">{it.favorite && "★ "}{it.name}</span>
              <span className="sb-c small">{it.category}</span>
              {it.shortcut && <kbd className="sb-k">{it.shortcut.toUpperCase()}</kbd>}
            </button>
          );
        })}
      </div>
      <details className="sb-levels">
        <summary>Efekt seviyeleri</summary>
        {items.map((it) => (
          <label key={it.id} className="fs-l" style={{ margin: "4px 0" }}>{it.name}
            <input type="range" min={0} max={100} value={Math.round(it.defaultVolume * 100)} aria-label={`${it.name} seviyesi`}
              onChange={(e) => { void updateSfx(it.id, { defaultVolume: +e.target.value / 100 }).then(onChanged); }} />
          </label>
        ))}
      </details>
    </>
  );
}
