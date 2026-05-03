# HAP BILGI URETME SKILL

Bu skill, Memurlar Akademi icin mevzuat konu anlatimlari uzerinden admin panelindeki `Hap Bilgiler` modulune uygun flashcard JSON'u uretmek icin kullanilir.

Ana hedef konu ozeti veya detayli test sorusu uretmek degil; sinavda hatirlanmasi gereken net bilgileri kisa, akilda kalici soru-cevap kartlari halinde vermektir.

## Temel ilke

- Sadece verilen konu anlatimi, mevzuat metni veya onayli kaynak bloklarina dayan.
- Kaynakta olmayan bilgi, yorum, guncel uygulama, genel kultur veya tahmin ekleme.
- Hap bilgi, normatif metni yeniden yazma veya test sorusu uretme araci degildir; kaynak metinden turetilmis sinav odakli mikro soru-cevap bilgisidir.
- Her kart tek bir hatirlama hedefine sahip olmalidir.
- Kart, mevzuati bilmeyen biri tarafindan yalnizca sagduyu ile kolayca tahmin edilemeyecek ama okundugunda hizla akilda kalabilecek bir bilgiyi tasimalidir.
- Cikti yalnizca gecerli JSON olmalidir; Markdown, aciklama veya kod blogu yazma.

## Hap bilgi nedir?

Hap bilgi, konu anlatimindan sonra kullanicinin hizli tekrar yaparken gorecegi iki yuzlu karttir.

- `front_text`: Kullaniciya bilgiyi cagiracak kisa ve net soru.
- `back_text`: Sorunun asil net cevabini veren cok kisa arka yuz.

Iyi hap bilgi:

- Kisa, net, akilda kalici ve sinav odaklidir.
- Bir tanim, sure, yetkili merci, istisna, kapsam, yasak, sart, usul veya ayrim bilgisini yakalar.
- Gereksiz aciklama, tavsiye, detayli test sorusu veya ders notu uslubu tasimaz.
- Konu anlatimindaki her cumleyi karta cevirmeye calismaz.

Kotu hap bilgi:

- Konunun genel ozeti veya uzun aciklamasi gibidir.
- Detayli test sorusu kokune benzer.
- Bir kartta birden fazla farkli bilgiyi yigar.
- Sadece madde numarasini ezberletir.
- Bariz, sinav degeri dusuk veya herkesin tahmin edebilecegi bilgi verir.

## Uygun bilgi tipleri

Onceliklendirilecek bilgiler:

- Tanimlar ve temel kavramlar.
- Gorevli/yetkili makamlar.
- Sureler, oranlar, sayilar, yas sinirlari ve barajlar.
- Basvuru, karar, bildirim, erteleme, yasaklama, itiraz gibi usul adimlari.
- Kapsama giren ve girmeyen kisi/kurum/haller.
- Istisnalar, sakli hukumler ve ozel durumlar.
- Yasaklar, yukumlulukler, yaptirimlar ve sonuclar.
- Benzer kavramlari karistirmayi onleyen ayrimlar.
- Liste halinde sayilan unsurlar; fakat liste cok uzunsa kart parcalanmalidir.

Dusuk oncelikli veya kacininilacak bilgiler:

- Sadece baslik tekrar eden kartlar.
- "Bu kanunun amaci nedir?" gibi cok genel kartlar; amac hukumleri ancak sinav degeri tasiyorsa kullanilir.
- Salt madde numarasi ezberi.
- Mulgalar, gecici maddeler, dipnotlar, resmi islem notlari.
- Kaynak metindeki tablo/form alanlari; sadece sinavda sorulabilecek net bilgi varsa karta donustur.
- Ayni bilginin kopya veya yakin varyasyonlari.

## Kart dili

`front_text` kurallari:

- Genellikle 4-12 kelime araliginda olsun.
- Tek hedefli ve okunur olsun.
- Varsayilan olarak kisa soru formatinda yaz.
- Kaynak mevzuat adini her on yuzde tekrar etme; hap bilgi karti konu baglaminda zaten gorunur.
- `Madde 12'ye göre...`, `206 ncı madde ne der?` gibi madde merkezli on yuz yazma.
- Test sorusu kokleriyle kart yazma. `Aşağıdakilerden hangisi`, `hangileri`, `hangisi değildir` gibi coktan secmeli soru dili yerine `Cevap süresi kaç gündür?`, `Kimler yararlanabilir?`, `Hangi bilgiler zorunludur?` gibi kisa yoklama sorulari kullan.

`back_text` kurallari:

- Genellikle 1 cumle olsun; zorunluysa 2 kisa cumleye cikabilir.
- Bilgiyi dogrudan versin; gereksiz ders anlatimi yapmasin.
- Kaynak mevzuat adini, madde numarasini veya kaynak notunu kullaniciya gorunen metne zorunlu olarak ekleme.
- Kaynak notu gerekiyorsa kalite raporunda veya uretilen dosyanin notlarinda tutulur; kart metnini sisirmez.
- Cok uzun liste varsa listeyi tek karta yigma; 2-4 kart halinde bol.

## Kart tipleri

Uretimde cesitlilik icin su kart tipleri kullanilir. JSON'a `card_type` yazilmaz; bu siniflandirma uretim kalitesi icindir.

- `tanim`: Kavramin anlamini yoklar.
- `merci`: Yetkili/gorevli makam veya kurul bilgisini yoklar.
- `sure`: Gun, ay, yil, yas, oran, sayi veya baraj bilgisini yoklar.
- `sart`: Bir islem veya hak icin aranan sartlari yoklar.
- `kapsam`: Kimlerin veya hangi hallerin kapsama girdigini/girmedigini yoklar.
- `istisna`: Genel kuralin istisnasini yoklar.
- `yasak_yukumluluk`: Yasak, yukumluluk veya sonuc bilgisini yoklar.
- `ayrim`: Birbirine benzeyen iki kavram/hukum arasindaki farki yoklar.

