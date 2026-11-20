// Web ve API'nin ortak sözleşmeleri. Video modülü de yalnızca buradan okur.
export type AtmosphereId =
  | "clean" | "warm" | "intimate" | "small-hall" | "big-hall" | "stage" | "cinematic" | "vintage";

export type PoemText = { raw: string; stanzas: { id: string; lines: { id: string; text: string }[] }[] };

/** Istemciye giden alt küme: dosya yolu, lisans kanıtı ve ham dosya bilgisi YOKTUR. */
export type TrackPublic = {
  id: string; title: string; artist: string; cover: string; durationSec: number;
  genre: string; mood: string[]; tempoBpm: number;
  attributionRequired: boolean; attributionText?: string;
};

export type PreviewSession = { url: string; expiresInSec: number };

/** Ses zincirindeki bypass edilebilir modüller (DC temizliği ve limiter güvenlik için her zaman açıktır). */
export type FxModuleId = "highpass" | "gate" | "eq" | "compressor" | "deesser" | "reverb";

/** Kullanıcıya açılan sade kontroller. Çıkış seviyesi dB, diğerleri 0–100. */
export type FxControls = {
  cleanliness: number; warmth: number; clarity: number; width: number; reverb: number; outputDb: number;
};

/**
 * Geri alınabilir efekt ayarları: ses dosyasına ASLA işlenmez, yalnızca ayar olarak saklanır.
 * Kalıcı uygulama dışa aktarmada (Aşama 4) yapılır.
 */
export type FxSettings = {
  schemaVersion: 1;
  enabled: boolean;
  preset: AtmosphereId;
  controls: FxControls;
  bypass: Partial<Record<FxModuleId, boolean>>;
};

/** Kullanıcının dışa aktarma/miks tercihleri (proje başına). Ses/müzik dosyası içermez. */
export type MixSettings = {
  format: ExportFormat; poet: string; reader: string;
  music: ExportRecipe["music"]; ducking: ExportRecipe["ducking"]; alignmentOffsetMs: number;
};

/** Gelecekte hesap eklenince `ownerId` bağlanır; bugün her zaman null (anonim). */
export type Project = {
  id: string;
  schemaVersion: 2;
  ownerId: string | null;
  anonymousSessionId: string;
  title: string;
  text: string;
  trackId: string | null;
  primaryTakeId: string | null;
  /** Çalışma varsayılanı; denemede `fx` yoksa bu kullanılır. v1 projelerde yoktu (göç ile eklenir). */
  fx: FxSettings;
  /** v2'de sonradan eklendi: eski kayıtlarda yoksa varsayılan ile açılır. */
  mix: MixSettings;
  /** Projeye özel okuma tercihi (yoksa genel stüdyo ayarı geçerli). */
  reading?: { speed?: number };
  status: "draft" | "recorded";
  createdAt: string;
  updatedAt: string;
};

/** Ses verisi burada değil, IndexedDB `audioChunks` deposundadır. */
export type Take = {
  id: string;
  projectId: string;
  createdAt: string;
  /** "recording": yarım kalmış olabilir (kurtarma adayı). */
  status: "recording" | "complete";
  durationMs: number;
  sampleRate: number;
  channels: 1;
  chunkCount: number;
  peakDbfs: number;
  clipped: boolean;
  /** Bu denemeye özel efekt ayarı (isteğe bağlı); yoksa projenin `fx` değeri geçerlidir. */
  fx?: FxSettings;
};

/** Yalnızca proje bilgisi; ses ve ham müzik içermez. */
export type ProjectBackup = {
  format: "siir-studyosu-project";
  /** 1: efekt alanı yok · 2: isteğe bağlı `fx` (ses/müzik yine yok) */
  version: 1 | 2;
  exportedAt: string;
  project: { title: string; text: string; trackId: string | null; createdAt: string; fx?: FxSettings; mix?: MixSettings };
};

// ---------- Aşama 4: dışa aktarma (sunucu tarafı miks) ----------
export type ExportFormat = "wav" | "mp3";

/**
 * Miks tarifi. Istemci YALNIZCA bunu ve işlenmiş şiir sesini gönderir; müzik dosyası asla gönderilmez/alınmaz.
 * Sunucu her alanı doğrular ve güvenli aralığa sıkıştırır.
 */
