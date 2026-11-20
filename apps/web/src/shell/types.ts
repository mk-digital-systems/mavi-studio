import type { Performance, Project, Take } from "@siir/contracts";
import type { Section } from "../shared/settings";

export type StudioStep = "poem" | "music" | "record" | "review";

/** Sayfaların uygulama kabuğuyla konuştuğu eylemler. */
export type Actions = {
  go: (s: Section) => void;
  /** Bir çalışmayı Ses Stüdyosu'nda açar; `video: true` ise dışa aktarmada "video da hazırla" önceden seçilir. */
  open: (p: Project, step?: StudioStep, opts?: { video?: boolean }) => void;
  /** Yeni çalışma açar; `trackId` verilirse o fon müziğiyle başlar. */
  create: (opts?: { video?: boolean; trackId?: string }) => void;
  /** Yeni Kayıt akışını başa alır (şiir seçimi). */
  newRecording: () => void;
  /** Şiiri, ses (işlenmiş/kuru) ve fonu AYRI kanallar olarak, metin ve zamanlamalarıyla Video Stüdyosu'na gönderir. */
  sendToVideo: (p: Project, t: Take, perf?: Performance | null) => void;
  /** Kayıtlı bir şiiri Yayın Stüdyosu'nda çalmak üzere açar. */
  playInLive: (perf: Performance) => void;
};
