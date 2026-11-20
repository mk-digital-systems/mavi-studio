import { useCallback, useEffect, useRef, useState } from "react";
import type { Project, Take } from "@siir/contracts";
import { tr } from "./shared/tr";
import { guard } from "./shared/prefs";
import { Editor } from "./features/Editor";
import { MusicPicker } from "./features/MusicPicker";
import { RecordScreen } from "./features/RecordScreen";
import { Review } from "./features/Review";
import { Dashboard } from "./features/Dashboard";
import { StudioStart } from "./features/StudioStart";
import { VideoHub } from "./features/VideoHub";
import { VideoArchive } from "./features/VideoArchive";
import { PoemLibrary } from "./features/PoemLibrary";
import { MusicLibrary } from "./features/MusicLibrary";
import { Recordings } from "./features/Recordings";
import { SettingsPage } from "./features/SettingsPage";
import { Sidebar, sectionTitle } from "./shell/Sidebar";
import type { Actions, StudioStep } from "./shell/types";
import { listTakes, newProject, saveProject } from "./storage/repo";
import { downloadBackup } from "./storage/backup";
import { ErrorBoundary } from "./shared/ErrorBoundary";
import { getSettings, useSettings, type Section } from "./shared/settings";
import { useLocalData } from "./shared/useLocalData";

export type Draft = Project;
export type Patch = (p: Partial<Pick<Project, "title" | "text" | "trackId" | "primaryTakeId" | "status" | "fx" | "mix" | "reading">>) => void;

const order: StudioStep[] = ["poem", "music", "record", "review"];
const stepTitle: Record<StudioStep, string> = { poem: "Şiir", music: "Fon müziği", record: "Kayıt", review: "Dinle ve dışa aktar" };

