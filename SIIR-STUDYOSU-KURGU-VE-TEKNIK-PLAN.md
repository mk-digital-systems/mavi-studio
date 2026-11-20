# Şiir Stüdyosu — Ürün Kurgusu ve Teknik Plan

> Durum: **v2 — kararlar onaylandı (bölüm 16).** Bu belge yalnızca plandır; henüz uygulama kodu, paket kurulumu, commit veya push yoktur.
> Tarih: 2026-11-20
> İlerleme:
> - **Aşama 0–2:** Kod yazıldı. **Gerçek cihaz testleri ertelendi** (mikrofon, kulaklık/Bluetooth gecikmesi, Safari/iOS, uzun kayıt, çökme-kurtarma, Aşama 0 ffmpeg miksi). Bu aşamalar **tamamlandı sayılmaz**; kabul kriterleri cihaz testleri yapılınca işaretlenecek. Otomatik doğrulanan tek kısım: depolama katmanı başsız Edge'de 16/16.
> - **Aşama 3:** Geliştirme başladı (bkz. "Aşama 3 ilerleme notu", bölüm 10).
> Hedef adres (ileride): `siir.mustafaoner.net` (bağımsız dağıtım)

## 0. Kapsam ve çıkış noktası

- Şiir Stüdyosu **sıfırdan ve bağımsız** bir projedir. MustafaÖner.net kod tabanının parçası değildir; o siteye hiçbir değişiklik yapılmaz. Bu klasörde (`Desktop/siir`) başka hiçbir mevcut kod, `.env` veya yapılandırma yoktur; inceleme sırasında klasörün **boş** olduğu doğrulandı. Bu nedenle “mevcut teknoloji yapısı” yoktur ve tüm teknoloji önerileri **öneridir, doğrulanması gerekir** (bkz. 11.2).
- Ana siteyle tek bağ, ileride DNS üzerinde `siir` alt alan adının bağımsız dağıtıma yönlendirilmesidir. Ana sitedeki yasal sayfalar, yasal URL'ler ve yönlendirmeler bu projenin konusu değildir ve değiştirilmez. Şiir Stüdyosu kendi yasal sayfalarını (gizlilik/KVKK aydınlatma, kullanım şartları, çerez/yerel depolama bilgisi) **kendi alan adı altında** barındırır; ana sitedekilere yalnızca bağlantı verebilir.
- **Platform** niteliği: yalnızca proje sahibi için değil, ileride herkese açılacak. Bu yüzden lisans, gizlilik, kötüye kullanım ve ölçekleme kararları “kişisel araç” varsayımıyla verilmez.
- İlk sürüm: **ses kaydı + ses işleme + miks + WAV/MP3 dışa aktarma**. Video yok; yalnızca video için veri modeli, modül sınırı ve entegrasyon noktası tanımlanır (bölüm 15).

### Değiştirilemez kurallar (özet)

1. İlk sürümde üyelik/giriş yok; **anonim oturum** vardır.
2. Kullanıcı müzik yükleyemez. Müzik yükleme düğmesi, gizli API veya form yoktur.
3. Fon müziği yalnızca yönetici tarafından, geliştirme sürecinde kataloğa eklenir; her parçanın lisans kaydı zorunludur.
4. Ham fon müziği indirilemez; herkese açık dosya yolu yoktur; ayrı dışa aktarma yoktur.
5. Yalnızca şiir sesiyle birleşmiş nihai çıktı indirilebilir.
6. Ses kayıtları varsayılan olarak cihazda kalır; sunucuya yalnızca kullanıcı açıkça “dışa aktar” dediğinde gider ve işlem bitince silinir.
7. Kalıcı kişisel kayıt tutulmaz.
8. Ticari sanatçı parçası, YouTube indirmesi, lisansı belirsiz dosya sisteme girmez.

---

## 1. Ürün özeti

**Ne?** Tarayıcıda çalışan, şiir okumaya odaklı bir ses kayıt stüdyosu: şiir metni → fon müziği seçimi → mikrofonla okuma → ortam/miks ayarı → WAV/MP3 indirme.

**Kim kullanır?** Şiir yazan/okuyan, teknik ses bilgisi olmayan kişiler; sosyal medya için şiir seslendirmesi yapmak isteyenler. Proje sahibi Mustafa Öner ilk kullanıcıdır, fakat ürün genel kullanıcıya göre tasarlanır.

**Çözdüğü problem:** Şiir okuyan biri için telefon kaydı çoğu zaman gürültülü, dengesiz ve müziksiz kalır; DAW (ses yazılımı) öğrenmek ise ağırdır. Şiir Stüdyosu tek ekranda, teknik terim olmadan “stüdyo kalitesine yakın” sonuç verir.

**İlk sürümün sınırları**

| Var | Yok |
|---|---|
| Anonim kullanım, yerel çalışma saklama | Üyelik, giriş, bulut saklama |
| Yönetici kataloğundan fon müziği | Müzik yükleme, kullanıcı müziği |
| Kayıt, denemeler, ortam seçenekleri, miks | Çok kanallı/çoklu iz düzenleme |
| WAV + MP3 + JSON yedek | MP4/video üretimi |
| Sunucuda geçici miks (yalnızca dışa aktarmada) | Kalıcı sunucu depolama |

---

## 2. Kullanım senaryosu (adım adım)

1. **Stüdyoyu açma:** Açılış ekranında kısa bilgilendirme: “Kayıtların cihazında kalır; yalnızca ‘Dışa aktar’ dediğinde geçici olarak sunucuya gider ve işlem sonrası silinir.” Tarayıcı uyumluluk denetimi sessizce yapılır; desteklenmiyorsa açık mesaj verilir.
2. **Yeni şiir çalışması:** “Yeni Çalışma” ile boş çalışma oluşur (yerel kimlik, `ownerId = null`). Önceki çalışmalar “Yerel Çalışmalarım”da listelenir.
3. **Başlık ve metin:** Başlık alanı + çok satırlı metin editörü (yapıştırma desteklenir). Boş satırlar **kıta** ayracı sayılır; satırlar zamanlama için kullanılır.
4. **Fon müziği seçimi:** Katalog kartlarından seçim (kapak, ad, tür, duygu, tempo, kısa ön izleme). “Müziksiz” seçeneği vardır. Ön izleme yalnızca düşük kaliteli, korumalı akıştır (bölüm 4.4).
5. **Mikrofon seçimi:** Cihaz listesi; izin verilmeden önce cihaz adları görünmeyebilir (tarayıcı kısıtı), izin sonrası liste yenilenir.
6. **Mikrofon izni:** Önce uygulama içi açıklama ekranı (“Mikrofon yalnızca kayıt sırasında açılır; kaydın sunucuya gönderilmez”), ardından tarayıcı izin penceresi.
7. **Ses seviyesi kontrolü:** Canlı seviye göstergesi; “Normal sesinle birkaç cümle oku” rehberi. Çok düşük/çok yüksek/clipping uyarıları. Kulaklık önerisi (fon müziği mikrofona karışmasın).
8. **Geri sayım:** 3-2-1 (ayarlanabilir 0/3/5 sn). Geri sayım sırasında fon müziği başlangıç noktasından çalmaya hazırlanır.
9. **Metni ekrandan takip:** Okuma ekranı, metni büyük puntoyla gösterir; otomatik kaydırma kullanıcı hızına göre ayarlanır (hız kaydırıcısı, “elle kaydır” modu).
10. **Kayıt kontrolü:** Başlat / Duraklat / Devam / Bitir. Duraklatmada mikrofon akışı kapanmaz ama kayıt yazımı durur; uzun duraklamada akış kapatılır (bölüm 5.4). Bitirince deneme otomatik kaydedilir.
11. **Dinleme:** Kayıt, seçilen müzikle (düşük kaliteli ön izleme) birlikte veya yalnız ses olarak çalınır.
12. **Yeni deneme:** “Yeni deneme al”; eski denemeler silinmez, listede kalır; biri “ana deneme” seçilir.
13. **Denge ayarı:** Ses seviyesi, müzik seviyesi, müziği otomatik kısma, başlangıç/bitiş yumuşatma, müzik başlangıç/kesme noktası, zamanlama kaydırma.
14. **Efekt/ortam seçimi:** Hazır atmosfer (bölüm 6) + tek “Ortam miktarı” kaydırıcısı.
15. **Ön izleme:** Tam miks ön izlemesi (tarayıcıda, düşük kaliteli müzikle). Ön izleme “yaklaşık” sonucu verir; nihai kalite dışa aktarmada oluşur ve bu açıkça belirtilir.
16. **Dışa aktarma:** Biçim (WAV/MP3), isteğe bağlı JSON yedek. “Dışa aktar” onay metni: “Ses kaydın, miks için geçici olarak sunucuya gönderilecek ve işlem bitince silinecek.” İşlem durumu → hazır olunca kısa ömürlü indirme bağlantısı.

---

## 3. Ekran ve bileşen planı

| Ekran/Bileşen | Görev |
|---|---|
| **Ana ekran** | Kısa tanıtım, “Yeni çalışma”, “Yerel çalışmalarım”, gizlilik özeti, uyumluluk durumu |
| **Yeni çalışma ekranı** | Adım yönlendirmeli kurulum: metin → müzik → mikrofon → kayıt |
| **Şiir metni editörü** | Başlık, metin, kıta/satır algılama, karakter/satır sayısı, yapıştırmada temizleme; otomatik yerel kayıt |
| **Fon müziği seçim alanı** | Filtre (tür/duygu/tempo), kartlar, düşük kaliteli ön izleme, atıf/lisans bilgisi, “müziksiz” |
| **Kayıt ekranı** | Büyük kayıt kontrolleri, durum rozetleri (hazır/kayıtta/duraklatıldı), kulaklık uyarısı |
| **Mikrofon seviye göstergesi** | Gerçek zamanlı RMS/tepe ölçer (AudioWorklet veya AnalyserNode), clipping işareti |
| **Kayıt süresi ve geri sayım** | Süre sayacı, geri sayım katmanı, tahmini süre ve bellek uyarısı |
| **Okuma ekranı (otomatik kaydırma)** | Büyük tipografi, satır vurgusu, hız kontrolü, koyu/açık tema, tam ekran |
| **Kayıt denemeleri listesi** | Deneme adı, süre, tarih, ana deneme işareti, dinle/yeniden adlandır/sil |
| **Ses düzenleme ve miks ekranı** | Dalga formu, ses/müzik dengesi, ducking, fade, kesme noktaları, atmosfer seçimi, ön izleme |
| **Dışa aktarma ekranı** | Biçim seçimi, dosya adı önizlemesi, işlem durumu, indirme, JSON yedek, gizlilik hatırlatması |
| **Yerel çalışmalar alanı** | Liste, arama, depolama kullanımı, silme, içe/dışa JSON yedek |
| **Hata ve izin bilgilendirmeleri** | Tek tip bileşen: neden oldu + ne yapmalı + yeniden dene (bölüm 13 senaryolarıyla eşleşir) |

Tasarım ilkeleri: mobil öncelikli (390 px), tek ana eylem/ekran, teknik terim yok, tam klavye erişimi, `aria-live` ile durum duyuruları, yeterli kontrast, hareket azaltma tercihine saygı.

---

## 4. Fon müziği sistemi

### 4.1 Katalog veri yapısı

Katalog **yönetici tarafından repo/özel depo içinde** tutulur. Kullanıcıya yalnızca “herkese açık alt küme” (public view) verilir; lisans kanıtları ve ham dosya yolları sunucu tarafında kalır.

