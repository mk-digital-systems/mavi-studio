import type { Draft } from "../App";
import { parsePoem } from "../shared/util";

type P = { draft: Draft; patch: (p: Partial<Draft>) => void; next: () => void };

export function Editor({ draft, patch, next }: P) {
  const poem = parsePoem(draft.text);
  const lines = poem.stanzas.reduce((a, s) => a + s.lines.length, 0);
  return (
    <>
      <section className="card">
        <h1 className="h2">Şiirin</h1>
        <div style={{ marginBottom: 16 }}>
          <label htmlFor="title">Başlık</label>
          <input id="title" type="text" value={draft.title} maxLength={120} onChange={(e) => patch({ title: e.target.value })} placeholder="Örn. Sessiz Gece" />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label htmlFor="poet">Şair (isteğe bağlı)</label>
          <input id="poet" type="text" value={draft.mix.poet} maxLength={80} onChange={(e) => patch({ mix: { ...draft.mix, poet: e.target.value } })} placeholder="Örn. Cahit Sıtkı Tarancı" />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label htmlFor="cat">Kategori (isteğe bağlı)</label>
          <input id="cat" type="text" value={draft.category ?? ""} maxLength={40} onChange={(e) => patch({ category: e.target.value })} placeholder="Örn. aşk, doğa, hasret" />
        </div>
        <label htmlFor="text">Şiir metni</label>
        <textarea id="text" value={draft.text} onChange={(e) => patch({ text: e.target.value })}
          placeholder={"Dizeleri yaz veya yapıştır.\n\nBoş satır yeni bir kıta başlatır."} aria-describedby="count" />
        <div style={{ margin: "12px 0" }}>
          <label htmlFor="rn">Okuma notları (isteğe bağlı)</label>
          <input id="rn" type="text" value={draft.readingNotes ?? ""} maxLength={2000} onChange={(e) => patch({ readingNotes: e.target.value })} placeholder="Örn. ikinci kıtada yavaşla" />
        </div>
        <p id="count" className="muted small" aria-live="polite">{poem.stanzas.length} kıta · {lines} dize · Şiir yazdıkça Şiir Kütüphanem’e otomatik kaydedilir.</p>
      </section>
      <div className="bar"><div className="inner">
        <span />
        <button className="btn primary" disabled={!draft.title.trim() || lines === 0} onClick={next}>Fon seç →</button>
      </div></div>
    </>
  );
}
