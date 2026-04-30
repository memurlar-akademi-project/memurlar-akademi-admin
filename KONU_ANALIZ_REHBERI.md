# KONU ANALİZ REHBERİ

Bu dosya, Memurlar Akademi için dokümanları konu import JSON’una çevirirken kullanılacak tek resmi referanstır.

## Ana Kural

Konu import çıktısı **daima structured content** olmalıdır.

Yani:

- `content_blocks` zorunlu
- yalnız `content_body` kabul edilmez
- düz metin dumpı üretilemez

## Temel Beklenti

Konu ayrıştırma işi yalnızca teknik bir dönüştürme değildir.

Beklenen şey:

- dokümanı bir insan gibi okumak
- kullanıcının verdiği bölme kuralını mantıksal olarak uygulamak
- mantıksız ayrımlar yapmamak
- puntolama farkını, kalın-ince hiyerarşisini, başlık seviyelerini ve maddeleme düzenini anlamak
- `A)`, `B)`, `C)`, `a)`, `b)`, `1.`, `2.`, `3 –` gibi yapıların birbirleriyle ilişkisini doğru kurmak
- ortaya kullanıcıya gerçekten çalışılabilir, mantıklı bir konu anlatımı çıkarmak

Bu rehberin amacı sadece JSON üretmek değil, mevzuatı kullanıcıya anlamlı ve düzenli bir çalışma yüzeyi olarak sunmaktır.

Önemli sınırlar:

- metnin hiçbir kelimesi değiştirilemez
- metin özetlenemez
- sorumlu olunmayan bölümler kullanıcı talimatına göre temizlenebilir
- temizlik yapılırken kalan metnin anlam akışı bozulamaz

## Editoryal Düzenleme İlkeleri

Bu iş sadece metni JSON'a çevirmek değildir. Amaç, aynı mevzuatı daha okunabilir ve daha düzenli bir çalışma yüzeyi haline getirmektir.

Bu yüzden ayrıştırma sırasında şu editoryal mantık uygulanır:

- metin korunur, sunum iyileştirilir
- kanun dili yeniden yazılmaz ama ham OCR / satır kırığı / düzensiz akış aynen taşınmaz
- kullanıcıya "ham belge dumpı" değil, mantıklı akışı olan konu anlatımı sunulur

Beklenen editoryal sonuç:

- `KISIM`, `BÖLÜM`, `Madde`, alt başlık ve bent yapıları görsel olarak seçilebilir olur
- aynı seviyedeki öğeler tutarlı biçimde sunulur
- bir üst başlığa bağlı alt metinler birbirinden koparılmaz
- özel bloklar normal paragraf gibi eritilmez

Özel dikkat verilecek yapılar:

- `A)`, `B)`, `C)` gibi harfli bentler
- `1.`, `2.`, `3.` veya `1 –`, `2 –`, `3 –` gibi numaralı yapılar
- yemin metni, cetvel, tablo, istisna listesi, oran listesi gibi yoğun normatif bloklar
- kalın yazılmış kısa satırlarla başlayan alt rejimler

Kural:

- metin değişmez
- yapı daha iyi okunur hale getirilir
- belge hissi korunur
- kullanıcıya mevzuatla uyumlu, sakin ve mantıklı bir okuma akışı verilir

## Kullanım Mantığı

Kullanıcı her doküman için genelde şunu söyler:

- hangi derse ait olduğu
- hangi yapıya göre bölüneceği
  - örn. `KISIM`
  - örn. `BÖLÜM`
  - örn. `Başlık`
- nelerin çıkarılacağı
  - örn. `Geçici maddeler`
  - örn. `Dipnotlar`
  - örn. `Mülga / Ek / Değişik`

Bu talimatlar doğrudan uygulanır. Ekstra yapı uydurulmaz.

Ama bu, mekanik bölme anlamına gelmez.

Kullanıcının verdiği kurallar uygulanırken:

- başlık hiyerarşisi okunur
- hangi satırın başlık, hangisinin alt başlık, hangisinin liste elemanı olduğu anlaşılır
- mevzuat akışı korunur
- yalnızca satır sonuna veya OCR çıktısına bakarak blok kararı verilmez

## Çıktı Standardı

Her zaman şu iskelet kullanılır:

```json
{
  "subject_id": 2,
  "topics": [
    {
      "name": "BİRİNCİ KISIM - GENEL ESASLAR",
      "status": "draft",
      "content_blocks": []
    }
  ]
}
```

## Block Standardı

