import { useState } from "react";
import type { Performance, Project } from "@siir/contracts";
import { flowKindLabel, moveItem, type Flow, type FlowItem, type FlowKind } from "../../storage/flows";
import type { LocalTrack } from "../../storage/music";
import type { SfxItem } from "../../storage/sfx";

const ICON: Record<FlowKind, string> = { opening: "🎬", "live-poem": "🎤", recorded: "▶", music: "🎵", sfx: "✨", note: "📝", break: "⏸", closing: "🏁" };

type RailP = {
  flow: Flow | null; idx: number; flows: Flow[];
  onPick: (id: string) => void; onNew: () => void; onItems: (items: FlowItem[]) => void;
  onNext: () => void; onPrev: () => void; onJump: (i: number) => void;
};

/** Sol taraf: yayın akışı. Sıralama sürükleyerek ya da ↑↓ ile; şu anki ve sıradaki öğe açıkça görünür. */
export function FlowRail({ flow, idx, flows, onPick, onNew, onItems, onNext, onPrev, onJump }: RailP) {
  const [drag, setDrag] = useState<number | null>(null);
  const items = flow?.items ?? [];
  const cur = items[idx], nxt = items[idx + 1];
  return (
    <div className="rail" aria-label="Yayın akışı">
      <div className="row between">
        <select aria-label="Akış seç" value={flow?.id ?? ""} onChange={(e) => onPick(e.target.value)} style={{ flex: 1, minHeight: 44 }}>
          <option value="">Akış seç…</option>
          {flows.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <button className="btn" onClick={onNew}>+ Yeni</button>
      </div>
      {flow && (
        <>
          <div className="rail-now" aria-live="polite">
            <div><span className="small muted">Şimdi</span><b>{cur ? `${ICON[cur.kind]} ${cur.label || flowKindLabel(cur.kind)}` : "Henüz başlamadı"}</b></div>
            <div><span className="small muted">Sıradaki</span><b>{nxt ? `${ICON[nxt.kind]} ${nxt.label || flowKindLabel(nxt.kind)}` : "—"}</b></div>
          </div>
          <div className="row">
            <button className="btn" disabled={idx <= 0} onClick={onPrev}>← Önceki</button>
            <button className="btn primary rail-next" disabled={items.length === 0 || idx >= items.length - 1} onClick={onNext}>Sıradaki →</button>
          </div>
          <ol className="rail-list">
            {items.map((it, i) => (
              <li key={it.id} className={(i === idx ? "now " : i === idx + 1 ? "next " : i < idx ? "done " : "") + (drag === i ? "drag" : "")} draggable
                onDragStart={() => setDrag(i)} onDragOver={(e) => e.preventDefault()}
                onDrop={() => { if (drag !== null) onItems(moveItem(items, drag, i)); setDrag(null); }} onDragEnd={() => setDrag(null)}>
                <button className="rail-it" onClick={() => onJump(i)} aria-current={i === idx ? "step" : undefined}>
                  <span aria-hidden>{ICON[it.kind]}</span> <span><b>{it.label || flowKindLabel(it.kind)}</b><small>{flowKindLabel(it.kind)}</small></span>
                </button>
                <span className="rail-mv">
                  <button className="btn ghost" aria-label="Yukarı taşı" disabled={i === 0} onClick={() => onItems(moveItem(items, i, i - 1))}>↑</button>
                  <button className="btn ghost" aria-label="Aşağı taşı" disabled={i === items.length - 1} onClick={() => onItems(moveItem(items, i, i + 1))}>↓</button>
                  <button className="btn ghost" aria-label={`${it.label || flowKindLabel(it.kind)} öğesini akıştan çıkar`} onClick={() => { if (confirm("Bu öğe akıştan çıkarılsın mı?")) onItems(items.filter((x) => x.id !== it.id)); }}>✕</button>
                </span>
              </li>
            ))}
          </ol>
          {items.length === 0 && <p className="small muted">Akış boş. Aşağıdaki kütüphaneden “Akışa ekle” ile öğe ekle.</p>}
        </>
      )}
      {!flow && <p className="small muted">Hazır bir akış seç ya da yeni bir akış başlat. Akış olmadan da canlı okuyabilir veya kayıtlı şiir çalabilirsin.</p>}
    </div>
  );
}

type Tab = "poems" | "performances" | "music" | "sfx" | "flows";
type LibP = {
  poems: Project[]; performances: Performance[]; tracks: LocalTrack[]; sfx: SfxItem[]; flows: Flow[];
  onPoem: (p: Project) => void; onPerf: (p: Performance) => void; onMusic: (t: LocalTrack) => void; onFlow: (f: Flow) => void;
  addToFlow: (item: Omit<FlowItem, "id">) => void; canAdd: boolean;
};

/** Kütüphane paneli: ortak veri kaynaklarını (Şiirlerim, Kayıtlı Şiirlerim, Fon Müziklerim, Ses Efektleri, Yayın Akışlarım) gösterir. Veri kopyalanmaz. */
export function Library({ poems, performances, tracks, sfx, flows, onPoem, onPerf, onMusic, onFlow, addToFlow, canAdd }: LibP) {
  const [tab, setTab] = useState<Tab>("poems");
  const [q, setQ] = useState("");
  const k = q.trim().toLocaleLowerCase("tr"), has = (s: string) => !k || s.toLocaleLowerCase("tr").includes(k);
  const tabs: [Tab, string, number][] = [["poems", "Şiirlerim", poems.length], ["performances", "Kayıtlı Şiirlerim", performances.length], ["music", "Fon Müziklerim", tracks.length], ["sfx", "Ses Efektleri", sfx.length], ["flows", "Yayın Akışlarım", flows.length]];
  const Row = ({ title, sub, main, add }: { title: string; sub?: string; main?: [string, () => void]; add?: Omit<FlowItem, "id"> }) => (
    <li className="lib-row">
      <div className="pick-t"><b>{title}</b>{sub && <span className="muted small">{sub}</span>}</div>
      <span className="row">
        {main && <button className="btn" onClick={main[1]}>{main[0]}</button>}
        {add && <button className="btn ghost" disabled={!canAdd} title={canAdd ? "" : "Önce bir akış seç"} onClick={() => addToFlow(add)}>+ Akışa ekle</button>}
      </span>
    </li>
  );
  return (
    <div className="lib" aria-label="Kütüphane">
      <div className="lib-tabs" role="tablist" aria-label="Kütüphane">
        {tabs.map(([id, label, n]) => <button key={id} role="tab" aria-selected={tab === id} className="btn" onClick={() => setTab(id)}>{label} <small>({n})</small></button>)}
      </div>
      <input type="search" className="lib-q" placeholder="Ara…" aria-label="Kütüphanede ara" value={q} onChange={(e) => setQ(e.target.value)} />
      <ul className="lib-list">
        {tab === "poems" && poems.filter((p) => has(p.title + " " + p.text)).map((p) => <Row key={p.id} title={p.title || "Adsız şiir"} sub={p.mix.poet} main={["Canlı oku", () => onPoem(p)]} add={{ kind: "live-poem", refId: p.id, label: p.title || "Adsız şiir", text: "" }} />)}
        {tab === "performances" && performances.filter((p) => has(p.title + " " + p.poet)).map((p) => <Row key={p.id} title={p.title || "Adsız şiir"} sub={[p.poet, p.backgroundTrackId ? "fonlu" : "fonsuz"].filter(Boolean).join(" · ")} main={["Çal", () => onPerf(p)]} add={{ kind: "recorded", refId: p.id, label: p.title || "Adsız şiir", text: "" }} />)}
        {tab === "music" && tracks.filter((t) => has(t.title + " " + (t.artist ?? ""))).map((t) => <Row key={t.id} title={t.title} sub={t.artist} main={["Fon yap", () => onMusic(t)]} add={{ kind: "music", refId: t.id, label: t.title, text: "" }} />)}
        {tab === "sfx" && sfx.filter((s) => has(s.name + " " + s.category)).map((s) => <Row key={s.id} title={s.name} sub={s.category} add={{ kind: "sfx", refId: s.id, label: s.name, text: "" }} />)}
        {tab === "flows" && flows.filter((f) => has(f.name)).map((f) => <Row key={f.id} title={f.name} sub={`${f.items.length} öğe`} main={["Yükle", () => onFlow(f)]} />)}
      </ul>
      {canAdd && (
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn ghost" onClick={() => addToFlow({ kind: "note", refId: null, label: "Konuşma notu", text: "" })}>+ Konuşma notu</button>
          <button className="btn ghost" onClick={() => addToFlow({ kind: "break", refId: null, label: "Ara", text: "" })}>+ Ara</button>
          <button className="btn ghost" onClick={() => addToFlow({ kind: "opening", refId: null, label: "Açılış", text: "" })}>+ Açılış</button>
          <button className="btn ghost" onClick={() => addToFlow({ kind: "closing", refId: null, label: "Kapanış", text: "" })}>+ Kapanış</button>
        </div>
      )}
    </div>
  );
}
