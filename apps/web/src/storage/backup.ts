import type { Project, ProjectBackup } from "@siir/contracts";
import { slug } from "../shared/util";
import { sanitizeFx } from "../audio/fx/settings";
import { sanitizeMix } from "../shared/mix";

type BackupProject = ProjectBackup["project"];

/** Tüm çalışmaların tek dosyalık yedeği. Yalnızca proje bilgisi: ses ve fon müziği içermez. */
export type LibraryBackup = { format: "siir-studyosu-library"; version: 1; exportedAt: string; projects: BackupProject[] };

const toBackupProject = (p: Project): BackupProject => ({ title: p.title, text: p.text, trackId: p.trackId, createdAt: p.createdAt, fx: p.fx, mix: p.mix });

export function projectToBackup(p: Project): ProjectBackup {
  return { format: "siir-studyosu-project", version: 2, exportedAt: new Date().toISOString(), project: toBackupProject(p) };
}
export function libraryToBackup(ps: Project[]): LibraryBackup {
  return { format: "siir-studyosu-library", version: 1, exportedAt: new Date().toISOString(), projects: ps.map(toBackupProject) };
}

function save(obj: unknown, name: string) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
export const downloadBackup = (p: Project) => save(projectToBackup(p), `${slug(p.title)}-${new Date().toISOString().slice(0, 10)}.json`);
export const downloadLibraryBackup = (ps: Project[]) => save(libraryToBackup(ps), `siir-studyosu-yedek-${new Date().toISOString().slice(0, 10)}.json`);

/** Tek bir proje kaydını doğrular (güvenilmeyen girdi): tür/boyut denetlenir, fazlası yok sayılır. */
function sanitizeBackupProject(x: unknown): BackupProject {
  const p = (x && typeof x === "object" ? x : null) as Partial<BackupProject> | null;
  if (!p) throw new Error("Yedek dosyasındaki proje geçersiz.");
  const { title, text, trackId, createdAt, fx, mix } = p;
  if (typeof title !== "string" || typeof text !== "string" || title.length > 120 || text.length > 50_000)
    throw new Error("Yedek dosyasındaki başlık veya metin geçersiz.");
  const tid = typeof trackId === "string" && /^trk_\d{4}$/.test(trackId) ? trackId : null;
  const created = typeof createdAt === "string" && !Number.isNaN(Date.parse(createdAt)) ? createdAt : new Date().toISOString();
  // v1 yedeğinde fx/mix yok → varsayılan; bozuk değer → güvenli varsayılan. Ses/müzik hiçbir sürümde yok.
  return { title, text, trackId: tid, createdAt: created, fx: sanitizeFx(fx), mix: sanitizeMix(mix) };
}

async function readJson(file: File, max: number): Promise<unknown> {
  if (file.size > max) throw new Error(`Dosya çok büyük (en fazla ${Math.round(max / 1_000_000)} MB).`);
  try { return JSON.parse(await file.text()); } catch { throw new Error("Dosya geçerli bir JSON değil."); }
}

/** Tek proje yedeği (v1/v2). */
export async function parseBackup(file: File): Promise<BackupProject> {
  const d = (await readJson(file, 1_000_000)) as Partial<ProjectBackup>;
  if (d?.format !== "siir-studyosu-project" || (d.version !== 1 && d.version !== 2) || typeof d.project !== "object" || !d.project)
    throw new Error("Bu bir Şiir Stüdyosu proje yedeği değil.");
  return sanitizeBackupProject(d.project);
}

/** Tek proje yedeğini de, tüm çalışmaların yedeğini de kabul eder; her durumda doğrulanmış proje listesi döner. */
export async function parseAnyBackup(file: File): Promise<BackupProject[]> {
  const d = (await readJson(file, 10_000_000)) as Record<string, unknown>;
  if (d?.format === "siir-studyosu-library") {
    if (d.version !== 1 || !Array.isArray(d.projects)) throw new Error("Bu bir Şiir Stüdyosu yedeği değil.");
    if (d.projects.length > 500) throw new Error("Yedekte çok fazla proje var (en fazla 500).");
    return d.projects.map(sanitizeBackupProject);
  }
  if (d?.format === "siir-studyosu-project") return [await parseBackup(file)];
  throw new Error("Bu bir Şiir Stüdyosu yedeği değil.");
}
