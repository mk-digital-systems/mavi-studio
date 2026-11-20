import { Icon } from "../shell/icons";
import type { Actions } from "../shell/types";
import { EmptyState, PageHeader } from "./parts";

/** Video Arşivim: kalıcı depolama kurulana kadar dürüst bir durum sayfası (sahte liste yok). */
export function VideoArchive({ actions }: { actions: Actions }) {
  return (
    <>
      <PageHeader title="Video Arşivim" sub="Geçmiş videolar, taslaklar ve tamamlanan projeler" />
      <EmptyState icon="archive" title="Kalıcı video arşivi henüz yok" action={<button className="btn primary" onClick={() => actions.create({ video: true })}><Icon name="plus" size={18} /> Yeni video</button>}>
        Videolar şu anda hazırlandıktan sonra sunucuda en fazla 30 dakika tutulur ve indirildiğinde silinir. Dosyayı indirip cihazında saklaman gerekir.
      </EmptyState>
      <section className="card sec" aria-labelledby="ar-h">
        <h2 id="ar-h">Arşiv neden hemen yok?</h2>
        <p className="muted">Gerçek bir arşiv, tarayıcı verisi silinse bile kaybolmayan güvenilir bir depolama gerektirir (yerel dosya düzeni veya sunucu depolaması), ayrıca yedekleme ve geri yükleme. Bu düzen kurulmadan “arşiv” görünümü vermek, kullanıcıyı yanlış güvene sokardı.</p>
        <p className="muted">Planlanan: proje başına videolar, taslaklar ve tamamlanan işler; indirme, yeniden oluşturma ve silme; yedekten geri yükleme.</p>
      </section>
    </>
  );
}
