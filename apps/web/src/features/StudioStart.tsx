import { useMemo, useState } from "react";
import { Icon } from "../shell/icons";
import type { Actions } from "../shell/types";
import type { LocalData } from "../shared/useLocalData";
import { supported } from "../audio/recorder";
import { PageHeader, RecoveryBanner } from "./parts";

const norm = (s: string) => s.toLocaleLowerCase("tr");
const first = (t: string) => t.split("\n").map((l) => l.trim()).find(Boolean) ?? "";
type Filter = "all" | "recorded" | "new";

/** Yeni Kayıt · 1. adım: kütüphaneden bir şiir seç (arama, filtre, son kullanılanlar) ya da yeni şiir ekle. */
export function StudioStart({ data, actions }: { data: LocalData; actions: Actions }) {
  const ok = supported();
  const [q, setQ] = useState("");
  const [f, setF] = useState<Filter>("all");
  const [msg, setMsg] = useState("");
  const all = data.projects ?? [];
  const list = useMemo(() => {
    const k = norm(q.trim());
    return all.filter((p) => (!k || norm(p.title).includes(k) || norm(p.text).includes(k)) &&
      (f === "all" || (f === "recorded" ? (data.takes[p.id] ?? []).length > 0 : (data.takes[p.id] ?? []).length === 0)));
  }, [all, data.takes, q, f]);
  const searching = q.trim() !== "" || f !== "all";
  const recent = searching ? [] : list.slice(0, 3);
  const rest = searching ? list : list.slice(3);

  const row = (p: (typeof all)[number]) => {
    const t = data.takes[p.id] ?? [];
    return (
      <li key={p.id} className="pick-row">
        <div className="pick-t">
          <b>{p.title || "Adsız şiir"}</b>
          <span className="muted small">{first(p.text) || "Henüz metin yok"} · {t.length} ses denemesi</span>
        </div>
        <button className="btn primary" disabled={!ok} onClick={() => actions.open(p, p.text.trim() ? "music" : "poem")}>Bu şiirle kaydet</button>
      </li>
    );
  };

  return (
    <>
      <PageHeader title="Yeni Kayıt" sub="Ses Stüdyosu · 1. adım: şiirini seç"
        actions={<button className="btn primary" disabled={!ok} onClick={() => actions.create()}><Icon name="plus" size={18} /> Yeni şiir</button>} />
      {msg && <div className="note" role="status">{msg}</div>}
      <RecoveryBanner orphans={data.orphans} reload={data.reload} onMsg={setMsg} />
      <p className="muted">Kütüphanenden bir şiir seç ya da yeni bir şiir ekle. Sonra fon müziğini seçecek, hazırlanıp kayda başlayacaksın.</p>

      <div className="search">
        <label htmlFor="ns-q" className="sr">Şiirlerde ara</label>
        <Icon name="search" size={18} />
        <input id="ns-q" type="search" placeholder="Başlık veya dize ara…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="filters" role="group" aria-label="Şiirleri filtrele">
        <button className="btn" aria-pressed={f === "all"} onClick={() => setF("all")}>Hepsi</button>
        <button className="btn" aria-pressed={f === "recorded"} onClick={() => setF("recorded")}>Kaydı olanlar</button>
        <button className="btn" aria-pressed={f === "new"} onClick={() => setF("new")}>Henüz okunmayanlar</button>
      </div>

      {data.projects === null ? <p className="muted">Yükleniyor…</p> : all.length === 0 ? (
        <section className="card"><h2 className="h3">Kütüphanen boş</h2><p className="muted">İlk şiirini ekleyerek başla.</p>
          <button className="btn primary" disabled={!ok} onClick={() => actions.create()}><Icon name="plus" size={18} /> Yeni şiir</button></section>
      ) : list.length === 0 ? <p className="muted">Eşleşen şiir yok.</p> : (
        <>
          {recent.length > 0 && <section className="sec" aria-labelledby="ns-r"><h2 id="ns-r" className="h3">Son kullanılanlar</h2><ul className="pick-list">{recent.map(row)}</ul></section>}
          {rest.length > 0 && <section className="sec" aria-labelledby="ns-a"><h2 id="ns-a" className="h3">{searching ? `${list.length} şiir` : "Kütüphane"}</h2><ul className="pick-list">{rest.map(row)}</ul></section>}
        </>
      )}
    </>
  );
}
