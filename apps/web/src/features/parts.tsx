import { useRef, useState, type ReactNode } from "react";
import type { Project, Take } from "@siir/contracts";
import { Icon } from "../shell/icons";
import { deleteTake, newProject, recoverTake, saveProject, wipeEverything } from "../storage/repo";
import { downloadLibraryBackup, parseAnyBackup } from "../storage/backup";
import { mb, requestPersist, storageInfo, type StorageInfo } from "../storage/quota";
import { fmt } from "../shared/util";

export function PageHeader({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <header className="page-h">
      <div><h1>{title}</h1>{sub && <p className="muted">{sub}</p>}</div>
      {actions && <div className="row">{actions}</div>}
    </header>
  );
}

export function EmptyState({ icon, title, children, action }: { icon: Parameters<typeof Icon>[0]["name"]; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-i"><Icon name={icon} size={28} /></span>
      <h2 className="h3">{title}</h2>
      {children && <p className="muted">{children}</p>}
      {action}
    </div>
  );
}

const first = (t: string) => t.split("\n").map((l) => l.trim()).find(Boolean) ?? "";

type CardProps = { p: Project; takes: Take[]; actions: ReactNode; level?: 2 | 3 };
/** Bir çalışmanın (şiir + denemeler + fon seçimi) özet kartı: her şey tek proje altında görünür. */
export function ProjectCard({ p, takes, actions, level = 3 }: CardProps) {
  const H = (level === 2 ? "h2" : "h3") as "h2" | "h3";
  return (
    <article className="pcard">
      <H>{p.title || "Adsız şiir"}</H>
      <p className="muted small pcard-snip">{first(p.text) || "Henüz metin yok"}</p>
      <div className="chips">
        <span className="chip">{takes.length} ses denemesi</span>
        {p.trackId && <span className="chip">fon müziği seçili</span>}
        <span className="chip">{new Date(p.updatedAt).toLocaleDateString("tr-TR")}</span>
      </div>
      <div className="row pcard-act">{actions}</div>
    </article>
  );
}

/** Yarım kalan (çökme/kapanma) kayıtları için kurtarma bildirimi. */
export function RecoveryBanner({ orphans, reload, onMsg }: { orphans: Take[]; reload: () => Promise<void>; onMsg: (m: string) => void }) {
  if (!orphans.length) return null;
  return (
    <>
      {orphans.map((t) => (
        <div key={t.id} className="warn" role="alert">
          Yarım kalmış bir kayıt bulundu ({new Date(t.createdAt).toLocaleString("tr-TR")}). Sayfa beklenmedik şekilde kapanmış olabilir.
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn primary" onClick={async () => {
              const done = await recoverTake(t);
              onMsg(done ? `Kayıt kurtarıldı (${fmt(done.durationMs)}).` : "Kurtarılacak ses bulunamadı; boş kayıt silindi."); await reload();
            }}>Kaydı kurtar</button>
            <button className="btn ghost" onClick={async () => { await deleteTake(t.id); await reload(); }}>Sil</button>
          </div>
        </div>
      ))}
    </>
  );
}

/** Depolama kullanımı, kalıcı depolama izni ve veri kaybı uyarısı. */
export function StoragePanel({ info, reload }: { info: StorageInfo | null; reload: () => Promise<void> }) {
  const pct = info?.known && info.quota ? Math.min(100, (info.usage / info.quota) * 100) : 0;
  return (
    <div>
      <div className="warn">
        Çalışmaların yalnızca bu tarayıcıda saklanır. Tarayıcı verilerini temizlersen veya özel gezinti kullanırsan <b>kaybolabilir</b>.
        Kalıcı depolama izni bu riski azaltır ama tam güvence vermez; önemli işler için düzenli yedek al ve sesleri WAV olarak indir.
      </div>
      {info?.known ? (
        <>
          <label>Depolama</label>
          <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label="Depolama kullanımı"><div style={{ width: pct + "%" }} /></div>
          <p className="small muted">{mb(info.usage)} / {mb(info.quota)} kullanıldı · Kalıcı depolama: {info.persisted ? "açık" : info.persisted === false ? "kapalı" : "bilinmiyor"}</p>
          {info.persisted === false && <button className="btn" onClick={async () => { await requestPersist(); await storageInfo(); await reload(); }}>Kalıcı depolamayı iste</button>}
        </>
      ) : <p className="small muted">Bu tarayıcı depolama bilgisini vermiyor.</p>}
    </div>
  );
}

export function WipeButton({ reload, onMsg }: { reload: () => Promise<void>; onMsg: (m: string) => void }) {
  return (
    <button className="btn ghost" onClick={async () => {
      if (!confirm("Bu cihazdaki TÜM çalışmalar, kayıtlar ve ayarlar silinecek. Emin misin?")) return;
      await wipeEverything(); onMsg("Tüm yerel veri silindi."); await reload();
    }}><Icon name="trash" size={18} /> Tüm yerel veriyi sil</button>
  );
}

/** Tümünü yedekle / yedekten geri yükle (proje ve kütüphane yedeklerini kabul eder; ses içermez). */
export function BackupTools({ projects, reload, onMsg, onErr }: { projects: Project[]; reload: () => Promise<void>; onMsg: (m: string) => void; onErr: (m: string) => void }) {
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const importFile = async (f?: File) => {
    if (!f) return;
    setBusy(true); onErr("");
    try {
      const items = await parseAnyBackup(f);
      for (const b of items) await saveProject(newProject(b));
      onMsg(`${items.length} şiir geri yüklendi. Ses kayıtları yedeğe dahil değildir; yeniden okuyabilirsin.`);
      await reload();
    } catch (e) { onErr((e as Error).message); }
    setBusy(false);
    if (file.current) file.current.value = "";
  };
  return (
    <div className="row">
      <button className="btn" disabled={!projects.length} onClick={() => downloadLibraryBackup(projects)}><Icon name="download" size={18} /> Tümünü yedekle (JSON)</button>
      <input ref={file} type="file" accept="application/json,.json" className="sr" id="bk-imp" disabled={busy} onChange={(e) => void importFile(e.target.files?.[0])} />
      <label htmlFor="bk-imp" className="btn ghost" style={{ margin: 0, textTransform: "none", letterSpacing: 0, fontSize: "1rem", color: "var(--text)", display: "inline-flex", alignItems: "center" }}>Yedekten geri yükle</label>
    </div>
  );
}
