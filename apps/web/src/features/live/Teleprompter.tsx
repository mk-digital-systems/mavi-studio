import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { PoemText } from "@siir/contracts";

export type TeleHandle = { stanza: (delta: 1 | -1) => void; top: () => void };

type P = {
  title: string; poet: string; stanzas: PoemText["stanzas"]; fontScale: number; speed: number;
  running: boolean;
  /** Başlatınca ilk satır ekranın ortasında bu kadar durur, sonra kayar. */
  holdMs?: number;
  /** Kayıtlı şiirde: sesle eş zamanlı vurgulanan satır; metin ona göre ortalanır (otomatik kaydırma kapalı). */
  activeLineId?: string | null;
  resetKey: string;
};

/** Büyük şiir metni. Canlı okumada otomatik kayar; kayıtlı şiirde ses konumunu izler. */
export const Teleprompter = forwardRef<TeleHandle, P>(function Teleprompter({ title, poet, stanzas, fontScale, speed, running, holdMs = 5000, activeLineId, resetKey }, ref) {
  const box = useRef<HTMLDivElement>(null);
  const holdUntil = useRef(0);
  const follow = activeLineId !== undefined;

  useEffect(() => { if (box.current) box.current.scrollTop = 0; }, [resetKey]);
  useEffect(() => { if (running) holdUntil.current = performance.now() + holdMs; }, [running, holdMs]);

  useEffect(() => {
    if (!running || follow) return;
    let raf = 0, last = performance.now(), pos = box.current?.scrollTop ?? 0;
    const tick = (now: number) => {
      if (now < holdUntil.current) { last = now; raf = requestAnimationFrame(tick); return; }
      pos += (speed * (now - last)) / 1000; last = now;
      if (box.current) box.current.scrollTop = pos; // pos birikir (piksel yuvarlaması küçük adımları yutmasın)
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, speed, follow]);

  useEffect(() => {
    if (!follow || !activeLineId || !box.current) return;
    box.current.querySelector(`[data-line="${activeLineId}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeLineId, follow]);

  useImperativeHandle(ref, () => ({
    top: () => { if (box.current) box.current.scrollTop = 0; },
    stanza: (d) => {
      const el = box.current; if (!el) return;
      const list = [...el.querySelectorAll<HTMLElement>("[data-stanza]")], mid = el.scrollTop + el.clientHeight * 0.45;
      let cur = 0; list.forEach((n, i) => { if (n.offsetTop <= mid) cur = i; });
      const t = list[Math.max(0, Math.min(list.length - 1, cur + d))];
      if (t) el.scrollTo({ top: t.offsetTop - el.clientHeight * 0.4, behavior: "smooth" });
    },
  }), []);

  return (
    <div ref={box} className="tele" tabIndex={0} aria-label="Şiir metni" style={{ ["--rs" as string]: fontScale }}>
      <div aria-hidden="true" style={{ height: "45%" }} />
      <h2 className="tele-title">{title || "Şiir seçilmedi"}</h2>
      {poet && <p className="tele-poet">{poet}</p>}
      {stanzas.map((s) => (
        <div key={s.id} className="tele-stanza" data-stanza={s.id}>
          {s.lines.map((l) => <div key={l.id} data-line={l.id} className={"tele-line" + (follow && activeLineId === l.id ? " on" : "")}>{l.text}</div>)}
        </div>
      ))}
      <div aria-hidden="true" style={{ height: "55%" }} />
    </div>
  );
});
