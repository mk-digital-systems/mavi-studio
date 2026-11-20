import { useState } from "react";
import type { Performance, Project } from "@siir/contracts";
import type { LocalTrack } from "../../storage/music";

type P = {
  poems: Project[]; performances: Performance[]; tracks: LocalTrack[];
  poemId: string | null; perfId: string | null; trackId: string | null; musicPlayingId: string | null;
  onPoem: (p: Project) => void; onPerf: (p: Performance) => void; onMusic: (t: LocalTrack) => void;
};

/**
 * Kütüphane: Şiirlerim, Kayıtlı Şiirlerim ve Fon Müziklerim AYNI yerde, üç bölüm halinde görünür. Tek arama kutusu üçünü de süzer.
 * Ortak veri kaynaklarını gösterir; hiçbir içerik kopyalanmaz.
 */
export function LibraryPanel({ poems, performances, tracks, poemId, perfId, trackId, musicPlayingId, onPoem, onPerf, onMusic }: P) {
  const [q, setQ] = useState("");
  const k = q.trim().toLocaleLowerCase("tr"), has = (s: string) => !k || s.toLocaleLowerCase("tr").includes(k);
  const Row = ({ active, title, sub, label, fn }: { active: boolean; title: string; sub?: string; label: string; fn: () => void }) => (
    <li className={"lib-row" + (active ? " active" : "")} aria-current={active ? "true" : undefined}>
      <div className="pick-t"><b>{title}</b>{sub && <span className="muted small">{sub}</span>}</div>
      <button className={"btn" + (active ? " on" : "")} onClick={fn}>{label}</button>
    </li>
  );
  const ps = poems.filter((p) => has(p.title + " " + p.text + " " + p.mix.poet));
  const pf = performances.filter((p) => has(p.title + " " + p.poet));
  const ts = tracks.filter((t) => has(t.title + " " + (t.artist ?? "")));
  return (
    <div className="lib" aria-label="Kütüphane">
      <input type="search" className="lib-q" placeholder="Şiir, kayıt veya fon ara…" aria-label="Kütüphanede ara" value={q} onChange={(e) => setQ(e.target.value)} />
      <section aria-labelledby="lb-p"><h3 id="lb-p" className="lib-h">Şiirlerim <small>({ps.length})</small></h3>
        <ul className="lib-list">
          {ps.map((p) => <Row key={p.id} active={poemId === p.id} title={p.title || "Adsız şiir"} sub={p.mix.poet} label="Canlı oku" fn={() => onPoem(p)} />)}
          {ps.length === 0 && <li className="muted small">Şiir yok.</li>}
        </ul>
      </section>
      <section aria-labelledby="lb-r"><h3 id="lb-r" className="lib-h">Kayıtlı Şiirlerim <small>({pf.length})</small></h3>
        <ul className="lib-list">
          {pf.map((p) => <Row key={p.id} active={perfId === p.id} title={p.title || "Adsız şiir"} sub={[p.poet, p.backgroundTrackId ? "fonlu" : "fonsuz"].filter(Boolean).join(" · ")} label="Çal" fn={() => onPerf(p)} />)}
          {pf.length === 0 && <li className="muted small">Kayıtlı şiir yok.</li>}
        </ul>
      </section>
      <section aria-labelledby="lb-m"><h3 id="lb-m" className="lib-h">Fon Müziklerim <small>({ts.length})</small></h3>
        <ul className="lib-list">
          {ts.map((t) => <Row key={t.id} active={trackId === t.id || musicPlayingId === t.id} title={t.title} sub={t.artist} label={musicPlayingId === t.id ? "■ Durdur" : "▶ Fonu çal"} fn={() => onMusic(t)} />)}
          {ts.length === 0 && <li className="muted small">Fon yok.</li>}
        </ul>
      </section>
    </div>
  );
}
