// Kapanmadan önce uyarı gerektiren durumlar (kayıt sürüyor / yazım bekliyor / dışa aktarma sürüyor).
// Kullanıcı tercihleri artık shared/settings.ts içindedir.
export const guard = { recording: false, pendingSave: false, exporting: false };