```jsonc
{
  "id": "trk_0001",
  "title": "Sessiz Gece",
  "artist": "Platform Orijinal",
  "filePath": "private://music/master/trk_0001.flac",     // yalnızca sunucu
  "previewPath": "private://music/preview/trk_0001.m4a",  // düşük kalite, korumalı
  "cover": "public/covers/trk_0001.webp",
  "durationSec": 184,
  "genre": "ambient",
  "mood": ["hüzünlü", "sakin"],
  "tempoBpm": 62,
  "license": {
    "type": "owned | commissioned | licensed-saas | cc0 | cc-by",
    "source": "Özel üretim / Lisans veren adı",
    "sourcePage": "https://…",
    "acquiredAt": "2026-12-01",
    "attributionRequired": false,
    "attributionText": "",
    "contentIdRegistered": false,
    "contentIdNote": "",
    "allowsCommercialUse": true,
    "allowsSocialMediaUse": true,
    "allowsSaaSRedistribution": true,       // platformda yeniden sunum izni
    "allowsUserGeneratedOutput": true,       // kullanıcı üretimli çıktı izni
    "evidencePath": "private://licenses/trk_0001/proof.pdf",
    "evidenceVerifiedBy": "…",
    "evidenceVerifiedAt": "2026-12-01"
  },
  "active": true
}
```

### 4.2 Lisans kuralları (platform için)

- Parça **ancak** şu koşullarda `active: true` olabilir: `allowsCommercialUse`, `allowsSocialMediaUse`, `allowsSaaSRedistribution`, `allowsUserGeneratedOutput` hepsi `true`, kanıt dosyası mevcut ve doğrulanmış. Bu **şema doğrulamasıyla ve derleme/dağıtım kontrolüyle zorunlu kılınır** (eksik/yanlış kayıt yayını durdurur).
- **Pixabay, Mixkit vb. kaynaklardan indirilen parçalar platform kütüphanesi olarak varsayılmaz.** Bu kaynakların lisansları genellikle “içeriği tek başına yeniden dağıtma/kütüphane olarak sunma” kullanımını kısıtlar; kullanıcıya ayrı bir müzik kütüphanesi olarak sunmak o kısıtın kapsamına girebilir. Böyle bir kaynak ancak lisans metni ve gerekirse yazılı destek yanıtıyla platform kullanımını **açıkça** kapsadığı doğrulanırsa kullanılır.
- **Öncelik sırası:** (1) Platform sahibine ait/özel üretilmiş müzik, (2) yazılı sözleşmeyle platform kullanımını kapsayan lisanslı müzik, (3) CC0 (yine kayıt altına alınır), (4) CC-BY (atıf zorunluluğu çıktıda ve arayüzde karşılanabiliyorsa).
- Content ID: parçalar mümkünse Content ID'ye **kayıtlı olmayan** veya kayıtlı ise platform çıktıları için muafiyet yazılı olan parçalar olmalıdır; değilse “riskli” etiketlenir ve varsayılan olarak yayınlanmaz.
- Lisans değişir/geri çekilirse parça `active: false` yapılır; mevcut yerel çalışmalar bozulmaz ama dışa aktarma sırasında “bu parça artık kullanılamıyor” uyarısı verilir.
- Ekleme işlemi **arayüzden değil**, geliştirici komut/betiği ve kod incelemesiyle yapılır. (Bu belge kod yazmaz; betik 11'de yalnızca tarif edilir.)
- Hukuki not: lisans metinlerinin SaaS/UGC uygunluğu bir **hukuk danışmanı** tarafından da gözden geçirilmelidir; bu belge hukuki görüş değildir.

### 4.3 İlk geliştirmede örnek kayıtlar

Gerçek müzik gelene kadar katalog yapısı **sahte/kısa sentetik** (ör. üretilmiş sinüs/ambient tonları, “ÖRNEK” etiketli) kayıtlarla hazırlanır. Sahte kayıtlar `license.type = "placeholder"` olur ve üretim yapılandırmasında yayın kontrolü bunları **reddeder**.

### 4.4 Ham müziğin korunması (en önemli karar)

**Hedef mimari:** tam kaliteli müzik **hiçbir zaman tarayıcıya gitmez.**

- **Ön izleme akışı:** Düşük kalite (örn. mono, düşük bit hızı, bant sınırlı), isteğe bağlı sessiz hafif işaretleme, kısa ömürlü imzalı ve oturuma bağlı adres, parça parça (segment) akış; tek dosya olarak indirilebilir public yol yok.
- **Nihai miks sunucuda:** Dışa aktarma sırasında tarayıcı yalnızca **işlenmiş şiir sesini** + **miks tarifini (recipe JSON)** gönderir; sunucu tam kaliteli müziği kendi içinde okuyup mikser (ffmpeg) ile birleştirir, sonucu verir. Ham müzik istemciye ayrı dosya olarak asla dönmez.
- **Depolama:** Ham ve ön izleme dosyaları herkese kapalı (private) depoda; doğrudan URL yok; yalnızca uygulama sunucusu erişir.
- **Ön izleme–nihai farkı:** Ön izleme düşük kalite olduğu için nihai sonuçla birebir aynı duyulmaz; kullanıcıya bunu söyleyen bir not gösterilir. Seviye/zamanlama parametreleri aynı recipe'den okunduğu için denge aynı kalır (parite testi bölüm 13'te).
- **Dürüst sınır:** Web ortamında %100 kopyalama engeli **mümkün değildir** (bkz. bölüm 12, Risk 10). Alınan önlemler kolay kötüye kullanımı ve toplu çekmeyi zorlaştırmak içindir; nihai çıktıda müzik zaten şiir sesiyle birleşmiş olarak bulunur.

---

## 5. Profesyonel ses kayıt yapısı

### 5.1 Tarayıcı teknolojilerinin değerlendirmesi

