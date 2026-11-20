import { useCallback, useEffect, useRef, useState } from "react";
import type { Performance, Project, Take } from "@siir/contracts";
import { volumeFor } from "../audio/preview";
import { fmt } from "../shared/util";
import type { Actions } from "../shell/types";
import type { LocalData } from "../shared/useLocalData";
import { getLocalTrackBlob } from "../storage/music";
import { deletePerformance, getProcessedVoice, listPerformances, savePerformance, takeExists } from "../storage/performances";
import { EmptyState, PageHeader } from "./parts";
import { useLocalTracks } from "./LocalMusic";

/** Kayıtlı Şiirlerim önizleme: işlenmiş ses + fon AYRI kaynaklardan eş zamanlı çalınır; birleşik dosya üretilmez. */
function usePreview() {
  const voice = useRef<HTMLAudioElement | null>(null), bg = useRef<HTMLAudioElement | null>(null), urls = useRef<string[]>([]);
  const [playing, setPlaying] = useState<string | null>(null);
  const stop = useCallback(() => {
    for (const a of [voice.current, bg.current]) { a?.pause(); }
    voice.current = bg.current = null; urls.current.forEach(URL.revokeObjectURL); urls.current = []; setPlaying(null);
  }, []);
  useEffect(() => stop, [stop]);
  const play = useCallback(async (p: Performance, withBg: boolean) => {
    stop();
    const vurl = URL.createObjectURL(await getProcessedVoice(p)); urls.current.push(vurl);
    const v = new Audio(vurl); voice.current = v; v.onended = () => { bg.current?.pause(); setPlaying(null); };
    if (withBg && p.backgroundTrackId?.startsWith("loc_")) {
      const burl = URL.createObjectURL(await getLocalTrackBlob(p.backgroundTrackId)); urls.current.push(burl);
      const b = new Audio(burl); b.loop = true; b.volume = volumeFor(p.mixSettings.music.gainDb);
      await new Promise<void>((r) => { if (b.readyState >= 1) r(); else b.addEventListener("loadedmetadata", () => r(), { once: true }); });
      if (Number.isFinite(b.duration) && b.duration > 0) b.currentTime = p.mixSettings.music.startOffsetSec % b.duration;
      bg.current = b; void b.play();
    }
    setPlaying(p.id); await v.play();
  }, [stop]);
  return { playing, play, stop };
}