export function App() {
  const settings = useSettings();
  const [section, setSection] = useState<Section>(() => getSettings().appearance.startSection);
  const [step, setStep] = useState<StudioStep>("poem");
  const [project, setProject] = useState<Project | null>(null);
  const [takes, setTakes] = useState<Take[]>([]);
  const [wantVideo, setWantVideo] = useState(false);
  const [saveError, setSaveError] = useState("");
  const latest = useRef<Project | null>(null);
  const timer = useRef<number>(0);
  const dirty = useRef(false);
  const data = useLocalData();

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    const p = latest.current;
    if (!p || !dirty.current) return;
    if (!p.title.trim() && !p.text.trim()) { dirty.current = false; guard.pendingSave = false; return; } // boş çalışma kaydedilmez
    dirty.current = false;
    try { await saveProject(p); setSaveError(""); }
    catch { dirty.current = true; setSaveError("Çalışma bu cihaza kaydedilemedi (depolama dolu veya kapalı olabilir)."); }
    guard.pendingSave = dirty.current;
  }, []);

  const patch: Patch = useCallback((p) => {
    const next = { ...latest.current!, ...p };
    latest.current = next; dirty.current = true; guard.pendingSave = true;
    setProject(next);
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flush(), 400);
  }, [flush]);

  const reloadTakes = useCallback(async () => {
    if (latest.current) setTakes(await listTakes(latest.current.id));
  }, []);

  /** Bölüm değiştirmeden önce: kayıt sürüyorsa engelle, bekleyen kaydı yaz, yerel verileri tazele. */
  const go = useCallback(async (s: Section): Promise<boolean> => {
    if (guard.recording) { alert("Kayıt sürüyor. Önce kaydı bitir."); return false; }
    await flush();
    setSection(s);
    if (s !== "studio") void data.reload();
    return true;
  }, [flush, data]);

  const open = useCallback(async (p: Project, to: StudioStep = "poem", opts?: { video?: boolean }) => {
    if (guard.recording) { alert("Kayıt sürüyor. Önce kaydı bitir."); return; }
    await flush();
    latest.current = p; dirty.current = false;
    setProject(p); setTakes(await listTakes(p.id)); setStep(to); setWantVideo(!!opts?.video); setSection("studio");
  }, [flush]);

  const create = useCallback((opts?: { video?: boolean; trackId?: string }) => {
    void open(newProject(opts?.trackId ? { trackId: opts.trackId } : undefined), "poem", { video: opts?.video });
  }, [open]);

  const actions: Actions = { go: (s) => void go(s), open: (p, st, o) => void open(p, st, o), create };

  // Sekme gizlenince/kapanırken bekleyen kaydı yaz; kayıt sürerken veya yazım bekliyorsa uyar.
  useEffect(() => {
    const hide = () => { if (document.visibilityState === "hidden") void flush(); };
    const before = (e: BeforeUnloadEvent) => {
      void flush();
      if (guard.recording || guard.pendingSave || guard.exporting) { e.preventDefault(); e.returnValue = ""; }
    };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", () => void flush());
    window.addEventListener("beforeunload", before);
    return () => { document.removeEventListener("visibilitychange", hide); window.removeEventListener("beforeunload", before); };
  }, [flush]);

  // Görünüm ayarları: tema, yazı boyutu. "Sistem" teması işletim sisteminin tercihini izler.
  const { theme, textScale, sidebar } = settings.appearance;
  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia?.("(prefers-color-scheme: light)");
    const apply = () => { root.dataset.theme = theme === "system" ? (mq?.matches ? "light" : "dark") : theme; };
    apply();
    mq?.addEventListener?.("change", apply);
    root.style.setProperty("--ts", String(textScale));
    return () => mq?.removeEventListener?.("change", apply);
  }, [theme, textScale]);

  // Bölüm/adım değişince: sayfa başlığı güncellenir, odak ana içeriğe taşınır, ekran okuyucuya duyurulur.
  const mainRef = useRef<HTMLElement>(null);
  const first = useRef(true);
  const [announce, setAnnounce] = useState("");
  const inWizard = section === "studio" && !!project;
  useEffect(() => {
    const label = inWizard ? `${stepTitle[step]} — ${sectionTitle("studio")}` : sectionTitle(section);
    document.title = `${label} — ${tr.brand}`;
    if (first.current) { first.current = false; return; }
    mainRef.current?.focus({ preventScroll: false });
    window.scrollTo({ top: 0 });
    setAnnounce(inWizard ? `Adım ${order.indexOf(step) + 1} / ${order.length}: ${stepTitle[step]}` : sectionTitle(section));
  }, [section, step, inWizard]);

  const idx = order.indexOf(step);
  return (
    <div className={"layout" + (sidebar === "compact" ? " is-compact" : "")}>
      <a className="skip" href="#main" onClick={(e) => { e.preventDefault(); mainRef.current?.focus(); }}>İçeriğe geç</a>
      <div className="sr" role="status" aria-live="polite">{announce}</div>
      <Sidebar section={section} compact={sidebar === "compact"} onGo={(s) => void go(s)} />
      <div className="content">
        <div className="shell">
          {saveError && <div className="alert" role="alert">{saveError}</div>}
          <main id="main" ref={mainRef} tabIndex={-1}>
            <ErrorBoundary key={section + (inWizard ? step : "")}>
              {section === "home" && <Dashboard data={data} actions={actions} />}
              {section === "studio" && !project && <StudioStart data={data} actions={actions} />}
              {inWizard && project && (<>
                <div className="wiz-h">
                  <p className="muted small">Çalışma: <b>{project.title || "Adsız şiir"}</b></p>
                  {project.text.trim() && <button className="btn ghost" onClick={() => downloadBackup(project)}>Yedek (JSON)</button>}
                </div>
                <nav aria-label="Adımlar"><ol className="steps">
                  {tr.steps.map((s, i) => (
                    <li key={s} className={i < idx ? "done" : i === idx ? "cur" : ""} aria-current={i === idx ? "step" : undefined}>{i + 1}. {s}</li>
                  ))}
                </ol></nav>
                {step === "poem" && <Editor draft={project} patch={patch} next={() => setStep("music")} />}
                {step === "music" && <MusicPicker draft={project} patch={patch} back={() => setStep("poem")} next={() => setStep("record")} />}
                {step === "record" && <RecordScreen draft={project} patch={patch} takes={takes} reloadTakes={reloadTakes} ensureSaved={flush} back={() => setStep("music")} next={() => setStep("review")} />}
                {step === "review" && <Review draft={project} patch={patch} takes={takes} reloadTakes={reloadTakes} wantVideo={wantVideo} back={() => setStep("record")} />}
              </>)}
              {section === "video" && <VideoHub data={data} actions={actions} />}
              {section === "poems" && <PoemLibrary data={data} actions={actions} />}
              {section === "music" && <MusicLibrary actions={actions} />}
              {section === "archive" && <VideoArchive actions={actions} />}
              {section === "recordings" && <Recordings data={data} actions={actions} />}
              {section === "settings" && <SettingsPage data={data} actions={actions} />}
            </ErrorBoundary>
          </main>
          <footer>
            <p>{tr.privacy}</p>
            <p><a className="flink" href="https://mustafaoner.net" rel="noopener">Mustafa Öner</a> · şiir alanı</p>
          </footer>
        </div>
      </div>
    </div>
  );
}
