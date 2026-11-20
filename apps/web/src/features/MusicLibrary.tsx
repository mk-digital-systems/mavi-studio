import { useEffect, useMemo, useRef, useState } from "react";
import type { TrackPublic } from "@siir/contracts";
import { PreviewPlayer } from "../audio/preview";
import { Icon } from "../shell/icons";
import type { Actions } from "../shell/types";
import { updateSettings, useSettings } from "../shared/settings";
import { EmptyState, PageHeader } from "./parts";
import { AddMusicButton, fmtDur, fmtSize, useLocalTracks } from "./LocalMusic";
import { deleteLocalTrack } from "../storage/music";

/**
 * Fon Müziklerim: platform yöneticisinin lisansladığı kataloğu dinlet, favorile, yeni çalışmada kullan.
 * Kendi müziğini yükleyebilirsin (yalnızca bu cihazda saklanır, sunucuya gitmez); katalog parçaları indirilemez.
 */
export function MusicLibrary({ actions }: { actions: Actions }) {
  const settings = useSettings();
  const fav = settings.music.favorites;
  const [tracks, setTracks] = useState<TrackPublic[] | null>(null);
  const [error, setError] = useState("");
  const [mood, setMood] = useState("");
  const [onlyFav, setOnlyFav] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const mine = useLocalTracks();
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
      <PageHeader title="Fon Müziklerim" sub="Müziklerini yükle, dinle ve çalışmanda kullan" actions={<AddMusicButton primary onAdded={() => void mine.reload()} onError={setError} />} />
      <div className="note" role="note">🎵 Yüklediğin müzikler yalnızca bu cihazda saklanır, sunucuya gönderilmez. Yalnızca hakkına sahip olduğun veya kullanım izni olan müzikleri yükle.</div>
      {error && <div className="alert" role="alert">{error}</div>}

      <section aria-labelledby="mine-h" className="sec">
        <h2 id="mine-h">Yüklediklerim</h2>
        {mine.tracks && mine.tracks.length === 0 && <EmptyState icon="music" title="Henüz müzik yüklemedin" action={<AddMusicButton primary onAdded={() => void mine.reload()} onError={setError} />}>MP3, WAV, M4A veya OGG yükleyebilirsin.</EmptyState>}
        <div className="mgrid">
          {(mine.tracks ?? []).map((t) => (
            <article key={t.id} className="mcard">
              <div className="mcard-b">
                <h3>{t.title}</h3>
                <p className="muted small">{fmtDur(t.durationSec)} · {fmtSize(t.size)}</p>
                <div className="row" style={{ marginTop: 8 }}>
                  <button className="btn" aria-label={`${playing === t.id ? "Durdur" : "Dinle"}: ${t.title}`} onClick={() => void toggle(t.id)}><Icon name={playing === t.id ? "stop" : "play"} size={16} /> {playing === t.id ? "Durdur" : "Dinle"}</button>
                  <button className="btn primary" onClick={() => { player.current.stop(); actions.create({ trackId: t.id }); }}>Bu müzikle başla</button>
                  <button className="btn ghost" aria-label={`Sil: ${t.title}`} onClick={async () => {
                    if (!confirm(`“${t.title}” fon müziklerinden silinsin mi?`)) return;
                    if (playing === t.id) { player.current.stop(); setPlaying(null); }
                    await deleteLocalTrack(t.id); await mine.reload();
                  }}><Icon name="trash" size={18} /></button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <h2>Hazır katalog</h2>
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
