import type { Draft } from "../App";
import { noteMusicUsed } from "../shared/recent";
import { MusicBrowser } from "./MusicBrowser";

type P = { draft: Draft; patch: (p: Partial<Draft>) => void; back: () => void; next: () => void };

/** Yeni Kayıt · 2. adım: fon seç (müziksiz de olabilir), dinleyerek ön izle, gerekirse yeni fon yükle. */
export function MusicPicker({ draft, patch, back, next }: P) {
  return (
    <>
      <section className="card">
        <h1 className="h2">Fon müziği</h1>
        <p className="muted">Fon kullanmadan devam edebilir ya da kütüphanenden bir fon seçebilirsin. Seçtiğin fonu dinleyerek dene; kayıt sırasında kulaklıkta çalar, kayda karışmaz.</p>
        <MusicBrowser mode="picker" selectedId={draft.trackId} onChoose={(id) => { patch({ trackId: id }); noteMusicUsed(id); }} />
      </section>
      <div className="bar"><div className="inner">
        <button className="btn" onClick={back}>← Şiir</button>
        <button className="btn primary" onClick={next}>Kayıt hazırlığı →</button>
      </div></div>
    </>
  );
}
