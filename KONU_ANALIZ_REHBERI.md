# KONU ANALIZ REHBERI

Bu dosya, Memurlar Akademi icin mevzuat ve ders dokumanlarini konu import JSON'una cevirirken kullanilacak tek genel referanstir.

Bu rehber hicbir kanuna, sinava veya dosyaya ozel degildir. Bugun bir kanun, yarin baska bir yonetmelik gelebilir; ayni mantik uygulanir.

## Temel Ilke

Konu analizi bir metin donusturme isi degildir. Isin asil amaci, dokumani bir insan editor gibi okuyup kullaniciya calisilabilir bir konu anlatimi haline getirmektir.

Kesin kurallar:

- Metindeki sorumlu olunan hicbir kelime degistirilemez.
- Mevzuat metnindeki anlamli noktalama korunur; baslik sonundaki `:` gibi kaynak isaretler keyfi olarak dusurulemez.
- Metin ozetlenemez, yorumlanamaz, sadeleştirilemez.
- Kullanici tarafindan cikarilmasi istenen kisimlar temizlenir.
- Temizlikten sonra kalan metin mantik filtresinden gecirilir.
- Bos, anlamsiz, yalniz kalmis veya baglamdan kopmus bloklar uretilmez.
- Sadece kaynak/degisiklik gecmisi anlatan ve gercek normatif metin icermeyen maddeler icerik sayilmaz. Ornegin yalnizca "su kanunun ilgili hukmu olup hukmu kalmamistir" veya benzeri aciklama varsa blok uretilmez.
- Cikti daima structured content olur; yalniz `content_body` veya duz metin dump kabul edilmez.

Basarili cikti, ham OCR/DOCX dokumu gibi degil; mevzuata sadik, duzenli bir konu anlatimi gibi gorunmelidir.

## Zorunlu Is Akisi

Her dokuman icin su sira bozulmaz:

1. Dokumani once bolmeden oku ve ana haritayi cikar.
2. Kullanici hangi kurala gore ayir dediyse onu ana bolme kurali yap.
3. Baslik, madde, alt baslik, liste, tablo ve not yapilarini ayirt et.
4. Kullanici tarafindan cikarilacak kisimlari temizle.
5. Temizlikten sonra kalan metni yeniden mantik kontrolunden gecir.
6. Bloklari structured content olarak kur.
7. Final QA yapmadan JSON teslim etme.

Onemli: Ilk gorulen satir yapisina gore acele blok uretilmez. Once "bu satir dokumanda ne ise yariyor?" sorusu cevaplanir.

## Structured Content V2

Konu anlatimi bir HTML stringi degildir. Cikti, HTML'e render edilebilen semantik bir dokuman agaci gibi davranmalidir.

Kural:

- UI metinden anlam cikarmamalidir.
- Liste etiketi, tablo hucreleri, baslik seviyesi, vurgu ve nested yapilar JSON icinde acikca temsil edilmelidir.
- Yeni importlarda liste elemanlari string olarak verilmez; obje olarak verilir.
- Regex ile `a)`, `1.`, `ğ)` yakalamaya muhtac veri yeni import icin hatalidir.
- Renderer sadece verilen semantik alana gore HTML uretir; metni parse edip yapi tahmin etmez.

Her konu importu su genel yapida olmalidir:

```json
{
  "subject_id": 2,
  "topics": [
    {
      "name": "Konu adi",
      "status": "draft",
      "content_schema_version": 2,
      "content_blocks": []
    }
  ]
}
```

### Blok Tipleri

Kabul edilen ana blok tipleri:

- `section_heading`
- `section_title`
- `heading`
- `subheading`
- `article_line`
- `paragraph`
- `rich_paragraph`
- `list`
- `table`
- `callout`
- `quote`
- `divider`

Legacy bloklar:

- `alpha_list`
- `ordered_list`

Not: `alpha_list` ve `ordered_list` sadece eski importlari bozmamak icin kabul edilir. Yeni uretilen JSON'da liste blogu daima `type: "list"` seklinde olur.

Zorunlu:

- `content_blocks` bos veya duz metin yerine gecen tek dev paragraf olamaz.
- Tablo varsa `table` olarak kalir.
- Liste varsa liste olarak kalir.
- Madde varsa `article_line` ile baslar.

### Inline Metin

