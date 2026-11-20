import type { Project } from "@siir/contracts";
import type { Section } from "../shared/settings";

export type StudioStep = "poem" | "music" | "record" | "review";

/** Sayfaların uygulama kabuğuyla konuştuğu eylemler. */
export type Actions = {
  go: (s: Section) => void;
  /** Bir çalışmayı Ses Stüdyosu'nda açar; `video: true` ise dışa aktarmada "video da hazırla" önceden seçilir. */
  open: (p: Project, step?: StudioStep, opts?: { video?: boolean }) => void;
  /** Yeni çalışma açar; `trackId` verilirse o fon müziğiyle başlar. */
  create: (opts?: { video?: boolean; trackId?: string }) => void;
};
