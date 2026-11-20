import { useCallback, useEffect, useRef, useState } from "react";
import type { AtmosphereId, FxControls, FxModuleId, FxSettings, Take } from "@siir/contracts";
import type { Draft, Patch } from "../App";
import type { Analysis } from "../audio/fx/analysis";
import { analysisFor, cachedAnalysis } from "../audio/fx/analysisCache";
import { FxPlayer } from "../audio/fx/player";
import { applyPreset, CONTROL_RANGES, defaultFx, FX_MODULES, LIMITS, PRESET_ORDER, PRESETS, resolveParams, sanitizeFx } from "../audio/fx/settings";
import { openTakeReader, type TakeReader } from "../storage/takeReader";
import { putTake } from "../storage/repo";
import { effectiveFx } from "../storage/migrate";
import { fmt } from "../shared/util";

const db1 = (v: number) => (v <= -100 ? "−∞" : `${v.toFixed(1).replace("-", "−")} dB`);

type Props = { draft: Draft; patch: Patch; take: Take; reloadTakes: () => Promise<void>; onClose: () => void };

function LevelBar({ label, db, kind }: { label: string; db: number; kind: "in" | "out" }) {
  const pct = Math.max(0, Math.min(100, ((db + 60) / 60) * 100));
  const state = db > -1 ? (kind === "in" ? "clip" : "limit") : db > -6 ? "high" : db < -45 ? "low" : "ok";
  const icon = { clip: "⛔", limit: "⛔", high: "⚠", low: "🔇", ok: "✔" }[state];
  const text = { clip: kind === "in" ? "taşma" : "sınırlanıyor", limit: "sınırlanıyor", high: "yüksek", low: "çok düşük", ok: "iyi" }[state];
  return (
    <div>
      <div className="row between small"><span>{label}</span><span aria-live="off">{icon} {db1(db)} · {text}</span></div>
      <div className={"meter" + (state === "clip" || state === "limit" ? " clip" : "")} role="meter" aria-label={label}
        aria-valuemin={-60} aria-valuemax={0} aria-valuenow={Math.round(Math.max(-60, db))} aria-valuetext={`${db1(db)}, ${text}`}>
        <div style={{ width: pct + "%" }} />
      </div>
    </div>
  );
}

