import { useState } from "react";
import { Icon, type IconName } from "../shell/icons";
import type { Actions } from "../shell/types";
import type { LocalData } from "../shared/useLocalData";
import { EmptyState, PageHeader, ProjectCard, RecoveryBanner } from "./parts";
import { supported } from "../audio/recorder";
import { tr } from "../shared/tr";

function HubCard({ icon, title, text, onClick, tone }: { icon: IconName; title: string; text: string; onClick: () => void; tone: "a" | "b" }) {
  return (
    <button className={"hub hub-" + tone} onClick={onClick}>
      <span className="hub-i"><Icon name={icon} size={30} /></span>
      <span className="hub-t"><b>{title}</b><span>{text}</span></span>
    </button>
  );
}

/** Ana Panel: iki ana araç, hızlı işlemler, son çalışmalar ve proje durumları. */
export function Dashboard({ data, actions }: { data: LocalData; actions: Actions }) {
  const [msg, setMsg] = useState("");
  const ok = supported();
  const ps = data.projects ?? [];
  const recent = ps.slice(0, 3);
  const takeTotal = Object.values(data.takes).reduce((a, t) => a + t.length, 0);
  return (
    <>
      <PageHeader title="Şiir Stüdyosu" sub="Yaratıcı çalışma alanı" />
      {!ok && <div className="alert" role="alert">{tr.errors.unsupported}</div>}
      {data.error && <div className="alert" role="alert">{data.error}</div>}
      {msg && <div className="note" role="status">{msg}</div>}
      <RecoveryBanner orphans={data.orphans} reload={data.reload} onMsg={setMsg} />

      <div className="hub-grid">
        <HubCard tone="a" icon="mic" title="Ses Stüdyosu" text="Şiir oku ve kaydet" onClick={() => actions.go("studio")} />
        <HubCard tone="b" icon="film" title="Video Editörü" text="Video oluştur ve düzenle" onClick={() => actions.go("video")} />
      </div>

      <section aria-labelledby="qa-h" className="sec">
        <h2 id="qa-h">Hızlı işlemler</h2>
        <div className="row">
          <button className="btn primary" disabled={!ok} onClick={() => actions.create({ video: true })}><Icon name="plus" size={18} /> Yeni video</button>
          <button className="btn" disabled={!ok} onClick={() => actions.create()}><Icon name="book" size={18} /> Şiir ekle</button>
          <button className="btn" onClick={() => actions.go("music")}><Icon name="music" size={18} /> Fon müziği seç</button>
        </div>
        <p className="small muted">“Yeni video” bir şiirle başlar; okuyup kaydettikten sonra dışa aktarırken videoyu da hazırlarsın.</p>
      </section>

      <section aria-labelledby="rc-h" className="sec">
        <div className="row between"><h2 id="rc-h">Son çalışmalar</h2>{ps.length > 3 && <button className="btn ghost" onClick={() => actions.go("poems")}>Tümünü gör</button>}</div>
        {data.projects === null ? <p className="muted">Yükleniyor…</p> : recent.length === 0 ? (
          <EmptyState icon="book" title="Henüz çalışma yok" action={<button className="btn primary" disabled={!ok} onClick={() => actions.create()}>İlk şiirini ekle</button>}>
            Bir şiir yaz veya yapıştır, fon müziği seç ve mikrofona oku.
          </EmptyState>
        ) : (
          <div className="pgrid">
            {recent.map((p) => {
              const t = data.takes[p.id] ?? [];
              return (
                <ProjectCard key={p.id} p={p} takes={t} actions={<>
                  <button className="btn primary" onClick={() => actions.open(p, t.length ? "review" : "poem")}>Aç</button>
                  {t.length > 0 && <button className="btn" onClick={() => actions.open(p, "review", { video: true })}>Video</button>}
                </>} />
              );
            })}
          </div>
        )}
      </section>

      <section aria-labelledby="st-h" className="sec">
        <h2 id="st-h">Çalışma alanın</h2>
        <div className="stat-grid">
          <button className="stat" onClick={() => actions.go("poems")}><Icon name="book" /><b>{ps.length}</b><span>Şiir Kütüphanem<small>Şiir taslakların</small></span></button>
          <button className="stat" onClick={() => actions.go("recordings")}><Icon name="wave" /><b>{takeTotal}</b><span>Ses kayıtlarım<small>Kaydedilen okumalar</small></span></button>
          <button className="stat" onClick={() => actions.go("archive")}><Icon name="archive" /><b>—</b><span>Video arşivim<small>Kalıcı arşiv planlanıyor</small></span></button>
        </div>
      </section>
    </>
  );
}