function Row({ perf, poem, take, trackName, tracks, actions, onChanged }: {
  perf: Performance; poem?: Project; take?: Take; trackName: string; tracks: { id: string; title: string }[]; actions: Actions; onChanged: () => void;
}) {
  const pv = usePreview();
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [alive, setAlive] = useState(true);
  useEffect(() => { void takeExists(perf).then(setAlive); }, [perf]);
  const m = perf.mixSettings.music;
  const setMix = (p: Partial<typeof m>) => void savePerformance({ ...perf, mixSettings: { ...perf.mixSettings, music: { ...m, ...p } } }).then(onChanged);
  const run = async (fn: () => Promise<void>) => { setBusy(true); setErr(""); try { await fn(); } catch (e) { setErr(e instanceof Error ? e.message : "İşlem başarısız."); } finally { setBusy(false); } };
  return (
    <li className="pcard perf">
      <h2>{perf.title || "Adsız şiir"}</h2>
      <p className="muted small">{[perf.poet, `Deneme: ${take ? fmt(take.durationMs) : "—"}`, perf.backgroundTrackId ? `Fon: ${trackName}` : "Fonsuz", `Atmosfer: ${perf.fx.preset}`].filter(Boolean).join(" · ")}</p>
      <div className="chips"><span className="chip">{new Date(perf.createdAt).toLocaleDateString("tr-TR")}</span>{perf.videoProjectId && <span className="chip">Video projesi bağlı</span>}{!alive && <span className="chip" style={{ color: "var(--danger)" }}>ses denemesi silinmiş</span>}</div>
      {err && <div className="alert" role="alert">{err}</div>}
      <div className="row pcard-act">
        {pv.playing === perf.id
          ? <button className="btn" onClick={pv.stop}>■ Durdur</button>
          : <button className="btn" disabled={busy || !alive} onClick={() => void run(() => pv.play(perf, true))}>{busy ? "Hazırlanıyor…" : "▶ Fonla dinle"}</button>}
        {perf.backgroundTrackId && <button className="btn ghost" disabled={busy || !alive} onClick={() => void run(() => pv.play(perf, false))}>Fonsuz dinle</button>}
        <button className="btn primary" disabled={!alive || !poem || !take} onClick={() => poem && take && actions.sendToVideo(poem, take, perf)}>Video Stüdyosu’na gönder</button>
        <button className="btn" disabled={!alive} onClick={() => actions.playInLive(perf)}>Yayında çal</button>
        <button className="btn ghost" aria-label={`${perf.title || "Adsız şiir"} kaydını sil`} onClick={async () => { if (!confirm(`“${perf.title || "Adsız şiir"}” kayıtlı şiirlerinden silinsin mi? Şiir ve ses denemeleri silinmez.`)) return; await deletePerformance(perf.id); onChanged(); }}>Sil</button>
      </div>
      <details>
        <summary>Ses ve fon dengesi</summary>
        <div className="sliders" style={{ marginTop: 8 }}>
          <div>
            <label htmlFor={"pf-bg-" + perf.id}>Fon müziği</label>
            <select id={"pf-bg-" + perf.id} value={perf.backgroundTrackId ?? ""} onChange={(e) => void savePerformance({ ...perf, backgroundTrackId: e.target.value || null }).then(onChanged)}>
              <option value="">Fonsuz</option>{tracks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>
          <div><label htmlFor={"pf-g-" + perf.id}>Fon seviyesi: <b>{m.gainDb} dB</b></label><input id={"pf-g-" + perf.id} type="range" min={-40} max={0} value={m.gainDb} onChange={(e) => setMix({ gainDb: +e.target.value })} /></div>
          <div><label htmlFor={"pf-s-" + perf.id}>Fon başlangıcı: <b>{m.startOffsetSec} sn</b></label><input id={"pf-s-" + perf.id} type="range" min={0} max={120} value={m.startOffsetSec} onChange={(e) => setMix({ startOffsetSec: +e.target.value })} /></div>
          <div><label htmlFor={"pf-fi-" + perf.id}>Giriş yumuşatma: <b>{m.fadeInSec} sn</b></label><input id={"pf-fi-" + perf.id} type="range" min={0} max={8} step={0.5} value={m.fadeInSec} onChange={(e) => setMix({ fadeInSec: +e.target.value })} /></div>
          <div><label htmlFor={"pf-fo-" + perf.id}>Çıkış yumuşatma: <b>{m.fadeOutSec} sn</b></label><input id={"pf-fo-" + perf.id} type="range" min={0} max={8} step={0.5} value={m.fadeOutSec} onChange={(e) => setMix({ fadeOutSec: +e.target.value })} /></div>
        </div>
      </details>
    </li>
  );
}

/** Kayıtlı Şiirlerim: tamamlanıp saklanan şiir performanslarının arşivi (ham kayıt listesi değildir). */
export function Performances({ data, actions }: { data: LocalData; actions: Actions }) {
  const [list, setList] = useState<Performance[] | null>(null);
  const [takes, setTakes] = useState<Record<string, Take[]>>({});
  const mine = useLocalTracks();
  const reload = useCallback(async () => { setList(await listPerformances()); }, []);
  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => { setTakes(data.takes); }, [data.takes]);
  const tracks = (mine.tracks ?? []).map((t) => ({ id: t.id, title: t.title }));
  return (
    <>
      <PageHeader title="Kayıtlı Şiirlerim" sub="Ses Stüdyosu · tamamladığın ve sakladığın şiir performansları" />
      <div className="note" role="note">Kayıtlı bir şiir; şiiri, seçtiğin ses denemesini ve fon müziğini <b>birbirine bağlar</b>. Ses ve fon ayrı tutulur, hiçbiri kopyalanmaz.</div>
      {list === null ? <p className="muted">Yükleniyor…</p> : list.length === 0 ? (
        <EmptyState icon="star" title="Henüz kayıtlı şiirin yok" action={<button className="btn primary" onClick={() => actions.newRecording()}>Yeni Kayıt</button>}>
          Bir şiiri kaydedip “Kayıtlı Şiirlerime kaydet” dediğinde burada görünür.
        </EmptyState>
      ) : (
        <ul className="plist perf-list">
          {list.map((p) => {
            const poem = data.projects?.find((x) => x.id === p.poemId);
            const take = (takes[p.poemId] ?? []).find((t) => t.id === p.selectedTakeId);
            return <Row key={p.id} perf={p} poem={poem} take={take} trackName={tracks.find((t) => t.id === p.backgroundTrackId)?.title ?? (p.backgroundTrackId ? "katalog fonu" : "")} tracks={tracks} actions={actions} onChanged={() => void reload()} />;
          })}
        </ul>
      )}
    </>
  );
}
