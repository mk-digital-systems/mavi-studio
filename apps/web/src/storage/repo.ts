import type { FxSettings, MixSettings, Project, Take } from "@siir/contracts";
import { sanitizeFx } from "../audio/fx/settings";
import { migrateProject, migrateTake } from "./migrate";
import { sanitizeMix } from "../shared/mix";
import { forgetSettings, getSettings } from "../shared/settings";
import { wav24 } from "../audio/wav";
import { deleteWholeDatabase, store, wrap } from "./db";
import { deleteAudioDb } from "./audioDb";

/** Anonim oturum kimliği: cihaza özgü rastgele değer; kişisel veri değildir. */
export function anonymousSessionId(): string {
  let id = localStorage.getItem("siir.sid");
  if (!id) { id = crypto.randomUUID(); localStorage.setItem("siir.sid", id); }
  return id;
}

export function newProject(init?: Partial<Pick<Project, "title" | "text" | "trackId" | "createdAt">> & { fx?: FxSettings; mix?: MixSettings }): Project {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(), schemaVersion: 2, ownerId: null, anonymousSessionId: anonymousSessionId(),
    title: init?.title ?? "", text: init?.text ?? "", trackId: init?.trackId ?? null,
    primaryTakeId: null, fx: init?.fx ? sanitizeFx(init.fx) : sanitizeFx(getSettings().newProject.fx), mix: init?.mix ? sanitizeMix(init.mix) : sanitizeMix(getSettings().newProject.mix), status: "draft", createdAt: init?.createdAt ?? now, updatedAt: now,
  };
}

// ---------- Projeler ----------
export async function listProjects(): Promise<Project[]> {
  const { s } = await store("projects", "readonly");
  const all = (await wrap(s.getAll() as IDBRequest<unknown[]>)).map(migrateProject);
  return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export async function saveProject(p: Project) {
  const { s, done } = await store("projects", "readwrite");
  s.put({ ...p, schemaVersion: 2, fx: sanitizeFx(p.fx), mix: sanitizeMix(p.mix), updatedAt: new Date().toISOString() });
  await done;
}
export async function deleteProject(id: string) {
  const { deletePerformancesOfPoem } = await import("./performances"); // döngüsel içe aktarmayı önler
  await deletePerformancesOfPoem(id);
  for (const t of await listTakes(id)) await deleteTake(t.id);
  const { s, done } = await store("projects", "readwrite");
  s.delete(id);
  await done;
}

// ---------- Denemeler ----------
export async function listTakes(projectId: string): Promise<Take[]> {
  const { s } = await store("takes", "readonly");
  const all = (await wrap(s.index("projectId").getAll(projectId) as IDBRequest<unknown[]>)).map(migrateTake);
  return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
export async function putTake(t: Take) {
  const { s, done } = await store("takes", "readwrite");
  s.put(t.fx ? { ...t, fx: sanitizeFx(t.fx) } : t);
  await done;
}
export async function deleteTake(id: string) {
  await deleteChunks(id);
  const { s, done } = await store("takes", "readwrite");
  s.delete(id);
  await done;
}

// ---------- Ses parçaları ----------
const range = (takeId: string) => IDBKeyRange.bound([takeId, 0], [takeId, Number.MAX_SAFE_INTEGER]);

export async function putChunk(takeId: string, seq: number, bytes: Uint8Array) {
  const { s, done } = await store("audioChunks", "readwrite");
  s.put(bytes, [takeId, seq]);
  await done;
}
export async function deleteChunks(takeId: string) {
  const { s, done } = await store("audioChunks", "readwrite");
  s.delete(range(takeId));
  await done;
}
export async function loadTakeBlob(take: Take): Promise<Blob> {
  const { s } = await store("audioChunks", "readonly");
  const chunks = await wrap(s.getAll(range(take.id)) as IDBRequest<Uint8Array[]>);
  return wav24(chunks, take.sampleRate);
}

// ---------- Kurtarma ve temizlik ----------
/** Sayfa kapanması/çökme sonucu "recording" durumunda kalmış denemeler. */
export async function findIncompleteTakes(): Promise<Take[]> {
  const { s } = await store("takes", "readonly");
  const all = await wrap(s.getAll() as IDBRequest<Take[]>);
  return all.filter((t) => t.status === "recording");
}
/** Yarım denemeyi, diskte kalan parçalardan tamamlar. Boş ise siler ve null döner. */
export async function recoverTake(t: Take): Promise<Take | null> {
  const { s } = await store("audioChunks", "readonly");
  const chunks = await wrap(s.getAll(range(t.id)) as IDBRequest<Uint8Array[]>);
  const bytes = chunks.reduce((a, c) => a + c.length, 0);
  const durationMs = (bytes / 3 / t.sampleRate) * 1000;
  if (durationMs < 1000) { await deleteTake(t.id); return null; }
  const done: Take = { ...t, status: "complete", durationMs, chunkCount: chunks.length };
  await putTake(done);
  return done;
}
/** Sahibi (deneme kaydı) olmayan ses parçalarını siler. */
export async function sweepOrphanChunks(): Promise<number> {
  const { s: cs } = await store("audioChunks", "readonly");
  const keys = (await wrap(cs.getAllKeys())) as [string, number][];
  const ids = [...new Set(keys.map((k) => k[0]))];
  const { s: ts } = await store("takes", "readonly");
  const existing = new Set((await wrap(ts.getAllKeys())) as string[]);
  let n = 0;
  for (const id of ids) if (!existing.has(id)) { await deleteChunks(id); n++; }
  return n;
}
export async function wipeEverything() {
  await deleteWholeDatabase(); await deleteAudioDb();
  localStorage.removeItem("siir.sid"); forgetSettings();
}
