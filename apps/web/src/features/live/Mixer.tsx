import { useEffect, useRef, useState } from "react";
import type { ChannelId } from "../../shared/settings";
import { CHANNELS, type Desk } from "../../audio/broadcast/desk";

/** Seviye göstergesi: kendi rAF döngüsüyle çizer (React'i her karede yeniden çizdirmez). */
function Meter({ desk, id, color }: { desk: Desk; id: ChannelId | "master"; color: string }) {
  const bar = useRef<HTMLDivElement>(null);
  const hold = useRef(-120);
  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const db = desk.levelDb(id); hold.current = Math.max(db, hold.current - 0.6);
      const pct = Math.max(0, Math.min(100, ((db + 60) / 60) * 100));
      if (bar.current) { bar.current.style.width = pct + "%"; bar.current.dataset.hot = db > -3 ? "1" : "0"; }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [desk, id]);
  return <div className="mx-meter" role="meter" aria-label={`${id} seviyesi`} aria-valuemin={-60} aria-valuemax={0}><div ref={bar} style={{ background: color }} /></div>;
}

type P = {
  desk: Desk; tick: number;
  mic: { on: boolean; toggle: () => void; err: string };
  music: { playing: boolean; toggle: () => void; label: string; can: boolean };
  voice: { playing: boolean; toggle: () => void; label: string; can: boolean };
  onStopSfx: () => void;
  ducking: { enabled: boolean; set: (on: boolean) => void };
  micToOutput: { on: boolean; set: (on: boolean) => void };
  warning: string;
};

/** Sağ taraf: ses masası. Her kanalda seviye, sessize alma, başlat/durdur, seviye göstergesi ve varsayılana dönme. */
export function Mixer({ desk, tick, mic, music, voice, onStopSfx, ducking, micToOutput, warning }: P) {
  const [, force] = useState(0);
  void tick;
  const rows: { id: ChannelId; action: { label: string; on: boolean; fn: () => void; disabled?: boolean; sub?: string } }[] = [
    { id: "mic", action: { label: mic.on ? "Mikrofonu kapat" : "Mikrofonu aç", on: mic.on, fn: mic.toggle } },
    { id: "music", action: { label: music.playing ? "Fonu durdur" : "Fonu başlat", on: music.playing, fn: music.toggle, disabled: !music.can, sub: music.label } },
    { id: "voice", action: { label: voice.playing ? "Duraklat" : "Oynat", on: voice.playing, fn: voice.toggle, disabled: !voice.can, sub: voice.label } },
    { id: "sfx", action: { label: "Efektleri durdur", on: desk.anySfxPlaying, fn: onStopSfx } },
  ];
  return (
    <div className="mixer" aria-label="Ses masası">
      {warning && <div className="alert" role="alert" style={{ margin: 0 }}>⚠ {warning}</div>}
      {rows.map(({ id, action }) => {
        const c = desk.ch[id], meta = CHANNELS.find((x) => x.id === id)!;
        return (
          <section key={id} className={"mx-ch" + (c.muted ? " muted" : "")} style={{ ["--ch" as string]: meta.color }} aria-label={meta.label}>
            <div className="mx-h"><b>{meta.label}</b>{action.sub && <span className="small muted mx-sub">{action.sub}</span>}</div>
            <Meter desk={desk} id={id} color={meta.color} />
            <input type="range" min={0} max={100} value={Math.round(c.volume * 100)} aria-label={`${meta.label} ses seviyesi`}
              onChange={(e) => { desk.setVolume(id, +e.target.value / 100); force((n) => n + 1); }} />
            <div className="mx-btns">
              <button className={"btn" + (action.on ? " on" : "")} disabled={action.disabled} onClick={action.fn} aria-pressed={action.on}>{action.label}</button>
              <button className="btn" aria-pressed={c.muted} onClick={() => { desk.setMuted(id, !c.muted); force((n) => n + 1); }}>{c.muted ? "Sesi aç" : "Sessize al"}</button>
              <button className="btn ghost" onClick={() => { desk.resetChannel(id); force((n) => n + 1); }} title="Varsayılan seviyeye dön">↺</button>
            </div>
            {id === "mic" && mic.err && <p className="small" role="alert" style={{ color: "var(--danger)", margin: 0 }}>{mic.err}</p>}
          </section>
        );
      })}
      <section className="mx-ch master" aria-label="Ana çıkış"><div className="mx-h"><b>Ana çıkış</b><span className="small muted">limiter açık</span></div><Meter desk={desk} id="master" color="#f3ece2" /></section>
      <label className="row chk"><input type="checkbox" checked={ducking.enabled} onChange={(e) => ducking.set(e.target.checked)} /> Konuşma önceliği: konuşurken fonu kıs{desk.ducking ? " · şimdi kısılıyor" : ""}</label>
      <label className="row chk"><input type="checkbox" checked={micToOutput.on} onChange={(e) => micToOutput.set(e.target.checked)} /> Mikrofonu ana çıkışa ver</label>
      <p className="small muted" style={{ margin: 0 }}>🎧 Fon mikrofona karışmasın diye <b>kulaklık</b> tak. Mikrofonu çıkışa verirken hoparlör kullanma.</p>
    </div>
  );
}