Vurgu gerekiyorsa metin HTML olarak verilmez, segment olarak verilir.

```json
{
  "type": "rich_paragraph",
  "segments": [
    { "text": "Bu kisim normal metindir. " },
    { "text": "Bu ifade vurguludur", "bold": true },
    { "text": "." }
  ]
}
```

Kural:

- `<strong>`, `<em>`, `<u>`, `<a>` gibi HTML stringleri uretilmez.
- `bold`, `italic`, `underline`, `href` gibi alanlar kullanilir.
- Kanun metni degistirilmeden korunur; vurgu sadece kaynak dokumanda gercekten varsa veya editoriyal olarak daha sonra sistem tarafindan eklenirse kullanilir.

### Liste Modeli

Yeni liste modeli:

```json
{
  "type": "list",
  "style": "alpha",
  "items": [
    {
      "marker": "a)",
      "blocks": [
        { "type": "paragraph", "content": "Liste elemani metni." }
      ]
    },
    {
      "marker": "b)",
      "blocks": [
        { "type": "paragraph", "content": "Liste elemani girisi:" },
        {
          "type": "list",
          "style": "ordered",
          "items": [
            {
              "marker": "1.",
              "blocks": [
                { "type": "paragraph", "content": "Ic liste elemani." }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

Kural:

- `marker` alani etiketi tutar: `a)`, `A)`, `1.`, `1 -`, `I.`, `ğ)` gibi.
- `blocks` alani liste elemaninin icindeki gercek icerigi tutar.
- Liste elemaninin icinde paragraf, rich paragraph, tablo, callout veya baska liste olabilir.
- Uzun liste elemani gerekiyorsa ayni `marker` altinda birden fazla paragraph bloguna bolunur; yeni liste elemani uydurulmaz.
- Nested liste, parent liste item'inin `blocks` icinde yer alir.
- Liste item'i string olamaz.

`style` degerleri:

- `alpha`
- `ordered`
- `unordered`
- `roman`
- `dash`
- `custom`

### Tablo Modeli

Tablo metne ezilmez. Basit tablo:

```json
{
  "type": "table",
  "caption": "Tablo basligi varsa",
  "headers": ["Sutun 1", "Sutun 2"],
  "rows": [
    ["Hucre 1", "Hucre 2"]
  ]
}
```

Hucre icinde coklu paragraf veya liste gerekiyorsa hucre obje olabilir:

```json
{
  "type": "table",
  "headers": ["Durum", "Aciklama"],
  "rows": [
    [
      "Birinci durum",
      {
        "blocks": [
          { "type": "paragraph", "content": "Hucre icindeki ilk paragraf." },
          {
            "type": "list",
            "style": "ordered",
            "items": [
              {
                "marker": "1.",
                "blocks": [
                  { "type": "paragraph", "content": "Hucre icindeki liste." }
                ]
              }
            ]
          }
        ]
      }
    ]
  ]
}
```

Kural:

- Tablo hucreleri string veya `{ "blocks": [] }` olabilir.
- Hucre icinde liste varsa stringe cevrilmez.
- Tablo basligi varsa `caption` alanina yazilir.

### Yardimci Bloklar

Alinti, not veya ayrac gerekiyorsa paragraf gibi gizlenmez:

```json
{ "type": "quote", "content": "Alinti metni." }
```

```json
{ "type": "callout", "variant": "info", "content": "Kisa not metni." }
```

```json
{ "type": "divider" }
```

Kural:

- Bu bloklar kaynak dokumanda gercekten ayri anlam tasiyorsa kullanilir.
- Sadece gorsel sus icin gereksiz blok uretilmez.

## Dokuman Haritasi

Ayristrmadan once dokumanin iskeleti belirlenir.

Bakilacak yapilar:

- ana kisimlar
- bolumler
- maddeler
- ek maddeler
- gecici maddeler
- alt basliklar
- harfli bentler
- numarali bentler
- tablolar
- dipnotlar ve mevzuat notlari

Kural:

- Kullanici "KISIM'a gore ayir" dediyse konu siniri KISIM olur.
- Kullanici "BOLUM'e gore ayir" dediyse konu siniri BOLUM olur.
- Kullanici farkli bir bolme kurali verdiyse o uygulanir.
- Bolme kurali uygulanirken madde veya liste yapisi kirilamaz.
- Bir konu bitmeden sonraki konunun maddesi onceki konuya yapisamaz.

## Temizlik Kurallari

Kullanici hangi yapilarin cikarilacagini soylerse sadece onlar temizlenir. Kullanici istemedikce normatif metin veya ek madde silinmez.

Tipik temizlenecek yapilar:

- dipnot metinleri
- dipnot referanslari
- kullanicinin istemedigi gecici maddeler
- kullanicinin istemedigi tablolar
- parantez icindeki resmi mevzuat islem notlari

Mevzuat islem notu ornekleri:

- `(Mulga: ...)`
- `(Degisik: ...)`
- `(Ek: ...)`
- `(Aynen kabul: ...)`
- tarih, kanun numarasi, KHK veya madde atfi iceren parantezler

Mevzuat islem notu olmayan normatif parantezler korunur.

Korunacak parantez ornekleri:

- `(ek gosterge dahil)`
- `(aday ... dahil)`
- `(mahalli idareler dahil)`
- `(ceza infaz kurumlari ... dahil)`
- `(A) bendi`, `(B) fikrasi`, `(c) alt bendi` gibi normatif atiflar

Kural:

- Parantez icinde `Mulga:`, `Degisik:`, `Ek:`, `Aynen kabul:`, `Iptal:`, `Yeniden duzenleme:` gibi resmi islem etiketi yoksa otomatik silinmez.
- `dahil`, `haric`, `sakli kalmak kaydiyla`, `bendi`, `fikrasi`, `alt bendi`, `ek gosterge` gibi ifadeler normatif metindir; islem notu sanilip temizlenemez.
- Parantez icinde sadece sayi varsa otomatik dipnot sayilmaz. Hemen ardindan `numarali bent`, `numarali alt bent`, `fikra`, `bent`, `cetvel`, `sirasi` gibi normatif baglac geliyorsa parantez aynen korunur.
- Mevzuat islem notu satirin basinda olup arkasindan norm metin devam ediyorsa sadece islem notu temizlenir, devam eden norm metin korunur.
- Parantez icindeki uc nokta veya benzeri dipnot yeri tutucular temizlenirken hemen ardindan gelen dipnot numarasi da tamamen temizlenir. `(…)10`, `(...)14` gibi yapilardan `0`, `4` gibi artakalan rakam birakilamaz.

Temizlik sonrasi zorunlu kontrol:

- Bir madde sadece baslik ve temizlenmis nottan ibaret kaldiysa dusurulur.
- Bir bent sadece temizlenmis nottan ibaret kaldiysa dusurulur.
- Bir liste elemani temizlendikten sonra sadece `a)`, `b)`, `1.`, `-` gibi marker kaldiysa eleman tamamen dusurulur.
- Temizlik sonrasi yalniz kalan cumle parcasi varsa onceki veya sonraki baglamla birlestirilir.
- Temizlik norm metnini yeniden yazma bahanesi olamaz.
- Kanun numarasi, madde numarasi, oran, tarih veya gercek normatif sayi dipnot sanilip silinmez.
- Normatif metin icindeki tarihler parca parca temizlenemez; `30.4.1992`, `8.4.1929`, `(1.1.1995 ...)` gibi tarihler aynen kalir. Temizlik sonrasi `.1992`, `8..1929`, `1..1995` gibi eksik tarih kaliplari kalite hatasidir ve kaynaga donulup duzeltilir.
- Parantez icindeki mevzuat islem notu temizlenirken temizlik sadece parantez iciyle sinirlidir; kapanis parantezinden sonra gelen `87 nci madde`, `94 uncu madde`, `105 inci maddenin` gibi normatif atif numaralari asla silinmez.
- Temizlik sonrasi `uncu madde`, `inci madde`, `ncı madde`, `nci madde`, `nci maddede`, `ncı maddede`, `nci maddenin`, `ncı maddenin`, `nci fıkra` gibi basinda madde numarasi eksik kalan ifadeler kalite hatasidir; import JSON'u verilmeden once kaynaga donulup numara tamamlanir.
- Liste etiketi ile madde atfi karistirilmaz: `1) 87 nci maddede...` ifadesindeki `1)` liste elemani, `87` ise normatif madde atfidir; ikisi de korunur.

## Madde ve Baslik Butunlugu

Her madde kendi basligi ve kendi metniyle eslesmelidir.

Kural:

- `Madde`, `Ek Madde`, `Gecici Madde` baslangici paragraf icinde kalamaz.
- Madde basligi baska maddenin metnine yapisamaz.
- Bir madde temizlenince sonraki madde onceki maddeye kayamaz.
- Sadece `article_line` kalmis ve altinda gercek metin olmayan madde JSON'a yazilmaz.
- Iki nokta ile biten ve yeni alt rejim baslatan satirlar paragraf icine gomulmez.
- Alt baslik gercekten baslik degilse, sadece etiket diye `subheading` yapilmaz.

Madde kaymasi, eksik madde ve bos madde hatasi kritik hatadir. Bu hatalardan biri varsa cikti hazir sayilmaz.

## Liste ve Hiyerarsi

Mevzuat listeleri paragraf dumpina cevrilemez.

Taniman gereken yapilar:

- `A)`, `B)`, `C)`
- `a)`, `b)`, `c)`
- `1.`, `2.`, `3.`
- `1 -`, `2 -`, `3 -`
- `-` ile baslayan alt maddeler
- ic ice liste yapilari

Kural:

- Ayni seviyedeki ogeler ayni blok ailesiyle verilir.
- Bir liste basladiysa kardes elemanlardan biri paragraf, biri liste olamaz.
- Parent-child iliskisi korunur.
- Ic ice liste duz metne eritilmez.
- Liste elemanlari string degil obje olur; etiket `marker`, icerik `blocks` icinde verilir.
- Parent liste item'inin altindaki liste yine ayni item'in `blocks` icinde yer alir.
- Bir liste elemani icinde tablo varsa tablo o item'in `blocks` icinde `table` olarak kalir.
- Child liste bittiginde ana liste kaldigi yerden devam eder.
- Ana numara ile alt harfli bent karistirilmaz.
- Uzun bir bent sadece uzun diye yeni section sayilmaz.
- Tek basina duran `A)`, `F)` gibi etiketler norm metinden koparilmaz.
- Ayni liste blogunda ayni marker serisi tekrar basliyorsa bu yeni liste akisi demektir. Ornek: `a), b), c)` bittikten sonra tekrar `a), b)` geliyorsa ayni `items` dizisine yapistirilmez; aradaki giris paragrafi korunur ve yeni `list` blogu acilir.
- Liste icinde ust marker ile alt marker ayni satirda gelebilir. Ornek: `G) a) ...` gibi bir yapi varsa `G)` parent item, `a)` child list item olarak modellenir; `G)` metin icine gomulmez.
- Dash item'lar tekrar eden marker olarak degerlendirilmez; `-` ayni seviyede birden fazla kez kullanilabilir.
- Liste akisi bittikten sonra gelen aciklayici paragraf son liste elemanina otomatik yapistirilmez. Yeni bir giris, kapsam veya kapanis cumlesiyse ayri `paragraph` olur.

Ornek dogru mantik:

- `8`
- `a), b), c)`
- `9`
- `10`
- `G)` parent
- `a), b), c)` child

Yanlis mantik:

- `8`
- `a), b), c)`
- sonra sebepsiz `1), 2)` ana seri gibi baslatmak
- `a), b), c), a), b)` ayni liste blogunda devam ediyormus gibi gostermek
- `G) a) ...` satirini tek paragraf veya tek liste item metni yapmak

## Paragraf ve Akis

Uzun metinler okunabilir hale getirilir ama anlam bozulmaz.

Kural:

- Tek cumle satir sonu yuzunden bolunmez.
- Tek basina anlamsiz kalan devam parcasi onceki metinle birlestirilir.
- Kelime bolunmesi varsa dogal kelime akisi kurulur.
- Cok uzun paragraflar dogal duraklarda bolunur.
- Dogal duraklar: cumle sonu, fikra gecisi, noktalı virgül, iki nokta, liste baslangici.
- Hedef paragraf genellikle 70-120 kelimedir.
- 150 kelime ustu blok tekrar kontrol edilir.
- 300 kelime ustu paragraf veya liste item'i kabul edilmez.
- Uzun liste item'i bolunurken madde etiketi cogaltilmaz.
- `A.B.`, `T.C.`, `A. B.` gibi kisaltmalar cumle sonu sanilip ayri paragraph bloklarina bolunemez.
- Dipnot veya islem notu temizlenince iki liste/kurum/unvan parcasi birbirine yapisiyorsa aradaki noktalama korunur veya dogal ayirac geri konur.

Yasak:

- Cümlenin ortasından yapay paragraf uretmek.
- Sadece satir sonu var diye yeni paragraph acmak.
- Temizlikten sonra kalan `eder.`, `kapsar.`, `ni imzalayarak...` gibi parcayi tek blok yapmak.

## Tablo Kurali

Dokumanda tablo varsa tablo olarak korunur.

Kural:

- Tablo duz metne cevrilmez.
- Satir satir paragraf yapilmaz.
- `table` blogu kullanilir.
- Tablo basligi veya aciklamasi varsa tabloyla baglamli tutulur.
- Kullanici belirli bir tabloyu cikar dediyse sadece o tablo cikarilir.

## Ek Madde Kurali

Ek maddeler varsayilan olarak dahil edilir.

Kural:

- Ek madde otomatik silinmez.
- Basligindaki parantez icindeki mevzuat islem notlari temizlenir.
- Altinda gercek norm metni varsa ek madde korunur.
- Altinda gercek norm metni yoksa ek madde dusurulur.
- Ek madde sadece kaynak/surec notundan ibaretse veya "hukmu kalmamistir" gibi normatif olmayan aciklama disinda metin icermiyorsa dusurulur.
- `Ek Gecici Madde` icin kullanicinin "gecici maddeler cikarilsin" talimati varsa cikarilir.

## Final QA

JSON teslim edilmeden once su kontrol yapilir. Herhangi biri varsa cikti hazir degildir.

Kritik red flag listesi:

- Atlanmis madde var.
- Madde basligi ve madde metni kaymis.
- Bos `article_line`, bos `subheading`, bos liste veya bos tablo var.
- Paragraf icinde `Madde`, `Ek Madde`, `KISIM`, `BOLUM` baslangici kalmis.
- Liste etiketi ham paragraf basinda duruyor.
- Yeni importta `alpha_list`, `ordered_list` veya `items: ["a) ..."]` gibi string liste elemani kullanilmis.
- `marker` metnin icine gomulmus; ayri alan olarak verilmemis.
- Ayni `list.items` icinde `a), b), c)` bittikten sonra tekrar `a), b)` gibi yeni seri baslamis.
- Temizlikten sonra sadece marker kalmis liste elemani duruyor.
- Normatif parantezler islem notu sanilip silinmis.
- `G) a)`, `H) 1.` gibi parent-child markerlari tek metne ezilmis.
- Ayni seviyedeki liste ogeleri farkli blok tipleriyle verilmis.
- Tablolar metne cevrilmis.
- Tablo hucrelerinde liste/paragraf gerektiren yapi stringe ezilmis.
- Temizlik sonrasi anlamsiz orphan satir kalmis.
- Dipnot veya mevzuat notu kalintisi duruyor.
- 300 kelime ustu tek paragraf veya liste item'i var.
- Kullanici tarafindan cikarilmasi istenen bolum kalmis.
- Kullanici tarafindan korunmasi gereken norm metin silinmis.

Final kontrol sorulari:

1. Dokuman kullanicinin istedigi ana bolme kuralina gore mi ayrildi?
2. Her konu kendi basligi altinda mantikli bir butun mu?
3. Her madde dogru yerde mi?
4. Silinen kisimlardan sonra anlam akisi dogal mi?
5. Listeler ve tablolar kullaniciya okunabilir gorunur mu?
6. Bos veya anlamsiz blok var mi?
7. Bu cikti bir ogrencinin calisabilecegi konu anlatimi gibi mi?

Bu sorulardan biri "hayir" ise JSON teslim edilmez; once duzeltilir.

## Model Davranis Kurali

Emin olunmayan yerde tahminle JSON uretme.

Yapilacak sey:

- Sorunu acikca belirt.
- Hangi bolumde risk oldugunu soyle.
- Gerekirse ilgili konuyu daha kucuk parca halinde isle.
- Mantik kontrolu gecmeden "hazir" deme.

Bu rehberin amaci hizli cikti degil, dogru ve guvenilir konu anlatimi uretmektir.
