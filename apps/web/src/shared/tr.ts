// Tüm kullanıcı metinleri burada; ileride başka dil eklemek için tek yer.
export const tr = {
  brand: "Şiir Stüdyosu",
  tagline: "Şiirini stüdyo sıcaklığında oku, kaydet, paylaş.",
  privacy:
    "Kayıtların cihazında kalır. Sunucuya yalnızca sen “Dışa aktar” dediğinde, miks için geçici olarak gönderilir ve işlem sonrası silinir.",
  steps: ["Şiir", "Fon", "Kayıt", "Dinle"],
  micExplain: "Mikrofon yalnızca kayıt sırasında açılır. Sesin sunucuya gönderilmez.",
  errors: {
    NotAllowedError: "Mikrofon izni verilmedi. Adres çubuğundaki kilit simgesinden izni açıp tekrar dene.",
    NotFoundError: "Mikrofon bulunamadı. Bir mikrofon bağlayıp tekrar dene.",
    NotReadableError: "Mikrofon başka bir uygulama tarafından kullanılıyor olabilir.",
    unsupported: "Bu tarayıcı yüksek kaliteli kayıt için gerekli özellikleri desteklemiyor. Güncel Chrome, Edge veya Safari dene.",
    generic: "Mikrofon açılamadı. Tekrar dene.",
    deviceLost: "Mikrofon bağlantısı kesildi. O ana kadarki kaydın korundu.",
    storage: "Depolama alanı doldu veya yazılamadı; o ana kadarki kaydın korundu. Eski denemeleri silip yeniden dene.",
    noSpace: "Cihazda yeterli depolama alanı yok. Eski çalışma veya denemeleri silip tekrar dene.",
    lowSpace: "Depolama alanın az: uzun bir kayıt yarıda kesilebilir. Eski denemeleri silmeyi düşün.",
    background: "Sayfa arka plana alındı. Arka planda geçen süre kayda girmez; kaydı dinleyip kontrol et. En iyisi ekranı açık tutmak.",
    interrupted: "Ses girişi kesintiye uğradı (arama, kilit ekranı veya başka uygulama). Kayıt duraklamış olabilir; “Devam ettir” ile sürdür.",
    offline: "İnternet bağlantısı yok. Sunucu miksi için bağlanıp tekrar dene (müziksiz WAV bağlantı olmadan da çalışır).",
    limit: "15 dakikalık kayıt sınırına ulaşıldı; kaydın korundu.",
  } as Record<string, string>,
};
