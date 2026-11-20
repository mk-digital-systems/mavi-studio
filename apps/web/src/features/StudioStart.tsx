import { Icon } from "../shell/icons";
import type { Actions } from "../shell/types";
import type { LocalData } from "../shared/useLocalData";
import { supported } from "../audio/recorder";
import { PageHeader, ProjectCard } from "./parts";

/** Ses Stüdyosu'na açık bir çalışma olmadan girildiğinde: yeni şiir ya da mevcut çalışmaya devam. */
export function StudioStart({ data, actions }: { data: LocalData; actions: Actions }) {
  const ok = supported();
  const ps = (data.projects ?? []).slice(0, 6);
  return (
    <>
      <PageHeader title="Ses Stüdyosu" sub="Şiir oku ve kaydet" actions={<button className="btn primary" disabled={!ok} onClick={() => actions.create()}><Icon name="plus" size={18} /> Yeni şiir</button>} />
      <p className="muted">Şiir metnini yaz, bir fon müziği seç, kulaklığınla mikrofona oku; denemelerini dinle, efektleri ayarla ve dışa aktar.</p>
      <section className="sec" aria-labelledby="ss-h">
        <h2 id="ss-h">Çalışmaya devam et</h2>
        {data.projects === null ? <p className="muted">Yükleniyor…</p> : ps.length === 0 ? <p className="muted">Henüz çalışma yok. “Yeni şiir” ile başla.</p> : (
          <div className="pgrid">
            {ps.map((p) => {
              const t = data.takes[p.id] ?? [];
              return <ProjectCard key={p.id} p={p} takes={t} actions={<>
                <button className="btn primary" onClick={() => actions.open(p, "poem")}>Aç</button>
                {t.length > 0 && <button className="btn" onClick={() => actions.open(p, "review")}>Denemeler</button>}
              </>} />;
            })}
          </div>
        )}
      </section>
    </>
  );
}
