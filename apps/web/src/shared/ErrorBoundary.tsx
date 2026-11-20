import { Component, type ReactNode } from "react";

/**
 * Beklenmeyen bir arayüz hatasında beyaz ekran yerine açıklama gösterir.
 * Çalışmalar ve kayıtlar IndexedDB'de olduğu için hata onları etkilemez. Hata içeriği (şiir metni vb.) hiçbir yere gönderilmez.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) {
    // Yalnızca konsola: içerik içermeyen, sunucuya gönderilmeyen tanı.
    console.error("Arayüz hatası:", error instanceof Error ? error.name : "bilinmiyor");
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <section className="card" role="alert">
        <h2>Bir şeyler ters gitti</h2>
        <p className="muted">Ekran beklenmedik bir hata verdi. Çalışmaların ve kayıtların bu cihazda güvende; sayfayı yenileyince kaldığın yerden devam edebilirsin.</p>
        <div className="row">
          <button className="btn primary" onClick={() => location.reload()}>Sayfayı yenile</button>
          <button className="btn ghost" onClick={() => this.setState({ failed: false })}>Tekrar dene</button>
        </div>
      </section>
    );
  }
}