## Topic esleme mantigi

Sistemde hap bilgiler `topic_id` ile tutulur. Kullanici su tipte referans liste verebilir:

```json
[
  { "topic_id": 101, "topic_name": "Amaç ve Kapsam" },
  { "topic_id": 102, "topic_name": "Tanımlar" }
]
```

Kurallar:

- Konuyu anlamak icin `topic_name` alanini kullan.
- JSON ciktisinda dogru baglamak icin `topic_id` alanini kullan.
- Hap bilgi JSON'unda `topic_name` yazma; backend konu adini `topic_id` uzerinden DB'den alir.
- Hangi topic'e ait oldugunu guvenle belirleyemiyorsan o karti uretme.
- Yanlis topic'e baglanmis kart, uretilmemis karttan daha kotudur.

## JSON semasi

Her zaman tam olarak su yapida don:

```json
{
  "flashcards": [
    {
      "topic_id": 101,
      "front_text": "Yetkili makam kimdir?",
      "back_text": "Bu işlemde yetkili makam ilgili kurumdur.",
      "status": "draft",
      "sort_order": 1,
      "is_free": false
    }
  ],
  "quality_report": {
    "warnings": [],
    "source_coverage_notes": [],
    "needs_human_review": true
  }
}
```

Alan kurallari:

- `topic_id`: Zorunlu.
- `front_text`: Zorunlu, cok kisa ve tek hedefli.
- `back_text`: Zorunlu, net, kisa ve kaynak dayanakli.
- `status`: Varsayilan `draft`.
- `sort_order`: Ayni topic icinde 1'den baslayarak artar.
- `is_free`: Varsayilan `false`. Kullanici ozellikle istemedikce `true` yapma.
- `quality_report`: Uretimle ilgili riskleri ve kaynak kapsami notlarini tasir.

## Kapsam ve adet stratejisi

Hedef, her konudan mumkun olan en fazla karti uretmek degil; tekrar degeri yuksek ve akilda kalici kartlari secmektir.

Genel adet araliklari:

- Cok kisa konu veya sadece form/ek: 0-5 kart.
- Kisa konu: 5-10 kart.
- Orta konu: 10-18 kart.
- Uzun ve madde yogun konu: 18-35 kart.
- Cok uzun kisim/bolum: konu parcalarini ayri ele al; tek batchte kalite dusuyorsa bol.

Adet kararinda sunlari dikkate al:

- Kaynakta kac tane sinav degeri yuksek hukum var?
- Bilgiler birbirinden gercekten farkli mi?
- Ayni bilginin soru, test ve deneme havuzunda da kullanilacagi unutulmadan kartlar tekrar aracina uygun mu?
- Konu sadece form, ek veya teknik liste ise kart sayisini zorlamadan dusuk tut.

## Uretim stratejisi

1. Topic icindeki kaynak bloklari tara.
2. Mulgalar, gecici maddeler, dipnotlar ve resmi islem notlarini dikkate alma.
3. Tanim, sure, merci, kapsam, istisna, sart ve usul bilgilerini isaretle.
4. Her bilgi icin tek kart hedefi belirle.
5. On yuzde kisa ve net soru sor; arka yuzde bilgiyi tek nefeste netlestir.
6. Ayni bilgiyi tekrar eden kartlari ele.
7. Uzun liste veya uzun fikralari dogal parcalara bol.
8. JSON'a yazmadan once topic eslemesini ve kaynak dayanaklarini kontrol et.

## Yasaklar

- Kaynakta olmayan bilgi uretme.
- Yorum, tavsiye, pratik uygulama, sinav taktigi veya motivasyon cumlesi ekleme.
- Normatif metni anlamca degistirme.
- Kartlari detayli test sorusu formatina sokma.
- Mulgalar, gecici maddeler, dipnotlar veya resmi islem notlarindan kart uretme.
- Sadece madde numarasi soran on yuz yazma.
- Tek kartta birden fazla bagimsiz bilgi yigma.
- Ayni kartin kopya varyasyonlarini uretme.
- `front_text` alanini uzun test sorusu kokune veya paragrafa cevirme.
- `back_text` alanini konu anlatimi gibi uzatma.
- Topic disi hukumleri yanlis konuya baglama.

## Kalite puanlama mantigi

Her kart zihinsel olarak su filtrelerden gecmelidir:

- Kaynakta acik dayanak var mi?
- Tek bir net bilgiyi mi hatirlatiyor?
- Sinavda soru kokune veya secenege donebilecek kadar degerli mi?
- On yuz kisa ve net bir flashcard sorusu gibi mi?
- Arka yuz bilgiyi tam ama tek nefeste veriyor mu?
- Benzer baska kartla gereksiz tekrar etmiyor mu?

Bu sorulardan birine ciddi sekilde `hayir` cevabi veriliyorsa kart uretilmemelidir.

## Son kontrol

JSON'u dondurmeden once su kontrolu yap:

- Kokte `flashcards` var mi?
- Her kartta `topic_id` var mi?
- Her kartta `front_text` ve `back_text` dolu mu?
- `status` degeri `draft`, `active` veya `passive` mi?
- `sort_order` ayni topic icinde mantikli sirada mi?
- Kart kaynak metinden dogrulanabiliyor mu?
- Topic eslemesi dogru mu?
- Mulgadan, gecici maddeden, dipnottan veya resmi islem notundan kart uretilmedi mi?
- Ayni bilgi iki kez tekrar edilmedi mi?
- On yuz ve arka yuz cok uzun degil mi?
- Kart sinav tekrar degeri tasiyor mu?
