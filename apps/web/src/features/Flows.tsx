import { useCallback, useEffect, useState } from "react";
import type { Performance } from "@siir/contracts";
import { Icon } from "../shell/icons";
import type { Actions } from "../shell/types";
import type { LocalData } from "../shared/useLocalData";
import { deleteFlow, FLOW_KINDS, flowKindLabel, listFlows, moveItem, newFlow, saveFlow, type Flow, type FlowItem, type FlowKind } from "../storage/flows";
import { listPerformances } from "../storage/performances";
import { listSfx, type SfxItem } from "../storage/sfx";
import { useLocalTracks } from "./LocalMusic";
import { EmptyState, PageHeader } from "./parts";

/** Yayın Akışlarım: yayından önce hazırlanan program. Öğeler mevcut şiir / kayıtlı şiir / fon / efektlere bağlanır; içerik kopyalanmaz. */
export function Flows({ data, actions }: { data: LocalData; actions: Actions }) {
  const [flows, setFlows] = useState<Flow[] | null>(null);
  const [sel, setSel] = useState<string>("");
  const [perfs, setPerfs] = useState<Performance[]>([]);
  const [sfx, setSfx] = useState<SfxItem[]>([]);
  const [kind, setKind] = useState<FlowKind>("live-poem");
  const [ref, setRef] = useState("");
  const mine = useLocalTracks();
  const reload = useCallback(async () => setFlows(await listFlows()), []);
  useEffect(() => { void reload(); void listPerformances().then(setPerfs); void listSfx().then(setSfx); }, [reload]);
  const flow = flows?.find((f) => f.id === sel) ?? null;
  const update = async (next: Flow) => { await saveFlow(next); await reload(); };

  const options: { id: string; label: string }[] =
    kind === "live-poem" ? (data.projects ?? []).map((p) => ({ id: p.id, label: p.title || "Adsız şiir" }))
    : kind === "recorded" ? perfs.map((p) => ({ id: p.id, label: p.title || "Adsız şiir" }))
    : kind === "music" ? (mine.tracks ?? []).map((t) => ({ id: t.id, label: t.title }))
    : kind === "sfx" ? sfx.map((s) => ({ id: s.id, label: s.name })) : [];
  const needsRef = ["live-poem", "recorded", "music", "sfx"].includes(kind);

  const add = () => {
    if (!flow) return;
    const o = options.find((x) => x.id === ref);
    if (needsRef && !o) return;
    void update({ ...flow, items: [...flow.items, { id: crypto.randomUUID(), kind, refId: needsRef ? ref : null, label: o?.label ?? flowKindLabel(kind), text: "" }] });
  };
  const patchItem = (it: FlowItem, p: Partial<FlowItem>) => flow && void update({ ...flow, items: flow.items.map((x) => (x.id === it.id ? { ...x, ...p } : x)) });

  return (
    <>
      <PageHeader title="Yayın Akışlarım" sub="Yayın Stüdyosu · yayından önce programını hazırla"
        actions={<button className="btn primary" onClick={async () => { const n = window.prompt("Akışın adı?", "Yeni akış"); if (!n) return; const f = newFlow(n); await saveFlow(f); await reload(); setSel(f.id); }}><Icon name="plus" size={18} /> Yeni akış</button>} />
      {flows === null ? <p className="muted">Yükleniyor…</p> : flows.length === 0 ? (
        <EmptyState icon="list" title="Henüz yayın akışın yok">Şiirleri, kayıtları, fonları ve efektleri sıraya koyup “Sıradaki” düğmesiyle yayını ilerlet.</EmptyState>
      ) : (
        <div className="filters" role="group" aria-label="Akışlar">
          {flows.map((f) => <button key={f.id} className="btn" aria-pressed={sel === f.id} onClick={() => setSel(f.id)}>{f.name} <small>({f.items.length})</small></button>)}
        </div>
      )}
      {flow && (
        <section className="card sec" aria-label={flow.name}>
          <div className="row between">
            <input type="text" aria-label="Akış adı" defaultValue={flow.name} key={flow.id} maxLength={80} style={{ maxWidth: 360 }} onBlur={(e) => { if (e.target.value.trim() && e.target.value !== flow.name) void update({ ...flow, name: e.target.value }); }} />
            <span className="row">
              <button className="btn primary" onClick={() => actions.go("live")}>Yayın masasına git</button>
              <button className="btn ghost" onClick={async () => { if (!confirm(`“${flow.name}” akışı silinsin mi? Şiirler, kayıtlar ve fonlar silinmez.`)) return; await deleteFlow(flow.id); setSel(""); await reload(); }}>Akışı sil</button>
            </span>
          </div>
          <ol className="flow-edit">
            {flow.items.map((it, i) => (
              <li key={it.id} className="flow-row">
                <b>{i + 1}.</b> <span className="chip">{flowKindLabel(it.kind)}</span>
                <input type="text" aria-label="Öğe adı" value={it.label} maxLength={120} onChange={(e) => patchItem(it, { label: e.target.value })} style={{ flex: "1 1 160px", minHeight: 40 }} />
                {(it.kind === "note" || it.kind === "opening" || it.kind === "closing" || it.kind === "break") && <input type="text" aria-label="Metin" placeholder="Not / konuşma metni" value={it.text} maxLength={2000} onChange={(e) => patchItem(it, { text: e.target.value })} style={{ flex: "2 1 220px", minHeight: 40 }} />}
                <button className="btn ghost" aria-label="Yukarı taşı" disabled={i === 0} onClick={() => void update({ ...flow, items: moveItem(flow.items, i, i - 1) })}>↑</button>
                <button className="btn ghost" aria-label="Aşağı taşı" disabled={i === flow.items.length - 1} onClick={() => void update({ ...flow, items: moveItem(flow.items, i, i + 1) })}>↓</button>
                <button className="btn ghost" aria-label={`${it.label || "Öğe"} akıştan çıkar`} onClick={() => { if (confirm("Bu öğe akıştan çıkarılsın mı?")) void update({ ...flow, items: flow.items.filter((x) => x.id !== it.id) }); }}>✕</button>
              </li>
            ))}
          </ol>
          <div className="row" style={{ marginTop: 12 }}>
            <select aria-label="Öğe türü" value={kind} onChange={(e) => { setKind(e.target.value as FlowKind); setRef(""); }} style={{ maxWidth: 220 }}>
              {FLOW_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
            </select>
            {needsRef && (
              <select aria-label="İçerik" value={ref} onChange={(e) => setRef(e.target.value)} style={{ maxWidth: 280 }}>
                <option value="">Seç…</option>{options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            )}
            <button className="btn primary" disabled={needsRef && !ref} onClick={add}>+ Akışa ekle</button>
          </div>
        </section>
      )}
    </>
  );
}