| Teknoloji | Rolü | Karar |
|---|---|---|
| `getUserMedia` + cihaz seçimi (`enumerateDevices`, `deviceId`) | Mikrofon erişimi, cihaz seçimi | **Kullanılır** |
| `getUserMedia` kısıtları (`echoCancellation`, `noiseSuppression`, `autoGainControl`) | Ham, işlenmemiş kayıt için **kapatılır**; işlem kontrolü bizde olur | Varsayılan: üçü de **kapalı** (kulaklık yoksa gürültü azaltmayı yalnız “kolay mod” açar) |
| **AudioContext** | Tüm zincirin çalıştığı grafik | **Kullanılır** |
| **AudioWorklet** | Seviye ölçümü, ham PCM yakalama (kayıpsız), gate/ducking zarfı | **Kullanılır** (ana kayıt yolu) |
| **MediaRecorder** | Yedek/kolay yol (Opus/AAC); sıkıştırılmış | **Yedek** — AudioWorklet başarısızsa; Safari/mobilde formatlar farklı |
| **OfflineAudioContext** | Kayıt sonrası hızlı işleme/render (EQ, kompresör, reverb) | **Kullanılır** (yerel işleme ve ön izleme render'ı) |
| Web Workers | MP3/WAV kodlama, büyük tampon işleme | **Kullanılır** (arayüzü kilitlememek için) |
| IndexedDB | Ses parçalarının saklanması | **Kullanılır** (bölüm 8) |
| Screen Wake Lock | Uzun kayıtta ekranın kapanmasını önleme | Destekleniyorsa **kullanılır** |
| `AudioWorklet` yoksa `ScriptProcessorNode` | Eski tarayıcı | **Kullanılmaz** (kullanımdan kaldırıldı); MediaRecorder yedeği |

**Neden AudioWorklet ana yol?** Sıkıştırılmamış (PCM) veri verir; kayıt sonrası işleme ve WAV için kayıpsız temel olur ve ölçüm/zarf çıkarmayı aynı yerde yapar. MediaRecorder çıktısı tarayıcıya göre değişir ve yeniden sıkıştırma kaybı yaratır.

### 5.2 Ses işlem zinciri

Her adım için “gerçek zamanlı mı, kayıt sonrası mı” kararı:

| # | Adım | Gerçek zamanlı (kayıt sırasında) | Kayıt sonrası (OfflineAudioContext/sunucu) | Not |
|---|---|---|---|---|
| 1 | Mikrofon girişi | Ham, işlemsiz yakalama; **izleme (monitoring) varsayılan kapalı** | — | Kayıt temiz kalır |
| 2 | Gürültü azaltma / kapı | Yalnızca **hafif** kapı (gate) isteğe bağlı, ölçüm amaçlı | **Asıl işlem burada**: gürültü profili + yumuşak kapı | Kayıt sırasında agresif gürültü azaltma yok; geri alınamaz hasar verir |
| 3 | Düşük frekans temizliği | — | Yüksek geçiren filtre (~80–100 Hz) | Çıkarma geri alınabilir değil → kayıt sonrası |
| 4 | Ses eşitleme (EQ) | — | Hafif sıcaklık/berraklık eğrisi (atmosfere bağlı) | |
| 5 | Kompresör | — | Hafif oran (2:1–3:1), yumuşak diz | Kayıt sonrası; ham kayıt korunur |
| 6 | De-esser | — | **İhtiyaç var**: şiirde “s/ş” keskinliği sık; dar bantlı dinamik kompresör (5–8 kHz) | Şiddeti kullanıcıya tek “Yumuşat” kaydırıcısıyla |
| 7 | Seviye dengeleme | Giriş kazancı **önerisi** (otomatik uygulama yok) | Hedef LUFS'a normalleştirme | Gerçek zamanlı AGC kapalı |
| 8 | Reverb / ortam | İsteğe bağlı **ön dinleme** (kayıt dosyasına işlenmez) | Atmosfer ön ayarı uygulanır | Ham kayıt kuru kalır |
| 9 | Fon müziği ile miks | Kayıt sırasında müzik kulaklıkta çalar (kayda karışmaz) | Ducking + fade + hizalama | Nihai miks sunucuda (4.4) |
| 10 | Son seviye / dışa aktarma | — | Normalleştirme, sınırlayıcı (limiter), WAV/MP3 | Hedef: −16 LUFS, gerçek tepe ≤ −1 dBTP (onaylı karar) |

**Temel ilke:** Kayıt her zaman **kuru ve işlenmemiş** alınır; tüm efektler kayıt sonrası “tarif” (recipe) olarak uygulanır. Böylece kullanıcı atmosferi sınırsız değiştirebilir ve kayıt asla bozulmaz.

### 5.3 Gecikme, kulaklık, uyumluluk

- **Gecikme yönetimi:** `AudioContext.outputLatency/baseLatency` ile tahmin; müzik kulaklıktan çalarken şiir kaydı müzikle hizalı gelmeyebilir. Çözüm: kayıt başlangıcında müzik zaman damgasını (`audioContext.currentTime`) kaydet; kayıt sonrası “zamanlama kaydırma” (± ms) kontrolü ve isteğe bağlı otomatik hizalama (bölüm 7).
- **Kulaklık uyarısı:** Mikrofon+hoparlör kullanımında müzik kayda sızar. Cihaz çıkışı kulaklık değilse görünür uyarı (tam algılama tarayıcıya bağlıdır; “önerilir” dili kullanılır, zorlama yok).
- **Bluetooth:** Mikrofon açıldığında profil değişimi (A2DP→HFP) ses kalitesini ve gecikmeyi bozar; kablolu kulaklık önerilir (Risk 2).
- **Seviye ölçümü:** RMS + tepe, dBFS; clipping eşiği (−1 dBFS) aşıldığında sayaç.
- **Tarayıcı uyumluluğu** (sürümler daha sonra doğrulanacak): Chrome/Edge (masaüstü+Android) güçlü; Safari (macOS/iOS) AudioWorklet destekler fakat mikrofon/AudioContext davranışı kısıtlıdır (kullanıcı hareketiyle başlatma, arka plana alınınca askıya alma, MediaRecorder MP4/AAC); Firefox ikincil.

### 5.4 Uzun kayıt ve kararlılık

- PCM, ~5–10 sn'lik parçalar halinde IndexedDB'ye **sürekli** yazılır (bellekte biriktirilmez); tarayıcı çökse bile son parçaya kadar kurtarılabilir.
- Onaylı kayıt biçimi: **48 kHz, 24-bit, mono**. Boyut ≈ 8,2 MB/dk (15 dk sınırında ≈ 124 MB). Web Audio'dan gelen 32-bit float örnekler IndexedDB'ye 24-bit paketli PCM olarak yazılır; dönüşüm AudioWorklet/Worker içinde yapılır. Tarayıcının gerçek örnekleme hızı 48 kHz değilse yeniden örnekleme (resample) kayıt sonrası yapılır ve Aşama 0'da ölçülür.
- Kayıt başına **en fazla 15 dakika** (onaylı sınır); 14. dakikada uyarı, 15. dakikada kayıt otomatik biter.
- Duraklama sırasında mikrofon akışı belirli süre sonra kapatılır, devam edilirken yeniden açılır.

---

## 6. Ses ortamı (atmosfer) seçenekleri

Kullanıcıya **teknik terim yok**: her atmosfer bir kart, ardından **tek kaydırıcı: “Ortam miktarı”** (0–100) ve en fazla **iki ek kontrol**: “Sıcaklık” ve “Netlik”. Değerler tarifin içinde saklanır; ileri düzey ayrı panelde, başlangıçta kapalı.

| Atmosfer | Efekt bileşimi (dahili) | Kullanıcıya açılan |
|---|---|---|
| **Temiz stüdyo** | HPF 90 Hz, hafif kompresör 2:1, de-esser düşük, reverb yok/çok kısa oda (<0,2 sn, %5) | Ortam miktarı, Netlik |
| **Sıcak stüdyo** | Temiz + 150–250 Hz hafif yükselme, 8 kHz üstü hafif kısma, kısa oda reverb (0,3 sn, %8) | Sıcaklık, Ortam miktarı |
| **Yakın ve samimi** | Yakın mikrofon hissi: alt-orta hafif yükselme, daha güçlü kompresör (3:1), reverb neredeyse yok, ses ön planda | Yakınlık (kompresör+seviye), Sıcaklık |
| **Küçük salon** | Küçük oda IR/algoritmik reverb (0,8–1,1 sn, %12–18), erken yansımalar hafif, 200 Hz altı reverb kesik | Ortam miktarı |
| **Büyük salon** | Uzun reverb (1,8–2,5 sn, %15–22), ön gecikme 20–30 ms, yüksek frekans sönümleme | Ortam miktarı, Netlik |
| **Sahne** | Orta oda + hafif yankı (tek tekrar, 90–140 ms, %6), ses biraz geride | Ortam miktarı |
| **Sinematik şiir** | Uzun yumuşak reverb (2–3 sn, %20), alt-orta sıcaklık, hafif geniş stereo, müzikte daha güçlü otomatik kısma | Ortam miktarı, Sıcaklık |
| **Hafif plak/radyo** | Bant sınırlama (~100 Hz–8 kHz), hafif harmonik bozulma, çok hafif gürültü katmanı (varsayılan düşük), kısa oda | Eskilik miktarı |

Kurallar: reverb “ıslak” oranı en çok %25 ile sınırlanır; reverb **düşük frekanslardan arındırılır** (çamur olmasın); ön ayar uygulandığında şiir anlaşılırlığı korunmak zorundadır (dinleme testi kabul kriteri). “Aşırı yankı” için kullanıcı kontrolü üst sınırı yoktur ancak varsayılanlar ölçülüdür.

---

## 7. Fon müziği ve ses kontrolleri

| Kontrol | Davranış | Varsayılan |
|---|---|---|
| **Ses kaydı seviyesi** | Şiir kanalı kazancı (−12…+12 dB) | 0 dB (normalleştirme sonrası) |
| **Fon müziği seviyesi** | Müzik kanalı (−40…0 dB, “Sessiz–Yüksek” etiketi) | ≈ −18 dB (şiirin altında) |
| **Fon başlangıç noktası** | Müziğin parçadan hangi saniyeden başlayacağı | 0 sn |
| **Müzik kesme noktası** | Şiir bitişinden sonra müzik kuyruğu (sn) / parçanın nerede biteceği | Şiir bitişi + 3 sn |
| **Başlangıç/bitiş yumuşatma** | Müzik fade-in/out (0–8 sn) | 2 sn / 3 sn |
| **Otomatik kısma (ducking)** | Şiir sesi varken müziği kısar: eşik, miktar (~−6…−12 dB), atak (~50–100 ms), bırakma (~400–800 ms) | Açık, −8 dB |
| **Sessiz bölümleri koruma** | Şiirdeki duraklarda (kıta arası) müzik tekrar **yükselir**, ses boşluğu doldurulur; kısa nefes boşluklarında dalgalanma olmaması için gecikmeli bırakma | Açık |
| **Kayıt–müzik zamanlama** | Kaydı müziğe göre ± ms kaydırma; otomatik gecikme telafisi | 0 ms (+ otomatik telafi) |
| **Son kaydı normalleştirme** | Hedef LUFS'a seviye + tepe sınırlayıcı | −16 LUFS, tepe −1 dBTP |

**Ducking uygulama kararı:** Zarf, şiir sesinin (işlenmiş) enerji eğrisinden çıkarılır. Tarayıcıda ön izleme için Web Audio ile uygulanır; nihai miks için **aynı parametreler recipe'de** gönderilir ve sunucuda ffmpeg `sidechaincompress` veya önceden hesaplanmış zarf eğrisi ile uygulanır. Hangisi seçilirse ön izleme ile fark ölçüsü test edilir (13.3).

**Sürüm 1 ek kural:** Kıta/duraklama zamanlamaları kayıttan **otomatik** çıkarılır (sessizlik analizi); metne eşleme (satır zamanları) video entegrasyonunun temelidir (bölüm 15). İlk sürümde otomatik hizalama yaklaşık/isteğe bağlıdır; kullanıcı düzeltebilir.

---

## 8. Kayıt ve veri güvenliği (yerel öncelikli)

- **Depolama:** Metin/ayar/tarif (küçük) → IndexedDB `projects`. Ses → IndexedDB `audioChunks` (Blob). **Büyük ses localStorage'a konmaz.** localStorage yalnızca küçük tercihler içindir (dil, tema, son cihaz).
- **Sürüm geçişi:** IndexedDB şema sürümü ve geçiş (migration) fonksiyonları baştan planlanır.
- **Depolama kotası:** `navigator.storage.estimate()` ile kullanım gösterilir; `navigator.storage.persist()` istenir (tarayıcı otomatik silmesin diye) — izin verilmezse kullanıcı uyarılır. Kota dolarsa kayıt yazımı durdurulmadan önce uyarı.
- **Kaydedilmemiş çalışma uyarısı:** `beforeunload` ile; ek olarak otomatik periyodik kayıt olduğundan kayıp zaten asgaridir. İlk açılışta yarım kalmış kayıt kurtarma önerisi.
- **Mikrofon yalnızca kayıt sırasında:** Akış kayıt bittiğinde/duraklatma süresi aşıldığında/sayfa gizlendiğinde `track.stop()` ile kapatılır; tarayıcı mikrofon göstergesi gereksiz yanmaz. Sayfa arka plana alınırsa (mobil) kayıt davranışı uyarıyla bildirilir.
- **Açık mikrofon izni anlatımı:** Tarayıcı penceresinden önce uygulama içi açıklama (ne için, ne zaman, nereye gitmez).
- **“Sunucuya gönderilmez” beyanı doğru olmalı:** Kayıt, yalnızca **Dışa aktar** eylemiyle ve kullanıcı onayıyla gönderilir. Bu davranış arayüzde ve aydınlatma metninde yazılır. Analitik/izleme araçları ses/metin içeriğini asla toplamaz.
- **Geçici dosya temizliği:**
  - İstemci: işlenmiş geçici Blob'lar `URL.revokeObjectURL` ile; kullanıcı “çalışmayı sil” dediğinde ilgili tüm IndexedDB kayıtları; ayarlardan “tüm yerel veriyi sil”.
  - Sunucu: yükleme/işlem/çıktı dosyaları işlem tamamlandığında hemen silinir; **güvenlik ağı olarak** TTL (onaylı: **yüklenen ses en fazla 1 saat, oluşturulan çıktı en fazla 30 dakika**; işlem/indirme sonrası mümkün olan en kısa sürede silinir) ve periyodik süpürme işi.
- **Veri kaybı uyarısı:** Tarayıcı verisi (site verisi/geçmiş) silinirse veya özel gezinti kullanılırsa **yerel çalışmalar kaybolabilir**; arayüz bunu anlatır ve JSON yedek önerir. Yedek (onaylı karar) **yalnızca proje bilgilerini** içeren JSON'dur; ses paketli ZIP ve ham fon müziği ilk sürümde yoktur. Ses kaybı riski bu yüzden arayüzde açıkça belirtilir; sesin yedeği için kullanıcıya WAV indirmesi önerilir.
- **KVKK/Gizlilik:** Platform kamuya açıldığında ayrı aydınlatma metni ve çerez/yerel depolama bilgilendirmesi gerekir; sunucuda geçici işlenen ses de kişisel veri olabilir (ses/şiir). İçerik hukuki incelemeden geçirilmelidir.

---

## 9. Dosya çıktıları

| Çıktı | Ayrıntı |
|---|---|
| **WAV** | Mikrofon kaydı (müziksiz/ham işlenmiş): 48 kHz, 24-bit, **mono**. Fonla birleştirilmiş nihai WAV: 48 kHz, 24-bit, **stereo**; kayıpsız ana sürüm |
| **MP3 (paylaşım)** | **192 kbps stereo**, 48 kHz (kaynak 48 kHz'den dönüşümsüz); ID3 etiketleri (başlık, sanatçı = şair, yıl; müzik atfı gerekiyorsa yorum alanı) |
| **JSON yedek (isteğe bağlı)** | Proje, metin, tarif (recipe), kıta zamanlamaları, katalog `trackId` (müzik dosyası **yok**) |
| **Dosya adı** | `{sair}-{baslik}-{YYYY-MM-DD}.{wav|mp3}`, Türkçe karakter dönüştürme (ç→c, ş→s…), güvenli karakter kümesi, uzunluk sınırı |

- **Atıf gerekliyse** (CC-BY gibi): dışa aktarma ekranı hazır atıf metnini gösterir ve ID3/JSON'a yazar.
- **Yok:** MP4/video, ham müzik, stem (ayrı iz) çıktısı.
- **Entegrasyon noktası:** Dışa aktarma, ayrıca “video hazır paket” (`ExportBundle`, bölüm 15) üretebilecek şekilde düzenlenir; ilk sürümde bu paket yalnızca dahili veri modeli olarak vardır, kullanıcıya sunulmaz.

---

## 10. Geliştirme aşamaları

Her aşama kendi içinde yayınlanabilir/geri alınabilir olmalıdır.

### Aşama 0 — Teknik doğrulama ve tarayıcı ses denemesi
- **Yapılacak:** Atılabilir bir deneme sayfası: `getUserMedia`, cihaz listesi, AudioWorklet ile PCM yakalama + seviye ölçümü, kısa kayıt → geri çalma, WAV üretimi, IndexedDB'ye parçalı yazma, ffmpeg'in sunucuda basit miks denemesi (yalnızca sentetik ses). Chrome, Edge, Safari/iOS'ta çalışıp çalışmadığının tablosu.
- **Kabul:** 5 dk kayıt bellek şişmeden tamamlanır; Safari iOS'ta kayıt+geri çalma çalışır; gecikme ölçümü kayıtlıdır; WAV başka bir yazılımda sorunsuz açılır; “mimari risk” listesi netleşir.
- **Riskler:** iOS davranışı beklenenden kısıtlı çıkabilir (plan revize edilir); sunucu ffmpeg barındırma maliyeti.
- **Test:** Cihaz/tarayıcı matrisi (13); sentetik sinyalle ölçüm.

### Aşama 1 — Şiir metni, dahili fon seçimi, temel kayıt
- **Yapılacak:** Proje iskeleti, ekran akışı, metin editörü, okuma ekranı, sahte katalog, düşük kaliteli ön izleme akışı, kayıt/duraklat/bitir, geri sayım, seviye göstergesi, hata/izin ekranları.
- **Kabul:** Kullanıcı metin yazar → müzik seçer → kaydeder → dinler; hata durumları anlaşılır; müzik indirme yolu yok.
- **Riskler:** Okuma ekranı kaydırma senkronu; izin akışı farklılıkları.
- **Test:** 13'teki izin/cihaz senaryoları, 390/1280 px.

### Aşama 2 — Kayıt denemeleri ve yerel proje saklama
- **Yapılacak:** IndexedDB şeması, çalışmalar ve denemeler, otomatik kayıt, kurtarma, kota gösterimi, JSON yedek içe/dışa aktarma, silme akışları.
- **Kabul:** Sayfa kapanıp açılınca çalışma ve denemeler geri gelir; çökme sonrası son parçaya kadar kurtarma; kota doluyken zarif uyarı.
- **Riskler:** Safari depolama temizliği; şema geçişleri.
- **Test:** Sekme kapatma, çökme simülasyonu, depolama silme.

### Aşama 3 — Profesyonel ses işleme ve ortam seçenekleri
- **Yapılacak:** Kayıt sonrası zincir (HPF, gate/gürültü, EQ, kompresör, de-esser, normalleştirme), 8 atmosfer, “ortam miktarı”, OfflineAudioContext render, A/B karşılaştırma.
- **Kabul:** Her atmosfer şiir anlaşılırlığını bozmaz; clipping yok; işlem süresi kabul edilebilir (1 dk kayıt < ~10 sn, hedef masaüstü); kayıt kuru kalır, tarif geri alınabilir.
- **Riskler:** Reverb/IR lisansları (IR dosyaları da lisanslı olmalı); mobil CPU.
- **Test:** Sentetik sinyal + gerçek ses setinde nesnel ölçüm (LUFS, tepe) + dinleme testi.

#### Aşama 3 ilerleme notu (2026-11-20)

**Durum: kod yazıldı ve otomatik testlerden geçti; gerçek cihaz/kulak testleri ertelendi (aşama tamamlandı sayılmaz).**

- **Yapılan:** Saf TypeScript DSP zinciri (`apps/web/src/audio/fx/`): giriş kazancı → DC temizliği → high-pass (24 dB/okt) → hafif gürültü kapısı → konuşma EQ'su → kompresör → basit de-esser → çıkış kazancı → reverb → lookahead limiter. Her modül ayrı sınıf, 6'sı bypass edilebilir (DC ve limiter güvenlik için her zaman açık). 8 hazır atmosfer yalnızca ayar paketidir. Reverb tamamen uygulama içi matematiksel FDN'dir (dış dürtü yanıtı dosyası yok); ıslak oran en çok %25, süre en çok 3 sn.
- **Orijinal kayıt dokunulmaz:** Zincir girdinin kopyası üzerinde çalışır; ses dosyasına efekt yazılmaz. Ayarlar şema sürümlü `FxSettings` olarak proje ve deneme bazında saklanır (IndexedDB şeması değişmedi; kayıtlar okunurken `migrateProject/migrateTake` ile güncel şemaya çekilir). JSON yedek v2 yalnızca `fx` ayarını ekler (ses/müzik yok), v1 yedekler varsayılan ayarla açılır.
- **Önizleme:** `FxPlayer`, kaydı diskten 1 sn'lik parçalarla okuyup işler (bellekte ≈ 3–4 sn). Atmosfer/ayar değişince kayıt yeniden oluşturulmadan kısa çapraz geçişle yeni nesil başlar; Önce/Sonra anlıktır (iki yol aynı anda hazır, seviye eşitlenmiş). Aynı anda tek oynatıcı kuralı fon ön izleme ve deneme oynatıcıları dahil uygulanır. Sayfadan/ekrandan çıkışta `AudioContext` kapatılır, düğümler ayrılır, geçici adresler iptal edilir.
- **Canlı dinleme:** Kayıt ekranında varsayılan KAPALI; açılınca kulaklık uyarısı gösterilir; yalnızca işlenmemiş sesi duyurur, kayda girmez.
- **Göstergeler:** Giriş/işlenmiş çıkış seviyesi, tepe/taşma, çok düşük ve sessiz kayıt uyarıları; renk yanında simge ve metin kullanılır.
- **Otomatik test sonuçları:** Node 31/31 (preset değerleri, ayar doğrulama/gidiş-dönüş, eski şema göçü, bypass, clipping koruması, sessiz kayıt, JSON yedek, tek oynatıcı, kaynak temizliği, durum sürekliliği, reverb normalleşmesi). Başsız Edge'de gerçek IndexedDB 13/13 ve gerçek `AudioContext` oynatıcı 10/10 (konum ilerleme, seviye ölçümü, önce/sonra, ayar değişimi, tek oynatıcı, bitiş, dispose); 390/1280 px düzen ölçümleri geçti (yatay taşma yok, kontroller/etiketler görünür).
- **Bilinen sınırlamalar:** (1) Limiter örnek tepesini garanti eder (tavan −1,5 dBFS); gerçek/örnekler arası tepe ölçülmez, nihai −1 dBTP doğrulaması Aşama 4'te. (2) De-esser tek bantlı basit bir yöntemdir; ses kalitesi kulakla doğrulanmadı. (3) Reverb modülasyonsuz FDN'dir; çok sıkı/uzun ayarlarda hafif metalik tını olabilir, kulak testi bekliyor. (4) Gürültü kapısı/giriş kazancı kayıt çözümlemesine dayanır; çok gürültülü ortamlar ve taşmış (clipping) kayıtlar düzeltilemez, yalnızca uyarılır. (5) Önizleme yeni ayarı ≈ 0,15–0,3 sn gecikmeyle duyurur. (6) Canlı dinleme işlenmemiş sestir; işlenmiş canlı dinleme yoktur. (7) Efektli kalıcı WAV/MP3 çıktısı henüz yok (Aşama 4).
- **Kullanıcı cihaz testi bekliyor:** gerçek mikrofon kaydıyla efekt kalitesi, atmosferlerin anlaşılırlığı (kulak), kulaklık/Bluetooth gecikmesi, canlı dinleme geri beslemesi, iOS Safari ve Android'de önizleme, uzun (15 dk) kayıtta önizleme akıcılığı.

### Aşama 4 — Miks ve WAV/MP3 dışa aktarma
- **Yapılacak:** Recipe formatı, sunucu miks servisi (iş kuyruğu, ffmpeg), geçici yükleme/çıktı depolama, imzalı kısa ömürlü indirme, otomatik silme, hız sınırı/günlük kota/bot koruması, ducking/fade/zamanlama, normalleştirme, MP3 kodlama, ID3.
- **Kabul:** Sunucuda miks edilen sonuç ön izlemeyle dengede tutarlı; ham müzik hiçbir istekte dönmez; işlem sonrası sunucuda dosya kalmaz; sınırlar çalışır.
- **Riskler:** Sunucu maliyeti/zaman aşımı; ön izleme–nihai farkı; kötüye kullanım.
- **Test:** Parite testi, kota/hız testleri, silme doğrulama, güvenlik testleri (16).

#### Aşama 4 ilerleme notu (2026-11-20)

**Durum: kod yazıldı ve otomatik/uçtan uca testlerden geçti; gerçek cihaz/kulak testleri ve canlı ortam kurulumu bekliyor (aşama tamamlandı sayılmaz).**

- **Akış:** İstemci efektleri çevrimdışı uygular (stereo 48 kHz 24-bit WAV) → `POST /api/exports` (tarif + bot/limit denetimi) → `PUT /api/exports/:id/voice` (tek seferlik, belirteçli, yalnızca `audio/wav`, boyut/süre/biçim doğrulamalı) → kuyruk (eşzamanlı en çok 2 miks) → ffmpeg iki geçişli miks → `GET /api/exports/:id` durum (`awaiting-upload/waiting/preparing/completed/failed`) → 2 dk geçerli imzalı indirme. Tam kaliteli müzik yalnızca sunucuda okunur; tarayıcıya hiçbir yanıtla gitmez.
- **Miks:** ses + müzik (başlangıç noktası, kesme/kuyruk, giriş/çıkış yumuşatma, seviye, ±300 ms zamanlama), okurken müziği kısma (`sidechaincompress`, eşik konuşma düzeyinden otomatik hesaplanır; sessizlikte müzik geri gelir), iki geçişli `loudnorm` (−16 LUFS) + `alimiter` (−1 dBTP), WAV 24-bit / MP3 192 kbps, ID3/INFO etiketleri (başlık, sanatçı, besteci, gerekiyorsa atıf).
- **Kararlar:** Müziksiz **WAV** tamamen cihazda üretilir (BS.1770 ölçümlü −16 LUFS, sunucu yok). Müziksiz **MP3** ve tüm müzikli çıktılar sunucudan geçer (istemci MP3 kodlayıcısı Aşama 0'da doğrulanmadığı için). Sunucu yolunda arayüz açık onay kutusu ister.
- **Gizlilik/temizlik:** Yüklenen ses miks biter bitmez (başarı/başarısız) silinir; çıktı indirilince silinir; yedek olarak yükleme 1 saat, çıktı 30 dk TTL ile süpürülür; başlangıçta geçici dizin temizlenir. İşin kaydı içerik taşımaz.
- **Kötüye kullanım:** Dakikalık IP sınırı (240), cihaz(oturum)+IP bağımsız kayan 24 saatte 10 dışa aktarma, oturum başına tek aktif iş, IP başına ≤3 aktif iş, kayıt ≤15 dk, yükleme ≤280 MB, bot koruması (Cloudflare Turnstile doğrulaması sunucuda; üretimde anahtarsız başlamaz).
- **Otomatik test sonuçları:** Web 39/39, API 23/23, gerçek Edge→gerçek API uçtan uca + arayüz akışı tamam (çıktı −15,97 LUFS, tepe ≤ −1 dBFS, ikinci indirme 410, dosya sunucudan silinmiş). İstemci LUFS ölçümü ffmpeg `ebur128` ile ±0,3 LU uyumlu. 390/1280 px düzen ölçümleri geçti.
- **Bilinen sınırlamalar / yapılacaklar:** (1) Sınır sayaçları ve iş kuyruğu **bellek içi**: süreç yeniden başlarsa sıfırlanır, tek sunucu varsayar; canlıda Redis/DB gerekir. (2) Turnstile **istemci** widget'ı gerçek anahtarla denenmedi (anahtar yok). (3) Canlıda ters vekil arkasında `trustProxy` ve gerçek IP yapılandırması gerekir; aksi halde IP sınırı bozulur. (4) Fon müzikleri hâlâ yer tutucu (sentetik) — gerçek lisanslı 12 parça ve lisans kanıtları gelmeden halka açılamaz; ses yükleme ucu teknik olarak kullanıcı sesiyle müziği ayırt edemez (yalnızca şiir sesi olarak karıştırılır, kataloğa girmez, ham müzik indirilemez). (5) Tarayıcıda **fon müziğiyle karışık ön izleme yok** (yalnızca sunucu miksi sonucu duyulur; ön izleme–nihai parite testi yapılamadı). (6) `ffmpeg-static` yalnızca geliştirme bağımlılığıdır (GPL-3.0-or-later; ürüne/imaja dahil edilmez); canlıda Docker imajına dağıtım ffmpeg'i kurulacak ve lisansı hukuken gözden geçirilecek. (7) 15 dk'lık kayıtta istemci render süresi, tarayıcı belleği ve ≈260 MB yükleme gerçek cihazda denenmedi. (8) Gerçek (inter-sample) true-peak sunucuda ayrıca doğrulanmıyor; tavan `alimiter` + `loudnorm TP` ile sağlanıyor, testte ebur128 ile ölçüldü.
- **Kullanıcı cihaz testi bekliyor:** mobil Safari/Android'de uzun render + yükleme, zayıf bağlantıda yükleme kesilmesi, gerçek kulakla müzik/ses dengesi ve ducking hissi, Bluetooth gecikmesi için zamanlama kaydırma değerleri.

### Aşama 5 — Mobil uyumluluk ve kalite kontrolleri
- **Yapılacak:** Mobil arayüz cilası, iOS/Android özel davranışlar, wake lock, arka plana alma, erişilebilirlik denetimi, performans bütçesi, uçtan uca testler.
- **Kabul:** 390 px'te tüm akış tamamlanır; klavye/ekran okuyucu akışı geçer; Lighthouse/erişilebilirlik hedefleri sağlanır.
- **Riskler:** iOS sınırlamaları; gerçek cihaz erişimi.
- **Test:** Gerçek cihaz matrisi.

#### Aşama 5 ilerleme notu (2026-11-20)

**Durum: kod ve otomatik denetimler yapıldı; gerçek cihaz testleri ve gerçek klavye (Tab) testi yapılmadı. Aşama tamamlandı sayılmaz.**

- **Yapılan:** Kayıt ve dışa aktarma sırasında ekranı açık tutma (Wake Lock; sekme dönünce yeniden alır, desteklenmiyorsa uyarı). Arka plan/kesinti algısı (AudioContext durumu ve sekme gizlenmesi → uyarı + "Devam ettir"). 48 kHz vermeyen cihazlar için örnekleme hızı yedeği (kayıt cihaz hızında saklanır, dışa aktarmada Lanczos ile 48 kHz'e çevrilir). iOS güvenli alan ve `dvh` düzeltmeleri, "İçeriğe geç" bağlantısı, adım başına sayfa başlığı ve odak/ekran okuyucu duyurusu, her ekranda tek `h1`, adım listesi landmark içinde, hata sınırı (beyaz ekran yerine açıklama), dışa aktarmada çevrimdışı denetimi ve kapanış uyarısı. Performans bütçesi betiği (`npm run budget`).
- **Otomatik sonuçlar:** Web 47/47, API 23/23, tip denetimi temiz. Bütçe: JS 96 KB, CSS 2,8 KB gzip (bütçe 130/12 KB), üçüncü taraf adres yok. Renk kontrastı WCAG AA (≥4,5:1) tüm yüzeylerde geçti. `axe-core` (WCAG 2.2 AA + best-practice) gerçek uygulamada her ekranda temiz; 320/360/390/768/1280 px'te 57/57 kontrol (taşma yok, dokunma hedefi ≥ 40 px). 390 px'te Edge'in **sahte mikrofonuyla** tam akış: kayıt (4,8 sn, 20 parça, 48 kHz) → IndexedDB → Ses stüdyosu → sunucu dışa aktarma tamam.
- **Yapılmadı / sınırlama:** (1) Gerçek Tab/Enter/Boşluk klavye turu çalıştırılmadı. Kod tarafında kayıt başlayınca odağın kaybolması düzeltildi (`data-af`) ama bu düzeltme tarayıcıda doğrulanmadı. (2) Lighthouse çalıştırılmadı. (3) Sahte mikrofon gerçek donanım, Bluetooth, iOS Safari ve Android davranışını kanıtlamaz. (4) Ekran okuyucu (VoiceOver/TalkBack) ile elle test yapılmadı. (5) Wake Lock ve kesinti uyarıları yalnızca birim testi/kodla doğrulandı, gerçek cihazda değil. (6) Panel tasarımı kullanıcıyla netleştirilecek (mevcut tasarım istenen gibi değil).
- **Kullanıcı cihaz testi bekliyor:** iOS Safari/Android'de kayıt (kilit ekranı, arama, arka plana alma), ekranın uyumaması, 48 kHz vermeyen cihaz, VoiceOver/TalkBack, gerçek klavye turu, uzun kayıt + dışa aktarma.

### Aşama 6 — Video sistemine entegrasyon
- **Yapılacak:** `ExportBundle` sözleşmesinin donması, bağımsız video modülü, iş kuyruğu, durum izleme, MP4 çıktıları (bölüm 15).
- **Kabul:** Ses modülü video modülüne bağımlı olmadan çalışır; video modülü yalnızca `ExportBundle` ile beslenir.
- **Riskler:** Video render maliyeti; sosyal platform biçim değişiklikleri.
- **Test:** Sözleşme (contract) testleri, 9:16/16:9/1:1 çıktı denetimi.

#### Aşama 6 ilerleme notu (2026-11-20)

**Durum: kod yazıldı ve otomatik/uçtan uca testlerden geçti; gerçek cihaz/izleme testleri, platform doğrulaması ve canlı kurulum bekliyor (aşama tamamlandı sayılmaz).**

- **Mimari:** Video, `apps/video-worker` altında **ayrı bir süreç ve uygulamadır** (port 5172). Ses modülüyle tek bağları: (1) `packages/contracts` içindeki donmuş `ExportBundle` v1 sözleşmesi, (2) API'nin ürettiği **imzalı, kısa ömürlü ses başvurusu** (`audioRef`, HMAC) ve (3) paylaşılan geçici dizinde yalnızca okunan çıktı + sunucunun yazdığı meta dosyası. Ortak kod `packages/server-kit` içindedir (limitler, ffmpeg çalıştırıcı, belirteç/imza). Bağımsızlık testle zorunlu kılınır: API ve web `video-worker`'ı içe aktaramaz; video işçisi yalnızca `contracts`, `server-kit` ve `fastify`'a bağımlıdır.
- **Akış:** Dışa aktarma `forVideo` ile istenir (çıktı indirildikten sonra da en çok 30 dk saklanır) → durumda `audioRef` + sunucu yazımlı `audioInfo` (müzik/lisans) döner → istemci `ExportBundle` + `VideoSpec` gönderir (`POST /api/video/jobs`, dosya yok) → kuyruk (eşzamanlı 1) → `waiting → preparing → completed|failed` + ilerleme → imzalı indirme. Ses, video işçisi tarafından işin başında kendi dizinine kopyalanır ve render bitince silinir; video çıktısı indirilince veya 30 dk sonra silinir; başlangıçta geçici dizin temizlenir.
- **Video:** 1080×1920 (9:16), 1920×1080 (16:9), 1080×1080 (1:1); H.264 (yüksek profil, yuv420p, 30 fps, `+faststart`) + AAC 192 kbps. Arka plan: 5 yerleşik animasyonlu degrade (sabit tohum: tekrarlanabilir); altyazı libass ile yakılır (Lora, SIL OFL; Türkçe karakterler doğrulandı); başlık ve künye; atıf gerekirse tüm süre boyunca görünür. Platform ön ayarları: TikTok, Instagram Reels, YouTube (süre/yön uyarıları engellemez).
- **Altyazı zamanlaması:** Kayıttaki konuşma bölümleri algılanır, konuşma süresi dizelere hece oranıyla paylaştırılır (kıta arası duraklar geri konur). Bu bir **tahmindir**: bilinen zamanlı sentetik şiirde ortalama başlangıç hatası ≤ 200 ms, hece oranı bozulunca ≤ 700 ms ölçüldü; arayüzde genel ±3 sn kaydırma ve satır listesi var, satır satır elle düzeltme yok.
- **Güvenlik:** Başka oturum, bozuk/süresi dolmuş/başka anahtarla imzalı başvuru, yol benzeri başvuru, yanlış müzik beyanı ve bozuk paket reddedilir. Müzik/lisans/atıf bilgisi **yalnızca sunucu kaydından** alınır (istemci beyanı yok sayılır). Sosyal medyaya izin vermeyen lisansla video üretilmez; yer tutucu müzik üretimde reddedilir. Video işçisi dosya yükleme kabul etmez. Günlük video sınırı (varsayım: **5/gün**, karar bekliyor), oturum başına tek aktif iş.
- **Otomatik test sonuçları:** Video işçisi 24/24 (doğrulama, ASS, gerçek ffmpeg ile 3 yönde render: codec/boyut/fps/süre/faststart, beyaz altyazı piksellerinin varlığı, API+işçi uçtan uca, güvenlik, TTL, limitler, üretim kapıları, bağımsızlık). Web 54/54, API 23/23. Gerçek Edge→API→video işçisi arayüz akışı: ses dışa aktarma → 4 satır zamanlama → 16:9 video (1920×1080, 13 sn) tamam; `axe` ve 390 px düzen temiz.
- **Bilinen sınırlamalar / yapılacaklar:** (1) Görsel/video sahne ekleme **yok**: yalnızca yerleşik degradeler (kullanıcı görseli politikası ayrı karar, ayrıca güvenlik gerektirir). (2) TikTok/Reels/YouTube sınırları ve kodlama gereksinimleri koddaki varsayımlardır; yayın öncesi platformların güncel şartlarıyla doğrulanmalı, üretilen MP4'ler gerçek platformlara yüklenip denenmedi. (3) Kuyruk ve sayaçlar bellek içi, tek süreç varsayar (canlıda Redis/DB ve paylaşılan hacim gerekir); API ile video işçisi aynı veri dizinini paylaşmak zorundadır. (4) Video 10 dk'ya kadar ses kabul eder; uzun render süreleri ve CPU maliyeti ölçülmedi. (5) Bot koruması video ucunda ayrıca yok (iş, bot-denetimli ve limitli bir dışa aktarma çıktısına bağlıdır). (6) `ffmpeg-static` ve libx264 GPL: canlıda Docker imajındaki ffmpeg'in lisans/patent yükümlülükleri hukuken gözden geçirilmeli. (7) Altyazı zamanlaması elle satır düzeltmeye izin vermez; şiirin ritmi hece oranından çok saparsa kayabilir. (8) Tarayıcıda indirme davranışı (özellikle iOS Safari'de MP4 indirme/paylaşma) gerçek cihazda denenmedi.
- **Kullanıcı cihaz testi bekliyor:** üretilen MP4'ün iOS/Android'de oynatılması ve TikTok/Reels/YouTube'a yüklenmesi, gerçek okumalarda altyazı zamanlama kalitesi (kulak/göz), uzun şiirde render süresi.

### Panel dönüşümü (Aşama 6 sonrası, 2026-11-20) — "Üretim platformu" kabuğu

Kullanıcı önerisi üzerine uygulama, birbirinden bağımsız ekranlardan **sol menülü, masaüstü odaklı tek bir üretim paneline** dönüştürüldü. Önerilen dört fazın **1. fazı (yeni panel tasarımı)** yapıldı; 2–4 sürüyor/bekliyor.

**Menü:** Ana Panel · Ses Stüdyosu · Video Editörü · Şiir Kütüphanem · Fon Müziklerim · Video Arşivim · Ses Kayıtlarım · Stüdyo Ayarları. Dar ekranda menü üstte yatay kaydırmalı şeride döner.

**Tasarım ilkeleri (karar):**
1. **Ayar düğmesi yalnızca motorun gerçekten desteklediği şey için konur.** Desteklenmeyenler "Henüz desteklenmeyenler" bölümünde nedeniyle listelenir (sahte özellik yok).
2. **Genel stüdyo ayarları ≠ proje ayarları.** Genel ayar (`shared/settings.ts`, şema sürümlü, localStorage) yalnızca **yeni** projelerin başlangıç değerlerini ve cihaz tercihlerini taşır; projeye özel değerler projenin içinde kalır (`Project.fx`, `Project.mix`, `Project.reading`). Genel ayar değişince açık/eski projeler değişmez; proje içi değişiklik genel ayarı etkilemez (testli).
3. **Kendi müziğini yükleme yok** (ilk günden gelen kural). Önerideki "Müzik Kütüphanem → fon müziği yükleme" bu kuralla çeliştiği için **uygulanmadı**; "Fon Müziklerim" yönetici kataloğunu dinletir/favorilettirir. Kuralı değiştirmek, lisans/telif ve güvenlik varsayımlarının yeniden kurulmasını gerektirir (ayrı karar).
4. **Kalıcı arşiv** (Video Arşivim, güvenilir yerel/sunucu depolama, yedekle/geri yükle) ayrı bir altyapı işidir; o zamana dek "Video Arşivim" dürüst bir durum sayfasıdır. Tarayıcı depolamasının tam güvence vermediği uyarısı arayüzde durur; yedekleme: tek proje + **tüm çalışmalar** (ses içermez).

**Ayar eşlemesi (önerilen ayar → durum):**

| Öneri | Durum |
|---|---|
| Mikrofon seçimi, geri sayım | Destekleniyor (genel) |
| Giriş seviyesi göstergesi | Kayıt ekranında var; ayar yok |
| Gürültü azaltma / kayıt kalitesi | Sabit ve bilinçli: kayıtta kapalı (ham), 48 kHz·24-bit mono; temizlik Ses Stüdyosu'nda |
| Kulaklık kontrolü | Canlı dinleme her kayıtta kapalı başlar (sabit) |
| Hazır ses profilleri, reverb/yankı, temizlik, sıcaklık, netlik | Destekleniyor (yeni projelerin varsayılanı; proje içinde değişir) |
| Ekolayzır/kompresör sayısal ayarı | Desteklenmiyor (modül aç/kapa "Ses Stüdyosu → Gelişmiş"te) |
| Ses/fon dengesi, giriş-çıkış yumuşatma, ducking | Destekleniyor |
| Müzik klasörü / müzik yükleme | **Bilinçli olarak yok** |
| Favoriler | Destekleniyor (genel, yerel) |
| 9:16/16:9/1:1, platform, arka plan, altyazı, başlık | Destekleniyor |
| 1080p/4K, FPS, video kalitesi | Desteklenmiyor (motor 1080p·30 fps sabit) |
| Varsayılan geçişler, yazı stilleri | Desteklenmiyor (video motorunda geçiş/stil seçimi yok) |
| Teleprompter hızı, yazı boyutu, satır aralığı, otomatik kaydırma, geri sayım | Destekleniyor (hız ayrıca proje başına saklanır) |
| Otomatik kaydetme | Her zaman açık (bilgi olarak gösterilir) |
| Yedekleme / geri yükleme | Destekleniyor (tek proje + tüm çalışmalar, ses içermez) |
| Belirli klasöre otomatik kaydetme | Desteklenmiyor (tarayıcı güvenlik modeli; güvenilir depolama düzeniyle birlikte planlanıyor) |
| Açık/koyu tema, yazı boyutu, sol menü daraltma, açılış ekranı | Destekleniyor (tema: sistem/koyu/açık) |
| Serbest panel düzeni | Desteklenmiyor (yalnızca menü daraltma) |

**Doğrulama:** Node birim testleri (ayar doğrulama/göç/saklama/genel–proje ayrımı, iki temada WCAG AA kontrast, tüm-çalışma yedeği): web 66/66. Gerçek Edge'de (sahte mikrofonla) 8 bölümün hepsi koyu ve açık temada `axe` temiz; 320/390/768/1280 px'te yatay taşma yok; tam akış (Yeni video → şiir → fon → kayıt → dinle → kütüphane/arama/kayıtlar → ayarların etkisi → yeniden açılışta açılış ekranı → tüm veriyi silince ayarların sıfırlanması) 129/129. Bulunan ve düzeltilen gerçek hatalar: dar ekranda menü şeridinin sayfayı 1449 px'e genişletmesi, başlık sırası atlamaları, favori düğmesi erişilebilir adı, segment düğmelerinin sarmaması.

**Sürüyor / bekliyor:** Faz 2 (şiir kütüphanesine kategori/etiket, dosyadan şiir içe aktarma), Faz 3 (ses stüdyosunda deneme yönetimi: yeniden adlandırma, notlar), Faz 4 (video editörü entegrasyonu: görsel/sahne ekleme, zaman çizelgesi; **kullanıcının mevcut video editörü kodu henüz incelenmedi**, o inceleme yapılmadan entegrasyon planlanmadı). "Tek projede birden çok fon müziği" henüz yok (`Project.trackId` tek değer). Kullanıcı cihaz/göz testi bekliyor: yeni panelin gerçek kullanımda sade/yorucu olmadığı, açık temanın kulakla/gözle kalitesi, dar menü.

### Son aşama — Kullanıcı hesabı ve bulut saklama (gerekirse)
- **Yapılacak:** Kimlik doğrulama, `ownerId` bağlama, yerel çalışmaların hesaba taşınması, bulut depolama ve silme politikası.
- **Kabul:** Anonim kullanıcı yerel çalışmasını hesaba bağlayabilir; mevcut veri bozulmaz.
- **Riskler:** KVKK yükümlülükleri, maliyet, destek yükü.
- **Test:** Taşıma (migration) ve yetkilendirme testleri.

---

## 11. Teknik mimari önerisi

### 11.1 Mevcut yapı

Klasör boş; **yeniden kullanılacak mevcut bileşen yoktur.** MustafaÖner.net'ten bileşen/kod alınmaz. Tasarım dili tutarlılığı isteniyorsa tasarım değerleri (renk, yazı tipi) elle ve bağımsız olarak taşınabilir.

### 11.2 Önerilen yığın (hepsi “doğrulanacak”)

> Aşağıdaki her öneri için **güncel sürüm, bakım durumu, lisans ve tarayıcı desteği paket kurmadan önce yeniden doğrulanmalıdır.** Bu planda hiçbir şey kurulmamıştır.

| Katman | Öneri | Neden / Not |
|---|---|---|
| Ön yüz | TypeScript + React (Vite) veya Next.js | SPA yeterli; SEO ihtiyacı yalnızca tanıtım sayfası için → statik. **Onaylı: React + Vite (SPA).** |
| Stil | CSS Modules veya Tailwind | Hafif, mobil öncelikli |
| Durum | Hafif store (ör. Zustand) | Kayıt durumu makinesi için; alternatif: kütüphanesiz React reducer |
| IndexedDB | `idb` (küçük sarmalayıcı) | Ham IndexedDB API'si zahmetli; **kütüphanesiz de yapılır** |
| Ses (istemci) | **Kütüphanesiz**: Web Audio API, AudioWorklet, OfflineAudioContext | Gerekli tüm işlevler platformda mevcut |
| WAV kodlama | **Kütüphanesiz** (basit PCM başlığı) | |
| MP3 kodlama (istemci) | Gerekirse `lamejs` benzeri; **bakım durumu zayıf olabilir** | Önce sunucuda ffmpeg ile; istemci MP3 ikinci seçenek |
| Sunucu | Node.js (Fastify/Express) + **ffmpeg** | Miks, kodlama, normalleştirme, `sidechaincompress` |
| İş kuyruğu | BullMQ + Redis (veya DB tabanlı basit kuyruk) | Video aşamasında yeniden kullanılır |
| Depolama | S3 uyumlu özel (private) bucket + yaşam döngüsü (lifecycle) kuralı | Ham/ön izleme müzik + geçici çıktılar; TTL silme |
| Dağıtım | Konteyner (Docker) barındırma — **sunucusuz (serverless) ortamlar ffmpeg/uzun işlem için uygun olmayabilir** | `siir.mustafaoner.net`'e CNAME |
| Bot koruması | Cloudflare Turnstile veya benzeri | Dışa aktarma ve ön izleme akışında |
| Hız sınırı | Sunucu/CDN katmanında IP + anonim oturum + parmak izi tabanlı | |
| Test | Vitest (birim), Playwright (uçtan uca) | Gerçek cihaz testi ayrıca |
| Gözlem | Hata raporlama (içerik içermeyen) | Ses/metin gönderilmez |

**Kütüphanesiz yapılabilenler:** kayıt, ölçüm, filtre/EQ/kompresör/reverb zinciri (Web Audio), WAV üretimi, IndexedDB erişimi, okuma ekranı, JSON yedek.
**Muhtemelen kütüphane gerektirenler:** MP3 kodlama (istemci), de-esser kalitesi (kendi DSP kodu veya WASM), yüksek kaliteli reverb IR (lisanslı impulse response dosyaları).

### 11.3 Önerilen klasör yapısı (taslak)

```
siir/
├─ SIIR-STUDYOSU-KURGU-VE-TEKNIK-PLAN.md
├─ apps/
│  ├─ web/                    # ön yüz (stüdyo arayüzü)
│  │  └─ src/
│  │     ├─ app/              # yönlendirme, düzen
│  │     ├─ features/
│  │     │  ├─ workspace/     # çalışma listesi, yeni çalışma
│  │     │  ├─ lyrics/        # metin editörü, okuma ekranı
│  │     │  ├─ catalog/       # müzik seçim arayüzü
│  │     │  ├─ recorder/      # kayıt ekranı
│  │     │  ├─ mixer/         # miks ekranı
│  │     │  └─ export/        # dışa aktarma
│  │     ├─ audio/            # ses servisleri (aşağıda)
│  │     ├─ storage/          # IndexedDB katmanı
│  │     ├─ shared/           # ortak bileşen, i18n, hata
│  │     └─ worklets/         # AudioWorklet işlemcileri
│  └─ api/                    # sunucu (miks/katalog/indirme)
│     └─ src/
│        ├─ routes/           # katalog, ön izleme akışı, export
│        ├─ jobs/             # miks işleri
│        ├─ services/         # ffmpeg, depolama, kota, bot koruması
│        └─ cleanup/          # süpürme/TTL
├─ packages/
│  ├─ contracts/              # ortak tipler ve şemalar (Project, Recipe, ExportBundle…)
│  └─ catalog-tools/          # kataloğa parça ekleme/doğrulama betikleri (yalnızca geliştirici)
├─ catalog/
│  ├─ tracks.json             # katalog kayıtları (kamuya kapalı kısımlar sunucuda)
│  └─ licenses/               # lisans kanıtları (özel depo; herkese açık yayınlanmaz)
│  └─ video-worker/           # (Aşama 6; ilk sürümde boş/yok) bağımsız video işçisi
└─ docs/
```

> Onaylı: web, API ve (ileride) video işçisi **aynı monorepo içinde ayrı uygulamalardır**; her biri kendi paketi ve dağıtım birimiyle bağımsızdır, yalnızca `packages/contracts` üzerinden konuşur. Lisans kanıtları, orijinal müzikler ve tam kaliteli dosyalar **kod deposuna konmaz**; ayrı ve özel depolamada tutulur (repoda yalnızca kimlik/yol referansı ve lisans meta verisi bulunur). Mimari tek barındırma sağlayıcısına bağımlı olmaz: depolama S3 uyumlu arayüz, kuyruk ve konteyner standart Docker üzerinden soyutlanır; sağlayıcı ve bütçe prototip testlerinden sonra seçilir.

### 11.4 Veri modelleri (TypeScript benzeri)

```ts
// Gelecekte hesap eklemek için ownerId şimdiden vardır (null = anonim)
type Project = {
  id: string;                 // UUID, yerel üretilir
  schemaVersion: number;
  ownerId: string | null;     // gelecekteki userId
  anonymousSessionId: string; // cihaza özgü rastgele kimlik
  title: string;
  poet: { name: string; slug?: string };
  reader: { name: string };
  text: PoemText;
  trackId: string | null;     // katalog kimliği
  takes: Take[];
  primaryTakeId: string | null;
  recipe: MixRecipe;
  createdAt: string; updatedAt: string;
  status: "draft" | "recorded" | "mixed" | "exported";
  sync: { state: "local-only" | "synced"; remoteId?: string }; // gelecek
};

type PoemText = {
  raw: string;
  stanzas: { id: string; lines: { id: string; text: string }[] }[];
};

type Take = {
  id: string; projectId: string; createdAt: string;
  durationMs: number; sampleRate: number; channels: 1 | 2;
  audioChunkIds: string[];    // IndexedDB parça kimlikleri
  inputDeviceLabel?: string;
  latencyEstimateMs?: number;
  peakDbfs?: number; clipped?: boolean;
};

type MixRecipe = {
  atmosphere: AtmosphereId; atmosphereAmount: number; warmth: number; clarity: number;
  voiceGainDb: number; musicGainDb: number;
  music: { startOffsetSec: number; cutAtSec?: number; fadeInSec: number; fadeOutSec: number };
  ducking: { enabled: boolean; amountDb: number; attackMs: number; releaseMs: number; keepGaps: boolean };
  alignmentOffsetMs: number;
  loudness: { targetLufs: number; truePeakDb: number };
  lineTimings?: LineTiming[]; // otomatik/elle
};

type LineTiming = { lineId: string; startMs: number; endMs: number };

type TrackPublic = {            // istemciye giden alt küme
  id: string; title: string; artist: string; cover: string;
  durationSec: number; genre: string; mood: string[]; tempoBpm: number;
  attributionRequired: boolean; attributionText?: string;
  previewStreamUrl?: never;     // oturum başına imzalı adres sunucudan istenir
};

type ExportJob = {
  id: string; anonymousSessionId: string; ownerId: string | null;
  projectId: string; recipeHash: string;
  format: "wav" | "mp3";
  state: "waiting" | "preparing" | "completed" | "failed";
  createdAt: string; expiresAt: string; // TTL
  errorCode?: string;
};
```

`ownerId` alanları ve `anonymousSessionId` yapısı, hesap eklendiğinde veri şemasını kırmadan “sahiplik” bağlanmasını sağlar.

### 11.5 Ses servisleri (istemci)

| Servis | Sorumluluk |
|---|---|
| `DeviceService` | Cihaz listesi, izin durumu, cihaz değişimini dinleme (`devicechange`) |
| `MicCaptureService` | `getUserMedia`, AudioWorklet PCM yakalama, parçalı çıktı, akışı kapatma |
| `LevelMeterService` | RMS/tepe/clipping, arayüze akış |
| `CountdownService` + `PlaybackClock` | Geri sayım, müzik/kayıt zaman damgası eşleme |
| `PreviewPlayer` | Düşük kaliteli müzik + ses ön izleme miksi |
| `ProcessingChain` | Tarif → Web Audio/Offline grafiği (HPF, gate, EQ, comp, de-ess, reverb) |
| `AutoDuckAnalyzer` | Ses zarfı, ducking eğrisi, sessizlik/kıta tespiti |
| `Loudness` | LUFS ölçümü ve normalleştirme |
| `Encoder` | WAV (istemci), MP3 (sunucu, gerekirse istemci) |
| `ExportClient` | Recipe + ses yükleme, iş durumu sorgulama, indirme |

### 11.6 Yerel saklama katmanı

IndexedDB: `projects`, `takes`, `audioChunks`, `settings`, `meta(schemaVersion)`. Her işlem `StorageRepository` arayüzü arkasında; ileride bulut katmanı aynı arayüze eklenir. Şema sürümleme ve migration, silmede kademeli temizleme (proje → deneme → parça).

### 11.7 Fon müziği katalog yapısı (sunucu)

- `catalog/tracks.json` + özel depolama; **derleme zamanı doğrulama** (lisans alanları eksik/`placeholder` → üretimde hata).
- API: `GET /catalog` (yalnızca `TrackPublic`), `POST /preview-session` (parça için kısa ömürlü, oturuma bağlı akış belirteci), `POST /exports` (recipe + ses).
- **Hiçbir uç nokta ham müzik dosyasını döndürmez.**

### 11.8 Dışa aktarma akışı (özet)

1. İstemci: ses işleme (kuru kayıt → temizlenmiş şiir sesi) + recipe oluşturur.
2. İstemci: Turnstile + onay → `POST /exports` (işlenmiş ses + recipe); sunucu boyut/süre/biçim doğrular (kontrolsüz yükleme olmasın: **yalnızca bu uç nokta ses kabul eder, yalnızca oturum belirteci + bot doğrulamasıyla, sert boyut/süre/MIME sınırıyla, yalnızca ses; hiçbir uç nokta müzik kabul etmez**).
3. Kuyruk: ffmpeg ile miks (tam kaliteli müzik, ducking, fade, limiter, kodlama).
4. Çıktı özel depoya yazılır → kısa ömürlü imzalı indirme adresi.
5. İndirme sonrası veya TTL dolunca yükleme + çıktı silinir; iş kaydı kişisel içerik taşımaz (yalnızca durum/özet).

---

## 12. Riskler

| # | Risk | Etki | Önlem |
|---|---|---|---|
| 1 | **Mikrofon gecikmesi** | Müzik/ses kayması | Zaman damgası + zamanlama kaydırma + otomatik telafi; ölçüm Aşama 0'da |
| 2 | **Bluetooth kulaklık gecikmesi** | Büyük (150–300 ms+) kayma, mikrofon açılınca ses kalitesi düşer | Kablolu önerisi, algılanırsa uyarı, manuel kaydırma |
| 3 | **Mobil Safari sınırlamaları** | AudioContext askıya alma, arka planda kayıt kesilmesi, depolama temizliği, format farkları | Kullanıcı hareketiyle başlat, ekran açık tut (wake lock), parçalı kayıt, erken gerçek cihaz testi |
| 4 | **Uzun kayıt bellek tüketimi** | Çökme | Parça parça IndexedDB; bellekte birikim yok; süre üst sınırı |
| 5 | **Tarayıcı kapanması** | Kayıt kaybı | Parçalı yazım, kurtarma, `beforeunload` |
| 6 | **Bozulma ve clipping** | Kullanılmaz kayıt | Seviye ölçer, uyarı, float/24-bit kayıt, limiter, giriş kazancı önerisi |
| 7 | **Fazla yankı** | Anlaşılmayan şiir | Sınırlı varsayılanlar, düşük frekanslı reverb kesimi, ıslak oran üst sınırı, dinleme testi |
| 8 | **Fon müziği lisansı** | Hukuki/ticari risk, hesap kapatma | Katalog doğrulama, çok boyutlu izinler, kanıt, SaaS/UGC onayı, hukuki inceleme |
| 9 | **Content ID bildirimi** | Kullanıcı videosuna/sesine itiraz | Content ID'siz/muaf parçalar, kayıt tutma, kullanıcıya bilgi metni, hızlı pasifleştirme |
| 10 | **Ham müziğin dışarı çıkarılması** | Telif ihlali, lisans ihlali | Tam kalite hiç tarayıcıya gitmez; düşük kaliteli, imzalı ve kısa ömürlü akış; hız sınırı; fakat bkz. aşağı |
| 11 | **Girişsiz sunucu dosya yazımı** | Depolama doldurma, kötüye kullanım, yasadışı içerik | Tek yükleme ucu, sert sınırlar, hız sınırı + günlük kota + bot koruması, TTL silme, ses dışı içerik reddi, kota izleme |
| 12 | **Format desteği farkları** | Dosya çalmama | Sunucuda standart çıktı (WAV PCM, MP3), istemci yedek MIME tespiti (`isTypeSupported`) |
| 13 | **Diğer sitelerin etkilenmesi** | — | Bağımsız repo/dağıtım; ana site koduna dokunulmaz; yalnızca DNS kaydı eklenir |

**Risk 10 — açık not:** Web ortamında **%100 kopyalama engeli mümkün değildir.** Tarayıcıya ulaşan her ses (düşük kalite ön izleme dahil) kayda alınabilir; ekran/ses yakalama araçları veya ağ trafiği ile elde edilebilir; şifreli ortam uzantıları (EME/DRM) kalıcı çözüm olmadığı gibi bu tür ürün için orantısız karmaşıklık getirir. Ayrıca **nihai çıktı müzik içerir**; kullanıcı bu çıktıdan müziği ayıklamaya çalışabilir (kaynak ayırma araçlarıyla). Hedef: *kolay* kopyalamayı ve toplu çekmeyi önlemek, ham dosyayı hiç sunmamak, ve hukuki olarak kullanım şartlarıyla (müziğin yalnızca şiir kaydıyla birlikte kullanılabileceği) yasaklamak. Tüm bunlar “caydırıcılık” seviyesindedir; lisansın bu riski kapsaması bu yüzden önemlidir.

**Risk 11 — ek:** İzinsiz içerik yüklemeyi önlemek için sunucu uygulamada yüklenen sesin yalnızca beklenen biçimde ve boyutta olduğunu doğrular; metin/ses içeriğini **ayrıca saklamaz**; kötüye kullanım bildirimi iletişim yolu (şikâyet/kaldırma) kamu sürümünde bulunur.

---

## 13. Test planı

### 13.1 İşlevsel senaryolar (masaüstü ve mobil)

| Senaryo | Beklenen |
|---|---|
| Mikrofon izni reddedildi | Açık mesaj, tarayıcı ayarına yönlendirme adımları, “tekrar dene”; kayıt başlamaz |
| Mikrofon bulunamadı | “Cihaz bulunamadı” + bağlama önerisi; akış bozulmaz |
| Kayıt sırasında cihaz değişti/çıkarıldı | O ana kadarki kayıt korunur; uyarı; yeni cihazla devam seçeneği |
| Uzun şiir kaydı (ör. 30–60 dk) | Bellek sabit, arayüz akıcı, kayıp yok, kota uyarısı çalışır |
| Fon müziği seçilmedi | Yalnız ses kaydı/dışa aktarma çalışır; Müziksiz çıktı **tarayıcıda yerelde** üretilir ve sunucuya hiçbir şey gönderilmez (WAV mono 24-bit; MP3 için istemci kodlayıcı Aşama 0'da doğrulanır, doğrulanamazsa yalnızca bu durumda sunucu kodlaması ve aynı açık bilgilendirme kullanılır) |
| Fon müziği seçildi | Kulaklıkta çalar, kayda karışmaz (kulaklıkla), ön izleme ve miks tutarlı |
| Birden fazla deneme | Denemeler ayrı saklanır, ana deneme seçimi, silme doğru deneme siler |
| Sayfa yanlışlıkla kapatıldı | Uyarı; açılışta kurtarma; son parçaya kadar veri |
| WAV indirme | Dosya açılır, doğru süre/biçim, dosya adı kuralı |
| MP3 indirme | ID3 etiketleri, doğru bit hızı, tarayıcılarda çalar |
| Sunucu hatası/zaman aşımı | Anlaşılır hata, yeniden deneme, yerel veri kaybolmaz |
| Kota/hız sınırı aşımı | Açıklayıcı mesaj, ne zaman tekrar denenebileceği |

### 13.2 Platform matrisi

| Ortam | Kapsam |
|---|---|
| Chrome (masaüstü), Edge | Tam akış |
| Safari (macOS) | Tam akış, ses bağlamı davranışı |
| Safari iOS, Chrome Android, diğer mobil | Tam akış + arka plana alma, ekran kilidi, wake lock, depolama |
| 390 px / 1280 px | Yerleşim, dokunma hedefleri (≥ 44 px), okuma ekranı |
| Klavye ve erişilebilirlik | Tam klavye ile kayıt/durdurma/dışa aktarma, odak sırası, `aria-live` durum bildirimleri, ekran okuyucu, kontrast, hareket azaltma |

### 13.3 Ses kalitesi ve güvenlik testleri

- **Nesnel:** LUFS/tepe ölçümü; clipping yokluğu; sentetik sinyalle zincir doğruluğu; ducking zarfı doğruluğu; ön izleme–sunucu miksi **parite** (seviye ve zamanlama farkı eşiğin altında).
- **Öznel:** Farklı ses/mikrofon örnekleriyle atmosfer dinleme testi (anlaşılırlık kontrol listesi).
- **Güvenlik:** Ham müziğe doğrudan erişim denemeleri (yol tahmini, ön izleme belirteci yeniden kullanımı/süresi dolmuş), müzik kabul eden bir uç nokta olmadığının doğrulanması, aşırı boyutlu/yanlış biçimli yükleme, hız sınırı atlatma, TTL silme doğrulaması, katalog doğrulamasının `placeholder`/eksik lisans kaydını reddettiği.
- **Gizlilik:** “Dışa aktar” dışında hiçbir ses/metin ağ isteği gitmediğinin (ağ izleme ile) doğrulanması.

---

## 14. Kötüye kullanım önleme (anonim platform için)

- **Hız sınırı:** IP + anonim oturum başına dakikalık/saatlik istek sınırı (ön izleme oturumu, dışa aktarma).
- **Günlük işlem sınırı:** Anonim oturum/IP başına günlük dışa aktarma sayısı ve toplam işlem süresi (onaylı: **cihaz/IP başına günde 10 dışa aktarma, kayıt başına en fazla 15 dk**). “Cihaz” anonim oturum kimliğiyle, IP ile birlikte değerlendirilir; kimlik sıfırlanarak atlatmaya karşı IP sınırı da bağımsız uygulanır. Sınır aşımında kullanıcıya ne zaman tekrar deneyebileceği söylenir.
- **Bot koruması:** Dışa aktarma ve ön izleme oturumu başlatmada Turnstile benzeri doğrulama.
- **Boyut/süre/format sınırı:** Sunucu tarafında zorunlu (istemciye güvenilmez).
- **Kuyruk koruması:** Eşzamanlı iş sınırı, oturum başına tek aktif iş.
- **Ön izleme akışı koruması:** Kısa ömürlü imzalı belirteç, oturuma bağlı, yeniden kullanımı sınırlı; toplu çekme tespiti.
- **İzleme:** İçerik içermeyen ölçümler (iş sayısı, süre, hata).
- **Gelecek:** `userId` eklendiğinde sınırlar kimlik başına farklılaştırılabilir (aynı sınır motoru).

---

## 15. Gelecekteki video üretimine hazır altyapı (ilk sürümde kod yazılmaz)

### 15.1 Modül sınırları

- **Ses modülü** (`apps/web` ses özellikleri + `apps/api` miks servisi) → çıktısı **`ExportBundle`**.
- **Video modülü** (`video/`, bağımsız) → yalnızca `ExportBundle` tüketir; ses modülünün iç yapısını bilmez. Ses modülü video modülü olmadan çalışır.
- Ortak ilişki: `packages/contracts` içindeki şemalar, sürümlü (`bundleVersion`).

### 15.2 Entegrasyon verisi: `ExportBundle`

```ts
type ExportBundle = {
  bundleVersion: 1;
  projectId: string;
  ownerId: string | null;
  audio: {
    masterAudioRef: string;      // temizlenmiş + mikslenmiş ana ses (geçici depolama referansı)
    format: "wav";
    sampleRate: number; durationMs: number; loudnessLufs: number;
  };
  poem: { title: string; text: string; stanzas: PoemText["stanzas"] };
  timings: LineTiming[];          // satır/bölüm zamanlamaları
  captions: CaptionCue[];         // altyazı verisi
  music: {
    trackId: string | null; title?: string; artist?: string;
    license: { type: string; attributionRequired: boolean; attributionText?: string;
               allowsSocialMediaUse: boolean; allowsCommercialUse: boolean; evidenceRef: string };
  };
  credits: { poet: string; reader: string };
  coverImageRef?: string;
  studio: { atmosphere: AtmosphereId; recipe: MixRecipe }; // seçilen atmosfer ve ses ayarları
  video: {
    orientation: "portrait" | "landscape" | "square"; // 9:16, 16:9, 1:1
    targets: ("tiktok" | "reels" | "youtube")[];
  };
};

type CaptionCue = { startMs: number; endMs: number; text: string; lineIds: string[] };
```

> **Not:** Video modülü, ham müziğe de ihtiyaç duymaz — nihai miks ses zaten müzik içerir. Böylece ham müzik video tarafında da korunur. Video için ayrı müzik katmanı gerekirse bu **sunucu içi** yapılır, istemciye ham müzik verilmez.

### 15.3 Video modülü hedefleri (sonraki aşama)

- Zamanlanmış altyazı üretimi (şiir metni + `timings`).
- Görsel/video sahneleri ekleme (lisanslı/yüklenen görsel politikası ayrıca belirlenecek; **bu müzik yükleme yasağından bağımsız bir karardır**).
- 9:16, 16:9, 1:1 çıktılar; TikTok/Reels/YouTube için MP4 ön ayarları.
- **Arka plan görev sistemi:** durumlar `waiting → preparing → completed | failed`; ilerleme sorgulama; yeniden deneme; iptal.
- **Geçici dosya silme:** ses/video/ara dosyalar TTL ile silinir; iş kaydı içerik taşımaz.

```ts
type VideoJob = {
  id: string; bundleRef: string; ownerId: string | null; anonymousSessionId: string;
  state: "waiting" | "preparing" | "completed" | "failed";
  progress?: number; outputRef?: string; expiresAt: string; errorCode?: string;
};
```

İlk sürümde bu tipler yalnızca sözleşme olarak dokümante edilir; video kodu yazılmaz.

---

## 16. Onaylanan kararlar

Aşağıdaki kararların tamamı proje sahibi tarafından onaylanmıştır; **açık soru kalmamıştır.** Bu belgenin diğer bölümleri bu kararlarla uyumlu hale getirilmiştir. Kararlar değişirse önce bu bölüm, sonra ilgili bölümler güncellenir.

### 16.1 Teknoloji, yapı ve barındırma
- [x] **Teknoloji:** TypeScript + React/Vite + Node/Fastify API + FFmpeg + Docker.
- [x] **Proje yapısı:** Web, API ve ileride eklenecek video işçisi aynı monorepo içinde **ayrı uygulamalar** (`apps/web`, `apps/api`, `apps/video-worker`).
- [x] **Barındırma:** Konteyner ve arka plan görevlerini destekleyen sunucu. Sağlayıcı ve bütçe **prototip (Aşama 0) testlerinden sonra** belirlenir. Mimari tek sağlayıcıya bağımlı olmaz (Docker, S3 uyumlu depolama arayüzü, sağlayıcıdan bağımsız kuyruk).
- [x] **Depolama:** Lisans kanıtları, orijinal müzikler ve tam kaliteli dosyalar ayrı ve özel depolamada; her parçanın lisans kaydı vardır.

### 16.2 Fon müziği
- [x] **Kaynak:** Yalnızca bize ait, özel üretilmiş veya platform kullanımına yazılı olarak izin verilmiş müzik. Pixabay/Mixkit varsayılan kaynak değildir.
- [x] **Açılış:** İlk sürüm **12 fon müziğiyle** açılır; farklı duygu ve atmosferleri kapsar (katalog hedef dağılımı: sakin, hüzünlü, umutlu, dramatik/sinematik, nostaljik, doğa/ferah vb.; en az her ana duygu için bir parça).
- [x] **Güvenlik:** Kullanıcı müzik yükleyemez, ham fonları indiremez. Tam kaliteli müzik özel depolamada; tarayıcıya yalnızca korumalı, düşük kaliteli ön izleme.
- [x] **Hukuki inceleme:** Halka açılmadan önce müzik lisansları, kullanım koşulları, gizlilik ve KVKK metinleri uzman kontrolünden geçer. **Prototip geliştirmesini engellemez**; halka açılış (yayın) için zorunlu kapıdır (bkz. 16.7).

### 16.3 Sunucu işleme, gizlilik ve sınırlar
- [x] **Sunucu işlemesi:** Nihai yüksek kaliteli miks için ses kaydı geçici olarak sunucuya gönderilebilir; kullanıcıya **işlemden önce açık bilgi** verilir.
- [x] **Geçici dosyalar:** Yüklenen ses en fazla **1 saat**, oluşturulan çıktı en fazla **30 dakika** tutulur; işlem sonrası mümkün olan en kısa sürede silinir.
- [x] **Kullanım sınırı:** Cihaz/IP başına günlük **10 dışa aktarma**; kayıt başına en fazla **15 dakika**.
- [x] **Analitik:** Şiir metni, ses kaydı veya üretilen içerik analiz edilmez; yalnızca içerik içermeyen kullanım ve hata ölçümleri tutulur.
- [x] **Kullanıcı erişimi:** Halka açık, üyeliksiz; çalışmalar varsayılan olarak kullanıcının cihazında saklanır.
- [x] **Gelecekte üyelik:** Veri modelleri isteğe bağlı `userId`/`ownerId` destekler.

### 16.4 Ses ve dosya biçimleri
- [x] **WAV:** Mikrofon kaydı 48 kHz, 24-bit, mono; fonla birleştirilmiş nihai WAV 48 kHz, 24-bit, stereo.
- [x] **MP3:** 192 kbps stereo.
- [x] **Ses seviyesi:** Hedef −16 LUFS, gerçek tepe sınırı −1 dBTP.
- [x] **Proje yedeği:** Yalnızca proje bilgilerini içeren JSON. Ham fon müziği veya ses paketli ZIP yoktur.

### 16.5 Dil ve tasarım
- [x] **Dil:** İlk sürüm Türkçe; metinler baştan çeviri anahtarlarıyla (i18n) tutulur, başka diller sonradan eklenebilir.
- [x] **Tasarım:** Bağımsız, sıcak, sanatsal ve profesyonel bir görsel kimlik. MustafaÖner.net ile yalnızca ince bir marka bağlantısı (ör. altbilgide “Mustafa Öner'in şiir alanı” bağlantısı); ana sitenin kodu, bileşenleri veya sayfaları kullanılmaz/değiştirilmez.

### 16.6 Video ve alan adı
- [x] **Video altyapısı:** Video şimdi kodlanmaz; ses çıktısı, şiir metni, satır zamanlamaları, altyazı ve görsel format bilgileri video işçisine aktarılabilecek modül sınırları (`ExportBundle`, bölüm 15) hazırlanır.
- [x] **Video formatları:** Gelecekte 9:16, 16:9 ve 1:1 MP4.
- [x] **Alan adı:** Hazır olduğunda yalnızca `siir.mustafaoner.net` için **yeni bir DNS kaydı** eklenir. MustafaÖner.net'in mevcut koduna ve sayfalarına (yasal sayfalar, yasal URL'ler, yönlendirmeler dahil) dokunulmaz.

### 16.7 Kararlardan türeyen uygulama kuralları
- **Yayın kapıları (halka açılmadan önce zorunlu):** (1) 12 parçanın tamamında lisans kaydı + kanıt dosyası + dört izin alanı `true`; (2) uzman kontrolünden geçmiş müzik lisansı, kullanım koşulları, gizlilik ve KVKK metinleri; (3) TTL silme ve hız/günlük sınır testlerinin geçmesi; (4) `placeholder` parça kalmaması. Prototip ve geliştirme ortamları bu kapılar olmadan çalışabilir ama halka açılamaz.
- **Müziksiz çıktı yerelde üretilir** (WAV: sunucuya hiçbir şey gitmez). MP3 için istemci kodlayıcısı Aşama 0'da doğrulanır; doğrulanamazsa yalnızca MP3 için sunucu kodlaması kullanılır ve aynı açık bilgilendirme gösterilir.
- **Müzikli çıktı daima sunucuda** mikslenir (tam kaliteli fon yalnızca sunucuda okunur).
- **Cihaz/IP sınırı:** anonim oturum kimliği + IP birlikte; ikisi de bağımsız sınır uygular.
- **Barındırma bağımsızlığı:** Depolama (S3 uyumlu), kuyruk ve yapılandırma soyut arayüzler arkasında; sağlayıcıya özgü SDK doğrudan iş mantığına girmez.

---

## 17. Önerilen ilk kodlama adımı

**Aşama 0 — “Ses Teknolojisi Doğrulama” (atılabilir prototip, ürün değil).** Küçük, tek sayfalık bir deneme:

1. Mikrofon izni, cihaz listesi ve cihaz değişimi olayı.
2. AudioWorklet ile PCM yakalama + canlı seviye/clipping göstergesi.
3. 5 dakikalık kaydın parçalı biçimde IndexedDB'ye yazılması; bellek davranışının ölçülmesi.
4. Kaydı geri çalma ve WAV olarak indirme.
5. Müzik zaman damgası ile ses zaman damgasından gecikme ölçümü (kablolu ve Bluetooth).
6. Sentetik ses + sentetik müzik ile sunucuda **ffmpeg** miks denemesi (ducking, fade, normalleştirme) ve istemci ön izlemesiyle karşılaştırma.
7. Chrome/Edge/Safari (macOS+iOS)/Android sonuç tablosu.

Bu doğrulama sonuçlarına göre bu plan **gözden geçirilir**; Aşama 1'e Aşama 0 sonuçlarının gözden geçirilip onaylanmasından sonra geçilir (karar listesi bölüm 16'da kapalıdır; barındırma sağlayıcısı ve bütçe bu aşamanın çıktılarıyla belirlenir).

---

*Bu belge bir plandır; hukuki görüş değildir. Tüm kütüphane/sürüm/tarayıcı desteği önerileri ilgili aşamadan önce güncel kaynaklardan doğrulanmalıdır.*