Kullanılacak ana block tipleri:

- `section_heading`
- `section_title`
- `subheading`
- `article_line`
- `paragraph`
- `alpha_list`
- `ordered_list`
- `table`

## Okunabilirlik Kuralı

Structured veri üretirken amaç sadece doğru import almak değil, aynı zamanda konu çalışma ekranında okunabilir bir içerik üretmektir.

Bu yüzden:

- çok uzun norm metni tek bir `paragraph` içinde bırakılmaz
- anlam bozulmadan doğal satır/paragraf sınırlarından bölünür
- aynı madde içindeki farklı fıkralar mümkünse ayrı `paragraph` blokları olarak verilir
- bentlerden sonra gelen uzun açıklamalar tek parça dump yapılmaz
- hedef paragraf uzunluğu genellikle `70-120 kelime` aralığında tutulur
- `150 kelime` üstüne çıkan bloklar özel olarak kontrol edilir ve doğal kırılım aranır
- `200+ kelime` tek paragraf ancak metinde hiçbir güvenli kırılım yoksa geçici olarak kabul edilebilir; normal çıktı standardı değildir
- `300-500 kelimelik` paragraf veya liste item'ı kabul edilmez
- önce cümle sonlarında bölünür; yetmezse mevzuat dilindeki doğal duraklar olan `;`, `:` ve numaralı/harfli alt yapı geçişleri kullanılır
- tek cümle çok uzunsa ve noktalı virgüllerle bağlı alt hükümler içeriyorsa, metin değiştirilmeden bu noktalı virgül duraklarında okunabilir alt parçalara ayrılır
- uzun bir liste maddesi bölünecekse madde numarası/harfi çoğaltılmaz; aynı liste item'ı içinde iç paragraf kırılımı verilir
- okunabilirlik için yapılan kırılım, `8` maddesini `8, 9, 10` gibi yeni maddelere dönüştüremez ve mevcut sıralamayı değiştiremez

Önemli:

- metin değiştirilemez
- özetlenemez
- sadeleştirilemez
- sadece doğal kırılım noktalarından parçalanabilir
- kırılım metnin anlamını değiştiren yeni cümle üretimi değildir; sadece aynı norm metninin daha okunabilir bloklara ayrılmasıdır

Amaç:

- UI'da çok uzun, nefes almayan paragraf blokları oluşturmamak
- mevzuat metnini daha rahat okunur hale getirmek

## Tipografi ve Hiyerarşi Algısı

Dokümandaki görsel ipuçları anlamsal karar için kullanılır.

Örnek ipuçları:

- kalın / ince farkı
- büyük / küçük başlık yapısı
- ortalı başlıklar
- alt alta gelen numaralı veya harfli diziler
- başlık altında içerden başlayan alt bentler

Kural:

- görsel olarak aynı seviyede duran elemanlar anlamsal olarak da aynı seviyede modellenmelidir
- kalın yazılmış ve yeni bir rejim başlatan satırlar paragraf diye yedirilmez
- içerden başlayan bentler üst başlıkla ilişkili alt yapı olarak modellenir
- yalnızca text içeriğine değil, metnin sunuluş biçimine de bakılarak karar verilir

Amaç:

- kullanıcıya doğal ve düzenli bir konu anlatımı sunmak
- belge yapısını UI'da mümkün olduğunca sadık biçimde korumak

## PDF Sunum Mantığı

İyi bir çıktı, ham DOCX / OCR akışına değil, editoryal olarak düzenlenmiş bir PDF çalışma sayfasına benzemelidir.

Bu mantıkta:

- `KISIM` ve `BÖLÜM` başlıkları belge üst yapısı olarak belirgin kalır
- `Madde` satırı ana giriş noktasıdır
- `A) Memur`, `B) Sözleşmeli personel` gibi yapılar madde altı rejim başlığı olarak okunur
- başlık altında gelen açıklama metni o başlığa bağlı tek akış olarak devam eder
- uzun metinler kullanıcıyı boğmayacak doğal parçalara ayrılır
- yoğun liste yapıları paragraf dumpına çevrilmez

Amaç:

- "kanun metni değişmiş" hissi vermeden
- "ham metin dökülmüş" hissini azaltmak
- kullanıcıya PDF benzeri düzgün bir çalışma yüzeyi üretmek

## Gömülü Alt Bent Kuralı

Bir paragraf içine gömülü çoklu bent veya alt madde yapısı tek paragraf halinde bırakılamaz.

Örnek problemli yapı:

