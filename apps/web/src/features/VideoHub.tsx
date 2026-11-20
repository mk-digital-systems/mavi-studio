import { useState } from "react";
import { Icon } from "../shell/icons";
import type { Actions } from "../shell/types";
import type { LocalData } from "../shared/useLocalData";
import { EmptyState, PageHeader, ProjectCard } from "./parts";
import { VideoStudio } from "./VideoStudio";

/** Video Editörü: şiirli ses çalışmalarından video üretimine giriş. Yalnızca gerçekten var olan özellikleri sunar. */
export function VideoHub({ data, actions }: { data: LocalData; actions: Actions }) {
  const [mode, setMode] = useState<"studio" | "quick">("studio");
  const ready = (data.projects ?? []).filter((p) => (data.takes[p.id] ?? []).length > 0);
  const tabs = (
    <div className="vs-tabs" role="group" aria-label="Video yöntemi">
      <button className="btn" aria-pressed={mode === "studio"} onClick={() => setMode("studio")}>Video atölyesi</button>
      <button className="btn" aria-pressed={mode === "quick"} onClick={() => setMode("quick")}>Şiirden hızlı video</button>
    </div>
  );
  if (mode === "studio") return (
    <>
      <PageHeader title="Video Editörü" sub="Fotoğraf ve videolarla düzenle, istersen şiir sesini ekle" />
      {tabs}
      <VideoStudio data={data} />
    </>
  );
  return (
    <>
      <PageHeader title="Video Editörü" sub="Şiirinden paylaşılabilir video oluştur" actions={<button className="btn primary" onClick={() => actions.create({ video: true })}><Icon name="plus" size={18} /> Yeni video</button>} />
      {tabs}

      <ol className="how">
        <li><b>Oku ve kaydet</b><span>Ses Stüdyosu’nda şiirini fon müziğiyle oku.</span></li>
        <li><b>Dışa aktar</b><span>“Bu kayıttan video da hazırla” kutusunu işaretleyip sesi hazırla.</span></li>
        <li><b>Videoyu oluştur</b><span>Platformu, biçimi ve arka planı seç; altyazı şiirden otomatik zamanlanır.</span></li>
      </ol>

      <section className="sec" aria-labelledby="vh-h">
        <h2 id="vh-h">Videoya hazır çalışmaların</h2>
        {data.projects === null ? <p className="muted">Yükleniyor…</p> : ready.length === 0 ? (
          <EmptyState icon="film" title="Henüz kaydı olan çalışma yok" action={<button className="btn primary" onClick={() => actions.create({ video: true })}>Yeni video başlat</button>}>
            Video, kaydedilmiş bir şiir okumasından üretilir. Önce Ses Stüdyosu’nda bir deneme kaydet.
          </EmptyState>
        ) : (
          <div className="pgrid">
            {ready.map((p) => <ProjectCard key={p.id} p={p} takes={data.takes[p.id]} actions={<button className="btn primary" onClick={() => actions.open(p, "review", { video: true })}>Video hazırla</button>} />)}
          </div>
        )}
      </section>

      <section className="sec card" aria-labelledby="vc-h">
        <h2 id="vc-h">Şu an neler var, neler yok</h2>
        <div className="two">
          <div>
            <h3>Var</h3>
            <ul className="ticks">
              <li>9:16 (dikey), 16:9 (yatay), 1:1 (kare) MP4</li>
              <li>TikTok, Instagram Reels, YouTube ön ayarları</li>
              <li>Şiire göre otomatik zamanlanan altyazı (genel kaydırmayla düzeltilebilir)</li>
              <li>5 yerleşik arka plan, başlık ve künye</li>
              <li>Fon müziği atfı ve lisans denetimi</li>
            </ul>
          </div>
          <div>
            <h3>Henüz yok</h3>
            <ul className="dashes">
              <li>Görsel veya video sahnesi ekleme</li>
              <li>Zaman çizelgesi, geçiş ve satır satır elle altyazı düzenleme</li>
              <li>4K, FPS ve kalite seçimi (motor 1080p · 30 fps üretir)</li>
              <li>Kalıcı video arşivi</li>
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}
