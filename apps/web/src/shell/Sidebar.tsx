import { useEffect, useState } from "react";
import type { Section } from "../shared/settings";
import { tr } from "../shared/tr";
import { Icon } from "./icons";
import { GROUPS, MAIN_NAV, moduleOf, sectionTitle as title } from "./nav";

export { MAIN_NAV as NAV } from "./nav";
export const sectionTitle = title;

type P = { section: Section; compact: boolean; onGo: (s: Section) => void; onNew: () => void };

/**
 * Sol menü (masaüstü) / yatay kaydırmalı şerit (dar ekran).
 * Dört ana modül vardır; Ses Stüdyosu ve Yayın Stüdyosu açılır ve kendi alt bölümlerini barındırır.
 */
export function Sidebar({ section, compact, onGo, onNew }: P) {
  const mod = moduleOf(section);
  const [open, setOpen] = useState<Record<string, boolean>>({ studio: mod === "studio", live: mod === "live" });
  useEffect(() => { if (mod === "studio" || mod === "live") setOpen((o) => ({ ...o, [mod]: true })); }, [mod]);
  return (
    <aside className={"side" + (compact ? " compact" : "")}>
      <div className="brand"><i aria-hidden="true" /> <span className="brand-t">{tr.brand}</span></div>
      <button className="btn primary side-new" onClick={onNew} title="Yeni Kayıt"><Icon name="plus" size={20} /> <span className="nav-l">Yeni Kayıt</span></button>
      <nav aria-label="Ana menü">
        <ul className="nav">
          {MAIN_NAV.map((n) => {
            const g = GROUPS.find((x) => x.id === n.id);
            if (!g) return (
              <li key={n.id}>
                <button className="nav-i" aria-current={mod === n.id && (section === n.id || (n.id === "video" && section === "archive")) ? "page" : undefined} onClick={() => onGo(n.id)}>
                  <Icon name={n.icon} /> <span className="nav-l">{n.label}</span>
                </button>
              </li>
            );
            const isOpen = !!open[g.id];
            return (
              <li key={g.id} className="nav-group">
                <button className={"nav-i" + (mod === g.id ? " nav-on" : "")} aria-expanded={isOpen} aria-controls={g.id + "-sub"} onClick={() => setOpen({ ...open, [g.id]: !isOpen })}>
                  <Icon name={g.icon} /> <span className="nav-l">{g.label}</span>
                  <span className={"nav-chev" + (isOpen ? " up" : "")}><Icon name="chevron" size={16} /></span>
                </button>
                {isOpen && (
                  <ul id={g.id + "-sub"} className="nav-sub" aria-label={g.label + " bölümleri"}>
                    {g.items.map((s) => (
                      <li key={s.id}>
                        <button className="nav-i nav-s" aria-current={section === s.id ? "page" : undefined} onClick={() => (s.id === "studio" ? onNew() : onGo(s.id))}>
                          <Icon name={s.icon} size={18} /> <span className="nav-l">{s.label}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
      <p className="side-foot small muted">Kayıtların cihazında kalır.</p>
    </aside>
  );
}