export type ExportRecipe = {
  format: ExportFormat;
  /** null: müziksiz (yalnızca ses normalleştirilip kodlanır). */
  trackId: string | null;
  title: string; poet: string; reader: string;
  music: { gainDb: number; startOffsetSec: number; tailSec: number; fadeInSec: number; fadeOutSec: number };
  ducking: { enabled: boolean; amountDb: number; attackMs: number; releaseMs: number };
  /** > 0: ses müzikten geç başlar; < 0: müzik geç başlar. */
  alignmentOffsetMs: number;
  loudness: { targetLufs: number; truePeakDb: number };
  /** true: çıktı, video hazırlamak için indirildikten sonra da (en çok 30 dk) sunucuda tutulur. */
  forVideo?: boolean;
};

export type ExportJobState = "awaiting-upload" | "waiting" | "preparing" | "completed" | "failed";

export type ExportCreated = {
  jobId: string; uploadToken: string; uploadUrl: string; maxUploadBytes: number;
  remainingToday: number; expiresInSec: number;
};
export type ExportStatus = {
  jobId: string; state: ExportJobState; errorCode?: string; message?: string;
  /** Yalnızca tamamlandığında; kısa ömürlü imzalı adres. */
  downloadUrl?: string; expiresInSec?: number;
  /** Yalnızca `forVideo` işlerde, tamamlanınca: imzalı, kısa ömürlü ses başvurusu ve sunucunun yazdığı müzik bilgisi. */
  audioRef?: string; audioInfo?: ExportAudioInfo;
};
export type ApiError = { error: string; code?: string; retryAfterSec?: number };

// ---------- Aşama 6: video (bağımsız modül; ses modülü bu tipler dışında video koduna bağımlı değildir) ----------
export type LineTiming = { lineId: string; startMs: number; endMs: number };
export type CaptionCue = { startMs: number; endMs: number; text: string; lineIds: string[] };

/** Sunucunun (API) yazdığı, istemcinin değiştiremeyeceği müzik/lisans bilgisi. Kanıt dosyası yolu İÇERMEZ. */
export type ExportMusicInfo = {
  trackId: string | null; title?: string; artist?: string;
  attributionRequired: boolean; attributionText?: string;
  license: { type: string; allowsSocialMediaUse: boolean; allowsCommercialUse: boolean; evidenceRef?: string };
};
export type ExportAudioInfo = {
  format: ExportFormat; durationMs: number; music: ExportMusicInfo;
};

export type VideoOrientation = "portrait" | "landscape" | "square"; // 9:16, 16:9, 1:1
export type VideoTarget = "tiktok" | "reels" | "youtube";
export type VideoPalette = "dusk" | "dawn" | "night" | "forest" | "ember";

/**
 * Ses modülünün video modülüne verdiği DONMUŞ sözleşme (bundleVersion 1).
 * Video modülü yalnızca bunu tüketir; ses modülünün iç yapısını bilmez.
 */
export type ExportBundle = {
  bundleVersion: 1;
  projectId: string;
  ownerId: string | null;
  audio: { masterAudioRef: string; format: ExportFormat; durationMs: number };
  poem: { title: string; text: string };
  /** Mikslenmiş ses zaman ekseninde satır zamanları (ses gecikmesi dahil). */
  timings: LineTiming[];
  captions: CaptionCue[];
  music: ExportMusicInfo;
  credits: { poet: string; reader: string };
  /** Seçilen atmosfer ve ses ayarları (bilgi amaçlı; video bunları yeniden uygulamaz). */
  studio: { atmosphere: AtmosphereId; fx?: FxSettings };
  video: { orientation: VideoOrientation; targets: VideoTarget[] };
};

export type VideoSpec = {
  orientation: VideoOrientation; target: VideoTarget;
  palette: VideoPalette; captions: boolean; showTitle: boolean;
};

export type VideoJobState = "waiting" | "preparing" | "completed" | "failed";
export type VideoCreated = { jobId: string; remainingToday: number };
export type VideoStatus = {
  jobId: string; state: VideoJobState; progress?: number;
  errorCode?: string; message?: string; downloadUrl?: string; expiresInSec?: number;
  width?: number; height?: number; durationMs?: number;
  /** Engellemeyen uyarılar (ör. platform süre sınırı, yön uyuşmazlığı). */
  warnings?: string[];
};
