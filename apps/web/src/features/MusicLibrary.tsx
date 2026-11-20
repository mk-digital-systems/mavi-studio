import { useEffect, useMemo, useRef, useState } from "react";
import type { TrackPublic } from "@siir/contracts";
import { PreviewPlayer } from "../audio/preview";
import { Icon } from "../shell/icons";
import type { Actions } from "../shell/types";
import { updateSettings, useSettings } from "../shared/settings";
import { EmptyState, PageHeader } from "./parts";

/**
 * Fon Müziklerim: platform yöneticisinin lisansladığı kataloğu dinlet, favorile, yeni çalışmada kullan.
 * Müzik yükleme/indirme YOKTUR (bilinçli kural): ön izleme düşük kaliteli ve korumalıdır.
 */
export function MusicLibrary({ actions }: { actions: Actions }) {
  const settings = useSettings();
  const fav = settings.music.favorites;
  const [tracks, setTracks] = useState<TrackPublic[] | null>(null);
  const [error, setError] = useState("");
  const [mood, setMood] = useState("");
  const [onlyFav, setOnlyFav] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const player = useRef<PreviewPlayer>(null as unknown as PreviewPlayer);
  if (!player.current) player.current = new PreviewPlayer();

  useEffect(() => {
    fetch("/api/catalog").then((r) => r.json()).then(setTracks).catch(() => setError("Fon müzikleri yüklenemedi. Bağlantını kontrol edip tekrar dene."));
    const p = player.current;
    return () => p.stop();
  }, []);

  const moods = useMemo(() => [...new Set((tracks ?? []).flatMap((t) => t.mood))].sort(), [tracks]);
  const shown = (tracks ?? []).filter((t) => (!mood || t.mood.includes(mood)) && (!onlyFav || fav.includes(t.id)))
    .sort((a, b) => Number(fav.includes(b.id)) - Number(fav.includes(a.id)));

  const toggleFav = (id: string) => updateSettings((s) => ({ ...s, music: { ...s.music, favorites: s.music.favorites.includes(id) ? s.music.favorites.filter((x) => x !== id) : [...s.music.favorites, id] } }));
  const toggle = async (id: string) => {
    if (playing === id) { player.current.stop(); setPlaying(null); return; }
    try { await player.current.play(id); setPlaying(id); } catch { setError("Ön izleme çalınamadı."); }
  };

  return (
    <>
      <PageHeader title="Fon Müziklerim" sub="Dinle, favorile ve yeni çalışmanda kullan" />
      <div className="note" role="note">🎵 Fon müzikleri yalnızca platform yöneticisi tarafından, lisansları doğrulanarak eklenir. Kendi müziğini yükleyemezsin ve ham dosyalar indirilemez; ön izleme düşük kalitelidir, nihai kayıtta tam kalite kullanılır.</div>
      {error && <div className="alert" role="alert">{error}</div>}

      <div className="filters" role="group" aria-label="Filtrele">
        <button className="btn" aria-pressed={!mood && !onlyFav} onClick={() => { setMood(""); setOnlyFav(false); }}>Hepsi</button>
        <button className="btn" aria-pressed={onlyFav} onClick={() => setOnlyFav(!onlyFav)}>★ Favoriler ({fav.length})</button>
        {moods.map((m) => <button key={m} className="btn" aria-pressed={mood === m} onClick={() => setMood(mood === m ? "" : m)}>{m}</button>)}
      </div>

      {!tracks && !error && <p className="muted">Yükleniyor…</p>}
      {tracks && shown.length === 0 && <EmptyState icon="music" title={onlyFav ? "Henüz favori yok" : "Bu filtreyle parça yok"}>{onlyFav ? "Bir parçanın yıldızına dokunarak favorilerine ekle." : "Başka bir duygu dene."}</EmptyState>}
      <div className="mgrid">
        {shown.map((t) => {
          const isFav = fav.includes(t.id);
          return (
            <article key={t.id} className="mcard">
              <img src={t.cover} alt="" width={72} height={72} />
              <div className="mcard-b">
                <h2 className="h3">{t.title}</h2>
                <p className="muted small">{t.genre} · {t.tempoBpm} BPM</p>
                <div className="chips">{t.mood.map((m) => <span key={m} className="chip">{m}</span>)}</div>
                {t.attributionRequired && <p className="small muted">Atıf: {t.attributionText}</p>}
                <div className="row" style={{ marginTop: 8 }}>
                  <button className="btn" aria-label={`${playing === t.id ? "Durdur" : "Ön izle"}: ${t.title}`} onClick={() => void toggle(t.id)}><Icon name={playing === t.id ? "stop" : "play"} size={16} /> {playing === t.id ? "Durdur" : "Ön izle"}</button>
                  <button className="btn ghost" aria-pressed={isFav} aria-label={`Favori: ${t.title}`} onClick={() => toggleFav(t.id)}><Icon name="star" size={18} /> Favori</button>
                  <button className="btn primary" onClick={() => { player.current.stop(); actions.create({ trackId: t.id }); }}>Bu müzikle başla</button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
