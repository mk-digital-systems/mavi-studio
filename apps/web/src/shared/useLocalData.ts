import { useCallback, useEffect, useState } from "react";
import type { Project, Take } from "@siir/contracts";
import { findIncompleteTakes, listProjects, listTakes, sweepOrphanChunks } from "../storage/repo";
import { storageInfo, type StorageInfo } from "../storage/quota";

export type LocalData = {
  projects: Project[] | null;
  takes: Record<string, Take[]>;     // yalnızca tamamlanmış denemeler
  orphans: Take[];                   // yarım kalmış (kurtarılabilir) denemeler
  info: StorageInfo | null;
  error: string;
  reload: () => Promise<void>;
};

/** Yerel (IndexedDB) çalışmaları, denemeleri ve depolama durumunu yükler. Sayfa açılışında yetim ses parçalarını süpürür. */
export function useLocalData(): LocalData {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [takes, setTakes] = useState<Record<string, Take[]>>({});
  const [orphans, setOrphans] = useState<Take[]>([]);
  const [info, setInfo] = useState<StorageInfo | null>(null);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    try {
      await sweepOrphanChunks();
      const ps = await listProjects();
      const entries = await Promise.all(ps.map(async (p) => [p.id, (await listTakes(p.id)).filter((t) => t.status === "complete")] as const));
      setProjects(ps); setTakes(Object.fromEntries(entries));
      setOrphans(await findIncompleteTakes());
      setInfo(await storageInfo()); setError("");
    } catch {
      setError("Yerel depolama açılamadı. Özel gezinti modunda veya tarayıcı depolamayı kapatmış olabilir; çalışmaların kaydedilemeyebilir.");
      setProjects([]);
    }
  }, []);
  useEffect(() => { void reload(); }, [reload]);
  return { projects, takes, orphans, info, error, reload };
}