- `a) ... b) ... c) ...`
- `1 – ... 2 – ... 3 – ...`
- `c) ...` altında ayrıca `a), b), c)` diye devam eden alt yapı

Kural:

- harfli yapı ayrı `alpha_list` veya uygun alt bloklara ayrılır
- numaralı yapı ayrı bloklara ayrılır
- paragraf içine gömülü çoklu madde yapısı dump edilmez

Amaç:

- konu çalışma ekranında taranabilir hiyerarşi üretmek
- tek blokta ezilmiş mevzuat yapısını önlemek

## Standardizasyon Kuralı

Aynı seviyedeki mevzuat elemanları aynı görsel ve anlamsal yapıyla üretilmelidir.

Örnek:

- `A) Memur`
- `B) Sözleşmeli personel`
- `C) Geçici personel`

aynı üst yapının parçalarıysa biri `alpha_list`, biri `subheading`, biri düz `paragraph` olamaz.

Kural:

- aynı mantıktaki kardeş elemanlar aynı block ailesiyle verilir
- bir alt bent başlığı içeriden başlatılıp diğeri dışarıda başlatılamaz
- `4 –`, `5 –`, `6 –`, `7 –` gibi numaralı dizilerde bir kısmı düz paragraf, bir kısmı başlık gibi davranmamalıdır

Amaç:

- UI'da tutarlı ritim kurmak
- okuyucuya hiyerarşi kırılması yaşatmamak

## Cümle Bütünlüğü Kuralı

Metin doğal olmayan yerlerden bölünemez.

Örnek hatalı durum:

- bir cümlenin ilk yarısı bir paragrafta
- devamı sonraki paragrafta

Kural:

- paragraf bölme yalnız anlamlı duraklarda yapılır
- satır sonu var diye tek başına paragraf bölünmez
- `... görevli bulunanlardan` ile başlayıp `dışında kalanları kapsar` ile biten yapı tek cümleyse aynı paragrafta kalır

Amaç:

- mevzuat anlam bütünlüğünü korumak
- yapay satır kırılımlarını önlemek

## Devam Parçası Birleştirme Kuralı

OCR veya satır kırığı sebebiyle oluşan küçük devam parçaları ayrı paragraf olarak bırakılamaz.

Örnek:

- önceki paragraf: `"Yemin Belgesi"`
- sonraki paragraf: `ni imzalayarak göreve başlarlar.`

Kural:

- kısa ve tek başına anlamsız kalan devam parçaları önceki paragrafla birleştirilir
- kelime parçalanmışsa yeniden doğal kelime akışına bağlanır
- `eder.`, `kapsar.`, `ni imzalayarak...` gibi tek başına orphan satırlar ayrı block olarak kalmaz

## Gereksiz Paragraf Yasağı

Temizlik veya ayrıştırma sonrası yapay paragraf üretilemez.

Örnek hatalı durum:

- bir başlık temizlenir ama altında kalan kısa satır ayrı paragraf olur
- bir cümle iki satırdan geldiği için iki `paragraph` üretilir
- aynı düşüncenin devamı olan kısa kırık satırlar alt alta ayrı blok olur
- yalnızca satır sonu olduğu için metin `br` yemiş gibi birkaç paragrafa bölünür

Kural:

- ayrı paragraf üretmek için gerçek anlamsal kırılım olmalı
- tek cümlenin devamı olan satırlar tek `paragraph` içinde birleştirilir
- kısa, zayıf, bağlamsız veya tek başına anlam taşımayan satırlar bağımsız paragraf olamaz
- temizlik sonrası kalan metin önceki veya sonraki normatif blokla anlamlı biçimde birleşebiliyorsa birleşmelidir

Amaç:

- UI'da sahte boşluk ve kırık akış üretmemek
- kullanıcıya belgeyi doğal akışında göstermek

## Listeleme Kuralı

Mevzuatta numaralı veya harfli seri yapı varsa bunlar düz paragraf olarak bırakılmaz.

Örnek:

- `1. ... 2. ... 3. ...`
- `a) ... b) ... c) ...`

Kural:

- `1., 2., 3.` gibi yapılar mümkünse `ordered_list`
- `a), b), c)` yapıları `alpha_list`
- `A) Genel şartlar` gibi başlık altında gelen `1, 2, 3...` serileri paragraf dump olmaz
- liste maddesinin kendi içinde alt bent varsa üst yapı ve alt yapı ayrı bloklara bölünür
- ana numaralı seri başladıysa (`1, 2, 3, 4...`) keyfi olarak sıfırlanmaz
- `6` altında `a), b)` gelmesi, `7`nin yeni section olduğu anlamına gelmez
- child list bittikten sonra parent numbering aynı akıştan devam eder
- `6, 7, 8, 9...` gibi ana bentler sırf altında alt bent var diye `subheading` veya bağımsız section'a çevrilmez
- uzun bir bent (`11` gibi) görsel olarak büyük görünse bile semantik olarak hâlâ aynı seviyedeki liste elemanıdır
- ana seri ile alt seri ilişkisi bozulmamalıdır: `8 > a/b/c > 9` akışı korunur, `8 > a/b/c > 1/2` gibi sahte reset yapılmaz

Amaç:

- taranabilirlik
- sınava çalışırken madde madde okunabilirlik
- mevzuattaki ana akışın kullanıcı gözünde bozulmaması

## Liste Sürekliliği ve Nested Yapı

İç içe liste bulunan mevzuat yapılarında asıl hedef sadece parçalamak değil, parent-child ilişkisini korumaktır.

Örnek doğru mantık:

- `1, 2, 3, 4, 5`
- `6`
- `a), b)`
- `7`
- `a), b)`
- `8`
- `a), b), c)`
- `9, 10, 11, 12`

Kural:

- nested yapı varsa parent item görünür kalır, child item'lar onun altına bağlanır
- child item'lar hafif içerden başlayan alt yapı mantığında modellenir
- ana numara ile alt harfli bent arasında sahte başlık üretilmez
- aynı seviyedeki numaralı elemanlar aynı tipografik ağırlıkta kalır
- alt bent var diye ana bent kalın başlık veya yeni kart başlangıcı gibi davranmaz
- UI tarafında `ul/ol/li` mantığına yakın bir hiyerarşi hedeflenir; ama amaç HTML etiketi değil, doğru anlamsal ilişkiyi korumaktır

Amaç:

- kullanıcının “burada neden yeni bölüm açıldı?” hissine kapılmaması
- mevzuatın iç içe yapısının doğal görünmesi
- nested listelerin hafif içerde ama kopmadan görünmesi

## Etiket-Metin Bağlılığı Kuralı

Liste etiketi mümkün olduğunca kendi norm metninden koparılamaz.

Örnek hatalı durum:

- `F)` ayrı bir blok
- altında gelen norm cümlesi başka bir `paragraph`

Kural:

- `A)`, `B)`, `C)`, `F)` gibi tek harfli etiketler gerçekten alt başlık değilse ayrı `subheading` yapılmaz
- bu etiketler bağlı oldukları norm metinle aynı liste yapısı içinde tutulur
- aynı serideki kardeş elemanlar (`D)`, `E)`, `F)`, `G)`) aynı blok mantığıyla modellenir

Amaç:

- UI'da parçalanmış mevzuat hissini önlemek
- kullanıcıya doğal liste akışı göstermek

## Başlık Algılama Kuralı

Bir madde satırından sonra gelen ve yeni bir normatif alt başlık başlatan ifadeler paragraf olarak bırakılamaz.

Örnek:

- `Madde 163 – ...`
- ardından gelen `İstisnai memuriyetlere:`

Bu yapı paragraf değil başlıktır.

Kural:

- yeni bir alt rejimi başlatan etiket satırları `subheading` yapılır
- madde başlığı mülga olduğu için silinmişse altında kalan bir sonraki gerçek başlık doğru maddeye bağlanır
- mülga madde başlığı kalmış ama metin yoksa o başlık da atılır

## Dipnot Referans Temizliği

Dipnot metni temizlenince dipnot referans kalıntıları da temizlenmelidir.

Örnek problemli kalıntılar:

- `201`
- `221`
- `199`
- `222`

özellikle kelime aralarında veya virgül dizilerinde kalan çıplak numaralar

Kural:

- dipnot temizliği sonrası anlam taşımayan çıplak referans numaraları metinde bırakılmaz
- dipnot referansı temizlenince cümlenin kalan yapısı da normalize edilir
- yüzde, oran, madde numarası veya gerçek normatif sayı ile dipnot numarası karıştırılmaz

Amaç:

- anlamsız sayı gürültüsünü temizlemek
- mevzuat metnini okunabilir tutmak

## Boşluk ve Noktalama Normalizasyonu

OCR veya satır kırığı sonrası oluşan boşluk ve noktalama kusurları temizlenmelidir.

Örnek hatalar:

- `zorundadırlar.Devlet`
- `"Yemin Belgesi" ni`
- birden fazla ardışık boşluk
- kelime ile noktalama arasında anlamsız boşluk

Kural:

- cümle sonu noktalamadan sonra eksik boşluk gerekiyorsa eklenir
- tırnak, parantez ve ek birleşmelerindeki kırık boşluklar normalize edilir
- birden fazla boşluk tek boşluğa indirilir
- ancak normatif metin yeniden yazılmaz; yalnızca yazım akışı temizlenir

Amaç:

- insan review'ünü kolaylaştırmak
- UI'da kırık OCR izlerini azaltmak

## Parça Parça Import Önerisi

Uzun mevzuatlarda tek büyük import yerine konu bazlı shard import tercih edilir.

Kural:

- uzun dokümanlarda her `KISIM` için ayrı JSON üretmek tercih edilir
- tek `KISIM` çok uzunsa kendi içinde `BÖLÜM` veya mantıklı madde gruplarına bölünür
- tek review ekranında bakılacak içerik yönetilebilir uzunlukta tutulur

Amaç:

- hatayı daha hızlı yakalamak
- yeniden üretim maliyetini düşürmek
- import review'u daha kullanışlı hale getirmek

## İçerik Sadakati

- metin özetlenmez
- metin yeniden yazılmaz
- madde metni yorumlanmaz
- tarih, sayı, resmi kavramlar korunur
- kullanıcı istemedikçe mevzuat notları çıkarılmaz

## Ek Madde Kuralı

Ek maddeler varsayılan olarak dahil edilir.

Kural:

- `Ek Madde`
- `EK MADDE`
- `Ek Geçici Madde`

başlıklı yapılar otomatik olarak silinmez
- başlıktaki parantez içi mevzuat notları temizlenir
- ek madde altında gerçek norm metni varsa başlık korunur ve metin işlenir
- yalnızca başlık + parantez içi açıklama kalmışsa, yani altında gerçek metin yoksa o ek madde tamamen düşürülür

Örnek:

- `Ek Madde 7 – (...)` ve altında norm metni yoksa: çıkar
- `Ek Madde 8 – (...)` ve altında norm metni varsa: `Ek Madde 8 –` korunur, parantez içi kısım silinir, norm metni alınır

## Boş Blok Yasağı

Temizlik uygulandıktan sonra anlamsız veya boş kalan yapılar JSON'a konulmaz.

Örnek:

- sadece başlığı kalmış ama altında içerik kalmamış `subheading`
- yalnızca `Madde 213 –` etiketi kalmış ama norm metni kalmamış `article_line`
- tamamen temizlenmiş `alpha_list` veya boş liste blokları
- yalnızca satır kırığından doğmuş zayıf `paragraph`

Kural:

- temizleme sonrası gerçek içerik kalmıyorsa o blok düşürülür
- boş başlık kartı üretecek yapı bırakılmaz
- mülga olduğu için tamamen boşalan madde/başlık JSON'a yazılmaz

## Tablo Kuralı

Dokümanda tablo varsa:

- tablo düz metne çevrilmez
- satır satır paragraf gibi yazılmaz
- mutlaka `table` bloğu olarak korunur

Yani:

- `headers`
- `rows`

yapısı kullanılır.

Tabloyu text dump'a çevirmek hatalıdır.

## Sık Hata

Yapılmaması gereken en büyük hata:

- dokümanı topic’lere ayırıp içeriği düz `content_body` olarak vermek

Bu hata UI’ı tekrar “düz belge” görünümüne düşürür.

## Son Kontrol

JSON teslim etmeden önce:

1. `content_blocks` var mı?
2. `article_line` gereken yerlerde kullanıldı mı?
3. küçük başlıklar `subheading` oldu mu?
4. tablo varsa `table` olarak korundu mu?
5. çok uzun paragraflar doğal yerlerinden bölündü mü?
6. paragraf içine gömülü bent/madde yapıları ayrı bloklara çıkarıldı mı?
7. aynı seviyedeki elemanlar aynı yapıda mı üretildi?
8. cümle ortasında yapay paragraf bölünmesi var mı?
9. numaralı ve harfli yapılar liste/block olarak mı verildi?
10. dipnot referans kalıntıları temizlendi mi?
11. ek maddelerde başlıktaki parantez içi mevzuat notları temizlendi mi?
12. yalnız başlık kalmış, metni olmayan ek maddeler düşürüldü mü?
13. kullanıcı hangi yapıya göre ayır dediyse gerçekten ona göre mi ayrıldı?
