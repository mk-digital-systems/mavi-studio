import { useEffect, useState } from "react";
import { Icon, type IconName } from "../shell/icons";
import type { Actions } from "../shell/types";
import type { LocalData } from "../shared/useLocalData";
import { PageHeader, ProjectCard, RecoveryBanner } from "./parts";
import { supported } from "../audio/recorder";
import { tr } from "../shared/tr";
import { recentMusic } from "../shared/recent";
import { countEditorVideos } from "../storage/video";
import { useLocalTracks } from "./LocalMusic";

function Stat({ icon, n, label, sub, onClick }: { icon: IconName; n: number | string; label: string; sub: string; onClick: () => void }) {
  return <button className="stat" onClick={onClick}><Icon name={icon} /><b>{n}</b><span>{label}<small>{sub}</small></span></button>;
}

/** Ana Panel: tek büyük işlem (Yeni Kayıt), devam eden iş, son çalışmalar ve sayılar. */
export function Dashboard({ data, actions }: { data: LocalData; actions: Actions }) {
  const [msg, setMsg] = useState("");
  const [videos, setVideos] = useState<number | null>(null);
  const mine = useLocalTracks();
  useEffect(() => { void countEditorVideos().then(setVideos); }, []);
  const ok = supported();
  const ps = data.projects ?? [];
  const withTakes = ps.filter((p) => (data.takes[p.id] ?? []).length > 0);
  const takeTotal = Object.values(data.takes).reduce((a, t) => a + t.length, 0);
  const unfinished = ps.find((p) => p.text.trim() && (data.takes[p.id] ?? []).length === 0);
  const recentPoems = ps.slice(0, 5);
  const musicById = new Map((mine.tracks ?? []).map((t) => [t.id, t]));
  const recentTracks = recentMusic().map((id) => musicById.get(id)).filter((t): t is NonNullable<typeof t> => !!t).slice(0, 4);
  return (
    <>
      <PageHeader title="Şiir Stüdyosu" sub="Şiirini seç, oku, kaydet" />
      {!ok && <div className="alert" role="alert">{tr.errors.unsupported}</div>}
      {data.error && <div className="alert" role="alert">{data.error}</div>}
      {msg && <div className="note" role="status">{msg}</div>}
      <RecoveryBanner orphans={data.orphans} reload={data.reload} onMsg={setMsg} />

      <button className="hero-new" disabled={!ok} onClick={() => actions.newRecording()}>
        <span className="hub-i"><Icon name="mic" size={32} /></span>
        <span className="hub-t"><b>Yeni Kayıt</b><span>Şiir seç, fon seç, kaydı başlat</span></span>
      </button>

      {unfinished && (
        <section className="card sec" aria-labelledby="rs-h">
          <h2 id="rs-h" className="h3">Yarım kalan çalışma</h2>
          <p className="muted">“{unfinished.title || "Adsız şiir"}” henüz okunmadı.</p>
          <button className="btn primary" disabled={!ok} onClick={() => actions.open(unfinished, "music")}>Devam et</button>
        </section>
      )}

      <section aria-labelledby="st-h" className="sec">
        <h2 id="st-h">Çalışma alanın</h2>
        <div className="stat-grid">
          <Stat icon="book" n={ps.length} label="Şiir" sub="Şiir Kütüphanem" onClick={() => actions.go("poems")} />
          <Stat icon="music" n={mine.tracks?.length ?? "…"} label="Fon" sub="Fon Müziklerim" onClick={() => actions.go("music")} />
          <Stat icon="wave" n={takeTotal} label="Ses kaydı" sub="Ses Kayıtlarım" onClick={() => actions.go("recordings")} />
          <Stat icon="film" n={videos ?? "—"} label="Video" sub="Video Stüdyosu projeleri" onClick={() => actions.go("video")} />
        </div>
      </section>

      <section aria-labelledby="rc-h" className="sec">
        <div className="row between"><h2 id="rc-h">Son çalışmalar</h2>{withTakes.length > 3 && <button className="btn ghost" onClick={() => actions.go("recordings")}>Tümünü gör</button>}</div>
        {data.projects === null ? <p className="muted">Yükleniyor…</p> : withTakes.length === 0 ? <p className="muted">Henüz kayıtlı çalışma yok. “Yeni Kayıt” ile başla.</p> : (
          <div className="pgrid">
            {withTakes.slice(0, 3).map((p) => {
              const t = data.takes[p.id] ?? [];
              return (
                <ProjectCard key={p.id} p={p} takes={t} actions={<>
                  <button className="btn primary" onClick={() => actions.open(p, "review")}>Aç</button>
                  <button className="btn" onClick={() => actions.sendToVideo(p, t[t.length - 1])}>Video Stüdyosu’na gönder</button>
                </>} />
              );
            })}
          </div>
        )}
      </section>

      <div className="two">
        <section aria-labelledby="rp-h" className="sec">
          <h2 id="rp-h" className="h3">Son kullanılan şiirler</h2>
          {recentPoems.length === 0 ? <p className="muted small">Henüz şiir yok.</p> : (
            <ul className="mini-list">{recentPoems.map((p) => <li key={p.id}><button className="linkish" onClick={() => actions.open(p, p.text.trim() ? "music" : "poem")}>{p.title || "Adsız şiir"}</button></li>)}</ul>
          )}
        </section>
        <section aria-labelledby="rm-h" className="sec">
          <h2 id="rm-h" className="h3">Son kullanılan fonlar</h2>
          {recentTracks.length === 0 ? <p className="muted small">Henüz fon kullanılmadı.</p> : (
            <ul className="mini-list">{recentTracks.map((t) => <li key={t.id}><button className="linkish" onClick={() => actions.create({ trackId: t.id })}>{t.title}</button></li>)}</ul>
          )}
        </section>
      </div>

      <section aria-label="Video Stüdyosu" className="sec">
        <button className="hub hub-b" onClick={() => actions.go("video")}>
          <span className="hub-i"><Icon name="film" size={30} /></span>
          <span className="hub-t"><b>Video Stüdyosu</b><span>Video oluştur ve düzenle; şiir sesini ekle</span></span>
        </button>
      </section>
    </>
  );
}
