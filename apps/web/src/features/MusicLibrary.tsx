import type { Actions } from "../shell/types";
import { PageHeader } from "./parts";
import { MusicBrowser } from "./MusicBrowser";

/**
 * Fon Müziklerim (Ses Stüdyosu'nun alt bölümü): yüklediğin müzikleri ve hazır kataloğu yönet, dinle, çalışmada kullan.
 * Fon müzikleri yalnızca bu cihazda saklanır; ham dosya indirilemez.
 */
export function MusicLibrary({ actions }: { actions: Actions }) {
  return (
    <>
      <PageHeader title="Fon Müziklerim" sub="Ses Stüdyosu · müziklerini yükle, dinle ve kayıtta kullan" />
      <div className="note" role="note">🎵 Yüklediğin müzikler yalnızca bu cihazda saklanır, sunucuya gönderilmez ve ham olarak indirilemez. Yalnızca hakkına sahip olduğun veya kullanım izni olan müzikleri yükle.</div>
      <MusicBrowser mode="library" onStart={(id) => actions.create({ trackId: id })} />
    </>
  );
}
