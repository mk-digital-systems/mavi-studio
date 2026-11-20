import { useEffect, useRef, useState } from "react";
import type { ChannelId } from "../../shared/settings";
import { CHANNELS, type Desk } from "../../audio/broadcast/desk";

/** Seviye göstergesi: kendi rAF döngüsüyle çizer (React'i her karede yeniden çizdirmez). */
function Meter({ desk, id, color }: { desk: Desk; id: ChannelId | "master"; color: string }) {
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const db = desk.levelDb(id);
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

/**
 * Alttaki ince ses şeridi: dört ayrı kanal (mikrofon · fon · kayıtlı şiir · efektler) tek satırda.
 * Her kanalda başlat/durdur, seviye, sessize alma ve seviye göstergesi vardır; ayrıntılar (konuşma önceliği, varsayılana dönme) kapalı başlar.
 */
export function MixerStrip({ desk, tick, mic, music, voice, onStopSfx, ducking, micToOutput, warning }: P) {
  const [, force] = useState(0);
  void tick;
  const rows: { id: ChannelId; label: string; icon: string; on: boolean; fn: () => void; disabled?: boolean; sub?: string }[] = [
    { id: "mic", label: mic.on ? "Mikrofonu kapat" : "Mikrofonu aç", icon: "🎙", on: mic.on, fn: mic.toggle },
    { id: "music", label: music.playing ? "Fonu durdur" : "Fonu başlat", icon: music.playing ? "⏸" : "▶", on: music.playing, fn: music.toggle, disabled: !music.can, sub: music.label },
    { id: "voice", label: voice.playing ? "Duraklat" : "Oynat", icon: voice.playing ? "⏸" : "▶", on: voice.playing, fn: voice.toggle, disabled: !voice.can, sub: voice.label },
    { id: "sfx", label: "Efektleri durdur", icon: "■", on: desk.anySfxPlaying, fn: onStopSfx },
  ];
  return (
    <div className="strip" aria-label="Ses masası">
      {warning && <div className="alert strip-warn" role="alert">⚠ {warning}</div>}
      <div className="strip-row">
        {rows.map((r) => {
          const c = desk.ch[r.id], meta = CHANNELS.find((x) => x.id === r.id)!;
          return (
            <section key={r.id} className={"st-ch" + (c.muted ? " muted" : "")} style={{ ["--ch" as string]: meta.color }} aria-label={meta.label}>
              <button className={"st-act" + (r.on ? " on" : "")} disabled={r.disabled} aria-pressed={r.on} aria-label={r.label} title={r.label} onClick={r.fn}>{r.icon}</button>
              <div className="st-body">
                <span className="st-name">{meta.label}{r.sub ? <small> · {r.sub}</small> : null}</span>
                <Meter desk={desk} id={r.id} color={meta.color} />
                <input type="range" min={0} max={100} value={Math.round(c.volume * 100)} aria-label={`${meta.label} ses seviyesi`}
                  onChange={(e) => { desk.setVolume(r.id, +e.target.value / 100); force((n) => n + 1); }} />
              </div>
              <button className="st-mute" aria-pressed={c.muted} aria-label={c.muted ? `${meta.label} sesini aç` : `${meta.label} sessize al`} onClick={() => { desk.setMuted(r.id, !c.muted); force((n) => n + 1); }}>{c.muted ? "🔇" : "🔈"}</button>
            </section>
          );
        })}
        <section className="st-ch st-master" aria-label="Ana çıkış"><div className="st-body"><span className="st-name">Ana çıkış <small>· limiter açık</small></span><Meter desk={desk} id="master" color="#f3ece2" /></div></section>
      </div>
      {mic.err && <p className="small" role="alert" style={{ color: "var(--danger)", margin: "4px 0 0" }}>{mic.err}</p>}
      <details className="st-more">
        <summary>Ses ayrıntıları</summary>
        <div className="st-more-b">
          <label className="row chk"><input type="checkbox" checked={ducking.enabled} onChange={(e) => ducking.set(e.target.checked)} /> Konuşma önceliği: konuşurken fonu kıs{desk.ducking ? " · şimdi kısılıyor" : ""}</label>
          <label className="row chk"><input type="checkbox" checked={micToOutput.on} onChange={(e) => micToOutput.set(e.target.checked)} /> Mikrofonu ana çıkışa ver</label>
          <span className="row">{CHANNELS.map((c) => <button key={c.id} className="btn ghost" onClick={() => { desk.resetChannel(c.id); force((n) => n + 1); }}>{c.label} ↺</button>)}</span>
          <p className="small muted" style={{ margin: 0 }}>🎧 Fon mikrofona karışmasın diye <b>kulaklık</b> tak. Mikrofonu çıkışa verirken hoparlör kullanma.</p>
        </div>
      </details>
    </div>
  );
}
