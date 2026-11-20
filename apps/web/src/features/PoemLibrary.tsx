import { useMemo, useState } from "react";
import { Icon } from "../shell/icons";
import type { Actions } from "../shell/types";
import type { LocalData } from "../shared/useLocalData";
import { supported } from "../audio/recorder";
import { downloadBackup } from "../storage/backup";
import { deleteProject } from "../storage/repo";
import { BackupTools, EmptyState, PageHeader, RecoveryBanner } from "./parts";

const norm = (s: string) => s.toLocaleLowerCase("tr");

/** Şiir Kütüphanem: her şiir bir projedir (metin + ses denemeleri + fon seçimi tek yerde). Arama, açma, yedekleme, silme. */
export function PoemLibrary({ data, actions }: { data: LocalData; actions: Actions }) {
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const ok = supported();
  const list = useMemo(() => {
    const k = norm(q.trim());
    return (data.projects ?? []).filter((p) => !k || norm(p.title).includes(k) || norm(p.text).includes(k));
  }, [data.projects, q]);

  return (
    <>
      <PageHeader title="Şiirlerim" sub="Ses Stüdyosu · yalnızca şiirlerin yazılı içeriği" actions={<button className="btn primary" disabled={!ok} onClick={() => actions.create()}><Icon name="plus" size={18} /> Yeni şiir</button>} />
      {(err || data.error) && <div className="alert" role="alert">{err || data.error}</div>}
      {msg && <div className="note" role="status">{msg}</div>}
      <RecoveryBanner orphans={data.orphans} reload={data.reload} onMsg={setMsg} />

      <div className="search">
        <label htmlFor="poem-q" className="sr">Şiirlerde ara</label>
        <Icon name="search" size={18} />
        <input id="poem-q" type="search" placeholder="Başlık veya dize ara…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <p className="small muted" aria-live="polite">{data.projects === null ? "Yükleniyor…" : `${list.length} şiir${q ? " bulundu" : ""}`}</p>

      {data.projects !== null && list.length === 0 ? (
        <EmptyState icon="book" title={q ? "Eşleşen şiir yok" : "Henüz şiir yok"} action={!q && <button className="btn primary" disabled={!ok} onClick={() => actions.create()}>İlk şiirini ekle</button>}>
          {q ? "Başka bir sözcük dene." : "Yazdığın veya yapıştırdığın şiirler burada listelenir."}
        </EmptyState>
      ) : (
        <ul className="plist">
          {list.map((p) => {
            const t = data.takes[p.id] ?? [];
            const name = p.title || "Adsız şiir";
            return (
              <li key={p.id}>
                <details className="pitem">
                  <summary>{name}{p.mix.poet ? ` — ${p.mix.poet}` : ""}</summary>
                  <div className="pitem-b">
                    <p className="pitem-text">{p.text.trim() || "Henüz metin yok"}</p>
                    {p.readingNotes && <p className="small muted"><b>Okuma notu:</b> {p.readingNotes}</p>}
                    <div className="chips">
                      {p.mix.poet && <span className="chip">{p.mix.poet}</span>}
                      {p.category && <span className="chip">{p.category}</span>}
                      <span className="chip">{new Date(p.updatedAt).toLocaleDateString("tr-TR")}</span>
                    </div>
                    <div className="row pcard-act">
                      <button className="btn primary" onClick={() => actions.open(p, "poem")}>Aç</button>
                      <button className="btn ghost" onClick={() => downloadBackup(p)}>Yedek</button>
                      <button className="btn ghost" aria-label={`${name} sil`} onClick={async () => {
                        if (!confirm(`“${name}” şiiri, ses denemeleri (${t.length}) ve kayıtlı şiirleri bu cihazdan silinsin mi? Bu işlem geri alınamaz.`)) return;
                        await deleteProject(p.id); await data.reload();
                      }}><Icon name="trash" size={18} /></button>
                    </div>
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      )}

      <section className="card sec" aria-labelledby="pb-h">
        <h2 id="pb-h">Yedekle ve geri yükle</h2>
        <p className="small muted">Yedek yalnızca şiir metinlerini ve ayarlarını içerir; ses kayıtları ve fon müziği içermez. Kategori ve etiketler henüz yok.</p>
        <BackupTools projects={data.projects ?? []} reload={data.reload} onMsg={setMsg} onErr={setErr} />
      </section>
    </>
  );
}
