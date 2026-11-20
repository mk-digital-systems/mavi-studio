# vendor

Bu klasördeki kod projeye yerel olarak eklenmiştir. Uygulama çalışırken internetten hiçbir kod indirilmez.

## Mediabunny (MP4 yazımı)

| | |
|---|---|
| Dosya | `mediabunny-mp4.min.js` (123 023 bayt) |
| Kaynak | https://github.com/Vanilagy/mediabunny · npm paketi `mediabunny` |
| Sürüm | 1.65.2 |
| Lisans | Mozilla Public License 2.0 — tam metin `mediabunny-LICENSE.txt` |
| SHA-256 | `232ee69d7d21079b4988c2f642ef2e77e70918f5bade5ff44a60ee785b35bd57` |
| Kullanım | `window.Mediabunny` — yalnızca `exporter.js` kullanır |

Kaynak kod değiştirilmedi. Paket yalnızca modül biçiminde dağıtıldığı ve `index.html` doğrudan açıldığında modül betikleri yüklenmediği için, MP4 yazımında kullanılan altı sınıf tek bir klasik betikte toplandı. Girdi dosyası `mediabunny-entry.js`.

Yeniden derlemek için (yalnızca geliştirme sırasında, boş bir klasörde):

```
npm install mediabunny@1.65.2 esbuild@0.25.10
npx esbuild mediabunny-entry.js --bundle --format=iife --global-name=Mediabunny --minify --target=es2022 --legal-comments=none --outfile=mediabunny-mp4.min.js
```

Derlemenin başına sürüm ve lisans bilgisini taşıyan tek satırlık bir açıklama eklenir.