export function FxStudio({ draft, patch, take, reloadTakes, onClose }: Props) {
  const [settings, setSettings] = useState<FxSettings>(() => sanitizeFx(effectiveFx(draft, take)));
  const [analysis, setAnalysis] = useState<Analysis | null>(cachedAnalysis(take.id));
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState("");
  const [playing, setPlaying] = useState(false);
  const [mode, setMode] = useState<"processed" | "original">("processed");
  const [pos, setPos] = useState(0);
  const [lv, setLv] = useState({ inDb: -120, outDb: -120, maxOutDb: -120 });
  const [advanced, setAdvanced] = useState(false);
  const [saved, setSaved] = useState("");
  const player = useRef<FxPlayer | null>(null);
  const reader = useRef<TakeReader | null>(null);
  const saveTimer = useRef(0);
  const settingsRef = useRef(settings); settingsRef.current = settings;

  // Çözümleme (kayıt diskten akışla okunur)
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const r = await openTakeReader(take);
        if (dead) return;
        reader.current = r;
        const a = await analysisFor(take, r, (p) => !dead && setProgress(p));
        if (!dead) setAnalysis(a);
      } catch { if (!dead) setErr("Kayıt okunamadı."); }
    })();
    return () => { dead = true; };
  }, [take]);

  // Oynatıcı yaşam döngüsü: sayfadan/ekrandan çıkınca AudioContext kapatılır
  useEffect(() => {
    if (!analysis || !reader.current) return;
    const p = new FxPlayer(reader.current, analysis, settingsRef.current, `fx-${take.id}`);
    p.onEnded = () => setPlaying(false);
    p.onError = (m) => { setErr(m); setPlaying(false); };
    player.current = p;
    const dispose = () => p.dispose();
    window.addEventListener("pagehide", dispose);
    return () => { window.removeEventListener("pagehide", dispose); dispose(); player.current = null; setPlaying(false); };
  }, [analysis, take.id]);

  // Konum ve seviye göstergeleri
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => { const p = player.current; if (p) { setPos(p.position()); setLv(p.levels()); } raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  // Ayarlar yalnızca ayar olarak saklanır (ses dosyasına işlenmez)
  const flushSave = useCallback(async () => {
    clearTimeout(saveTimer.current);
    await putTake({ ...take, fx: settingsRef.current });
    setSaved("Ayarlar bu denemeye kaydedildi.");
    await reloadTakes();
  }, [take, reloadTakes]);
  const change = (next: FxSettings) => {
    setSettings(next); player.current?.setSettings(next); setSaved("");
    clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => void flushSave(), 500);
  };
  useEffect(() => () => { if (saveTimer.current) void putTake({ ...take, fx: settingsRef.current }); }, [take]);

  const toggle = async () => {
    const p = player.current; if (!p) return;
    if (p.isPlaying) { p.pause(); setPlaying(false); } else { await p.play(); setPlaying(true); }
  };
  const setCtl = (k: keyof FxControls, v: number) => change({ ...settings, controls: { ...settings.controls, [k]: v } });
  const toggleBypass = (m: FxModuleId) => change({ ...settings, bypass: { ...settings.bypass, [m]: !settings.bypass[m] || undefined } });
  const setModeBoth = (m: "processed" | "original") => { setMode(m); player.current?.setMode(m); };
  const reset = () => change({ ...defaultFx(settings.preset) });

  const a = analysis;
  const dur = a?.durationSec ?? take.durationMs / 1000;
  const rp = a ? resolveParams(settings, a) : null;

  return (
    <section className="card" aria-labelledby="fx-h">
      <div className="row between">
        <h2 id="fx-h">Ses stüdyosu</h2>
        <button className="btn ghost" onClick={onClose}>Kapat</button>
      </div>
      <p className="muted small">Efektler kaydına işlenmez; yalnızca ayar olarak saklanır ve istediğin an geri alınır. Kalıcı uygulama dışa aktarmada yapılır. Orijinal kaydın hiçbir zaman değişmez.</p>
      {err && <div className="alert" role="alert">{err}</div>}
      {!a && !err && (
        <div role="status"><p className="muted">Kayıt inceleniyor… %{Math.round(progress * 100)}</p>
          <div className="meter"><div style={{ width: progress * 100 + "%" }} /></div></div>
      )}

      {a && (<>
        {a.flags.silent && <div className="warn" role="alert">🔇 <b>Sessiz kayıt.</b> Kayıtta konuşma seviyesi neredeyse yok; mikrofonun açık ve seçili olduğundan emin olup yeniden kaydet. Efektler sessiz kaydı yükseltmez.</div>}
        {a.flags.tooQuiet && <div className="warn" role="alert">⚠ <b>Fazla düşük kayıt.</b> Ses çok alçak ({db1(a.speechDb)}). Mikrofona biraz yaklaşıp yeniden kaydetmek daha temiz sonuç verir.</div>}
        {a.flags.clipping && <div className="alert" role="alert">⛔ <b>Kayıtta taşma var</b> ({a.clippedSamples} örnek). Taşmış ses efektlerle düzeltilemez; mikrofondan uzaklaşıp yeniden kaydet.</div>}

        <div className="row" style={{ marginBottom: 12 }}>
          <button className="btn primary" onClick={() => void toggle()} aria-label={playing ? "Durdur" : "Oynat"}>{playing ? "■ Durdur" : "▶ Oynat"}</button>
          <div className="seg" role="group" aria-label="Önce / Sonra karşılaştırma">
            <button className="btn" aria-pressed={mode === "original"} onClick={() => setModeBoth("original")}>Önce (işlenmemiş)</button>
            <button className="btn" aria-pressed={mode === "processed"} onClick={() => setModeBoth("processed")}>Sonra (efektli)</button>
          </div>
        </div>
        <p className="small muted" aria-live="polite">Şu an: <b>{mode === "original" ? "işlenmemiş ses" : settings.enabled ? "efektli ses" : "efektler kapalı"}</b> · karşılaştırma seviyeleri eşitlenir.</p>

        <label htmlFor="pos">Konum {fmt(pos * 1000)} / {fmt(dur * 1000)}</label>
        <input id="pos" type="range" min={0} max={Math.max(1, Math.floor(dur * 10))} value={Math.floor(pos * 10)}
          onChange={(e) => { const s = +e.target.value / 10; setPos(s); player.current?.seek(s); }} />

        <div className="grid2" style={{ margin: "14px 0" }}>
          <LevelBar label="Giriş seviyesi (kayıt)" db={lv.inDb} kind="in" />
          <LevelBar label="Çıkış seviyesi (işlenmiş)" db={lv.outDb} kind="out" />
        </div>
        <p className="small muted">En yüksek çıkış tepesi: <b>{db1(lv.maxOutDb)}</b> (güvenli sınır {LIMITS.limiterCeilingDb} dBFS — aşılmaz).</p>

        <h3>Atmosfer</h3>
        <div className="grid" role="group" aria-label="Atmosfer seçimi">
          {PRESET_ORDER.map((id: AtmosphereId) => (
            <button key={id} className="track" aria-pressed={settings.preset === id} onClick={() => change(applyPreset(settings, id))}>
              <span><b>{PRESETS[id].label}</b><span className="muted small">{PRESETS[id].description}</span></span>
            </button>
          ))}
        </div>

        <h3 style={{ marginTop: 18 }}>Ayarlar</h3>
        <div className="sliders">
          {(Object.keys(CONTROL_RANGES) as (keyof FxControls)[]).map((k) => {
            const r = CONTROL_RANGES[k];
            return (
              <div key={k}>
                <label htmlFor={"c-" + k}>{r.label}: <b>{k === "outputDb" ? `${settings.controls[k] > 0 ? "+" : ""}${settings.controls[k]} dB` : Math.round(settings.controls[k])}</b></label>
                <input id={"c-" + k} type="range" min={r.min} max={r.max} step={r.step} value={settings.controls[k]}
                  aria-describedby={"h-" + k} onChange={(e) => setCtl(k, +e.target.value)} />
                <div id={"h-" + k} className="small muted">{r.hint}</div>
              </div>
            );
          })}
        </div>

        <div className="row" style={{ marginTop: 14 }}>
          <button className="btn" aria-pressed={!settings.enabled} onClick={() => change({ ...settings, enabled: !settings.enabled })}>
            {settings.enabled ? "Efektleri kapat" : "Efektleri aç"}
          </button>
          <button className="btn ghost" onClick={reset}>Varsayılana dön</button>
          <button className="btn ghost" onClick={() => { patch({ fx: settings }); setSaved("Bu ayar çalışmanın varsayılanı yapıldı."); }}>Çalışma varsayılanı yap</button>
        </div>
        {saved && <p className="small muted" role="status">{saved}</p>}

        <details style={{ marginTop: 14 }} open={advanced} onToggle={(e) => setAdvanced((e.target as HTMLDetailsElement).open)}>
          <summary>Gelişmiş (teknik)</summary>
          <p className="small muted">Her işlem ayrı bir modüldür; tek tek kapatabilirsin. DC temizliği ve tepe sınırlayıcı güvenlik için her zaman açıktır.</p>
          {FX_MODULES.map((m) => (
            <label key={m.id} className="row chk"><input type="checkbox" checked={!settings.bypass[m.id]} onChange={() => toggleBypass(m.id)} /> {m.label}</label>
          ))}
          {rp && (
            <pre className="small" style={{ whiteSpace: "pre-wrap" }}>{
`giriş kazancı: ${rp.inputDb.toFixed(1)} dB · high-pass: ${rp.hpfHz.toFixed(0)} Hz
kapı eşiği: ${rp.expander.thrDb.toFixed(1)} dB · aralık: ${rp.expander.rangeDb.toFixed(1)} dB
kompresör eşiği: ${rp.comp.thrDb.toFixed(1)} dB · oran: ${rp.comp.ratio}:1
s-yumuşatıcı: en çok ${rp.deess.maxRedDb} dB
yankı: %${(rp.wet * 100).toFixed(0)} (üst sınır %${LIMITS.maxWet * 100}) · süre ${rp.reverb.decaySec}s`}</pre>
          )}
          <p className="small muted"><b>Teknik sınırlamalar:</b> Tepe sınırlayıcı örnek tepesini garanti eder; gerçek (örnekler arası) tepe ölçülmez, bu yüzden {LIMITS.limiterCeilingDb} dBFS tavan seçildi. S-yumuşatıcı basit bir tek-bant yöntemdir. Yankı tamamen uygulama içinde üretilir (dış dürtü yanıtı dosyası yok). Taşmış kayıt ve gürültülü ortam düzeltilemez.</p>
        </details>
      </>)}
    </section>
  );
}
