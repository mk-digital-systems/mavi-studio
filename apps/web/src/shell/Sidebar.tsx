import type { Section } from "../shared/settings";
import { tr } from "../shared/tr";
import { Icon, type IconName } from "./icons";

export const NAV: { id: Section; label: string; icon: IconName }[] = [
  { id: "home", label: "Ana Panel", icon: "home" },
  { id: "studio", label: "Ses Stüdyosu", icon: "mic" },
  { id: "video", label: "Video Editörü", icon: "film" },
  { id: "poems", label: "Şiir Kütüphanem", icon: "book" },
  { id: "music", label: "Fon Müziklerim", icon: "music" },
  { id: "archive", label: "Video Arşivim", icon: "archive" },
  { id: "recordings", label: "Ses Kayıtlarım", icon: "wave" },
  { id: "settings", label: "Stüdyo Ayarları", icon: "settings" },
];
export const sectionTitle = (s: Section) => NAV.find((n) => n.id === s)!.label;

type P = { section: Section; compact: boolean; onGo: (s: Section) => void };

/** Sol menü (masaüstü) / yatay kaydırmalı şerit (dar ekran). Mevcut sayfa `aria-current="page"` ile bildirilir. */
export function Sidebar({ section, compact, onGo }: P) {
  return (
    <aside className={"side" + (compact ? " compact" : "")}>
      <div className="brand"><i aria-hidden="true" /> <span className="brand-t">{tr.brand}</span></div>
      <nav aria-label="Ana menü">
        <ul className="nav">
          {NAV.map((n, i) => (
            <li key={n.id} className={i === NAV.length - 1 ? "nav-sep" : undefined}>
              <button className="nav-i" aria-current={section === n.id ? "page" : undefined} onClick={() => onGo(n.id)}>
                <Icon name={n.icon} /> <span className="nav-l">{n.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <p className="side-foot small muted">Kayıtların cihazında kalır.</p>
    </aside>
  );
}
