# TELIFLI DERSLER KONU ANLATIMI SKILL

Bu skill, Memurlar Akademi icin `telifli-dersler` klasorundeki kurum, okul,
egitim notu, PDF veya DOCX kaynaklarindan sisteme yuklenecek tam kapsamli
ders konu anlatimi uretirken kullanilir.

Bu dosyanin amaci kaynak metni kopyalamak degildir. Kullanici bu icerikten
ders calisacaktir; bu nedenle kaynakta sorumlu olunan konu, alt baslik,
tablo, sekil, diyagram, ornek, ayrim veya surec sistemde de ogrenilebilir
bicimde yer almalidir. Ancak nihai metin kaynak cumlelerin aynen aktarimi
degil, Memurlar Akademi icin yazilmis ozgun konu anlatimi olmalidir.

## Temel Ilke

- Konu anlatimi ozet degildir; fakat kaynak metnin aynen aktarimi da degildir.
- Hedef, kaynak kapsamindaki tum konulari ozgun, okunur ve sinav odakli
  ders anlatimina donusturmektir.
- Kaynakta ders kapsamina giren hicbir konu dusurulmez.
- Konu sayisi makul tutulur; fakat konu sayisini az tutmak icin icerik kisilmaz.
- Alt basliklar ayri topic olmak zorunda degildir; topic icinde `subheading`,
  `list`, `table`, `callout` ve gerekirse `diagram` temsili olarak yer alir.
- Ogrenci kaynak PDF'i acmadan bu konu anlatimi ile derse calisabilmelidir.
- Cikti her zaman admin import formatina uygun Structured Content V2 JSON olur.
- UI/CSS kaygisiyla icerik kesilmez. UI mevcut block tipleriyle icerigi tasiyacak
  sekilde kullanilir.

## Kaynak Kullanimi

- Kaynaklar kapsam, siralama, kavramlar, tablolar, semalar ve ornek tipleri
  icin esas alinir.
- Kaynak metin ham OCR dump olarak veya uzun paragraf halinde yapistirilmez.
- Kaynak cumle yapisi korunmaz; anlam korunarak yeniden ifade edilir.
- Uzun kaynak paragraflari 2-5 kisa ders paragrafina, listeye veya tabloya
  donusturulur.
- Bir kaynak paragrafi uzun ve dolambacliysa, ders notunda once ana
  kural/veri verilir, sonra neden/onem aciklanir, gerekiyorsa sinav ayrimi
  veya ornek eklenir.
- "Hafif yorumlama" kaynak anlamini degistirmek degildir. Yorumun gorevi:
  - baglaci netlestirmek,
  - kavramlari calisma diline oturtmak,
  - sinav acisindan ayrimlari belirginlestirmek,
  - bozuk OCR/paragraf akisini duzeltmektir.
- Kaynakta yer alan teknik tanim, kavram ayrimi, surec, ilke, maddeleme,
  ornek veya tablo eksiltilmez.
- Kaynakta tekrar eden veya sayfa tasmasi nedeniyle yinelenen satirlar tekilleştirilir.
- Kaynakta sadece sayfa basligi, dipnot, kaynakca, cevap anahtari, bos sayfa,
  yayin bilgisi veya ders disi idari bilgi varsa bunlar konu anlatimina alinmaz.

## Yasaklar

- "Bu kismi ozetleyelim", "burasi detay", "sadece ana fikir yeter" yaklasimi
  yasaktir.
- Kaynak metni uzun uzun aynen veya cok yakin ifade ile tasimak yasaktir.
- PDF paragraf yapisini sistemde aynen tekrar etmek yasaktir.
- Telifli kaynak cumlelerinden arka arkaya uzun alinti yapmak yasaktir.
- Kaynaktaki alt basliklari, ornekleri veya tablo satirlarini konu sayisi az olsun
  diye silmek yasaktir.
- Tek dev `paragraph` blogu uretmek yasaktir.
- Listeyi duz metne ezmek yasaktir.
- Tabloyu paragraf olarak yazmak yasaktir.
- Sekil, sema veya diyagrami hic yokmus gibi gecmek yasaktir.
- OCR bozuklugunu anlam kaybina yol acacak sekilde tahmin ederek doldurmak
  yasaktir. Emin olunmayan yer QA notuna yazilir.

## Konulara Bolme Mantigi

Kural: Topic sayisi dersin ana unite/tema sayisini temsil eder; kaynak kapsamindaki
tum alt basliklar topic icinde kalir.

Varsayilan hedef:

- Kisa ders: 4-6 topic.
- Orta ders: 6-10 topic.
- Cok uzun ders: 8-12 topic.
- 12 topic ustu sadece kullanici onayi veya cok net unite ayrimi varsa yapilir.

Topic siniri secilirken:

- Kaynaktaki ana Roma rakamli bolumler, unite basliklari veya ana moduller esas
  alinir.
- Bir ana bolum cok kisa ise komsu bolumle birlestirilebilir.
- Bir ana bolum cok uzunsa ayni topic icinde alt `section_title` ve `subheading`
  kullanilir; ayrica topic'e bolmek son care olmalidir.
- Ogrencinin soldaki konu listesini taramasi kolay kalmalidir.

## Anlatim Yogunlugu

Her topic, kaynak kapsamindaki alt basliklari tasir; fakat metin ders calisma
ekraninda okunabilir yogunlukta olmalidir.

Varsayilan anlatim sekli:

- Her `paragraph` genellikle 2-4 cumle olur.
- Bir alt baslik altinda 1-3 paragraf yeterli degilse liste/table kullanilir.
- Uzun aciklamalar tek paragrafta biriktirilmez.
- Kural, ayrim, istisna, surec veya arac listeleri liste/table olarak verilir.
- Gereken yerde kaynakta olmayan ama anlamayi kolaylastiran kisa baglayici
  aciklama eklenebilir.
- Gereksiz akademik tekrarlar ve kaynak icindeki dolambacli cumleler atilir;
  ancak bilgi/konu atilmaz.

Kalite kontrol sorusu:

- "Bu metin kaynagin aynisi gibi mi duruyor?" Evetse yeniden yaz.
- "Bu metin sadece ozet mi, alt basliklari atlamis mi?" Evetse kapsam ekle.
- "Ogrenci kaynak acmadan bu basliktan soru cozebilir mi?" Hayirsa detay ekle.

## Structured Content Kurallari

Kabul edilen blok tipleri:

- `section_heading`
- `section_title`
- `heading`
- `subheading`
- `paragraph`
- `rich_paragraph`
- `list`
- `table`
- `callout`
- `quote`
- `divider`

Liste kurali:

- Liste varsa `type: "list"` olur.
- Liste item'lari string olmaz; her item `blocks` icerir.
- Kaynaktaki `1)`, `A)`, `a)`, `*`, tire, Roma rakami gibi isaretler `marker`
  alaninda korunur.
- Ic ice liste varsa parent item'in `blocks` icine ikinci `list` olarak yazilir.

Tablo kurali:

- Tablo varsa `type: "table"` olur.
- Baslik satiri varsa `headers` kullanilir.
- Hucrede coklu paragraf veya liste varsa hucre obje olarak `{ "blocks": [...] }`
  seklinde yazilir.
- Tablo gorsel olarak kaynakta daginik olsa bile anlamli satir/sutun yapisi
  yeniden kurulur.
- Telifli tablonun satir metinleri aynen kopyalanmaz; hucreler anlam korunarak
  kisa ve ozgun ifadeyle yazilir.

Sekil/diyagram kurali:

- Kaynakta sekil, akis semasi, kutu diyagram, hiyerarsi veya surec cizimi varsa
  aynen gorsel dosya olarak kopyalamak yerine structured temsile cevrilir.
- Basit akislar `list` veya `table` ile yeniden kurulur.
- Karsilastirma semalari `table` ile verilir.
- Surec semalari sirali `list` ve gerekiyorsa `callout` ile verilir.
- Sema tamamen gorsel bir iliski anlatiyorsa `callout` icinde "Sekil notu" olarak
  iliski aciklanir ve ardindan structured liste/tablo kurulur.
- Diyagram kaynakta sinav degeri tasiyorsa atlanamaz.
- Diyagramdaki uzun etiketler kaynakla ayni cumlelerle degil, ders notu diliyle
  yeniden yazilir.

Callout kurali:

- `callout` yalnizca kaynakta not/uyari/ayrim vurgusu varsa veya editoriyal olarak
  sinav acisindan kritik ayrimi belirtmek gerekiyorsa kullanilir.
- Callout, kaynak icerigin yerine gecmez; sadece calisma rehberi etkisi verir.

## Zorunlu Uretim Akisi

1. Kaynak dosyalarin listesini ve sayfa/kelime hacmini cikar.
2. Her kaynak icin icindekiler, ana baslik, alt baslik, tablo, sekil ve ornekleri
   haritala.
3. Birincil kaynak ve yardimci kaynaklari belirle.
4. Ders icin topic planini olustur; hedef 6-10 topic ise alt basliklari topic icinde
   tasimayi planla.
5. Her topic icin kaynak sayfa/aralik ve kapsanan alt baslik listesini tut.
6. Kaynaktaki uzun metni once kapsam maddelerine ayir.
7. Her kapsam maddesini ozgun ders anlatimi paragrafi, liste veya tablo olarak
   yeniden yaz.
8. Structured Content V2 bloklarini uret.
9. Telif QA yap:
   - kaynakla ayni uzun paragraf var mi?
   - arka arkaya gelen cumleler kaynak cumlelerine fazla yakin mi?
   - uzun metinler daha okunur paragraf/liste/table yapisina ayrildi mi?
10. Kapsam QA yap:
   - kaynak ana basliklari eksiksiz mi?
   - alt basliklar eksiksiz mi?
   - tablolar eksiksiz mi?
   - sekil/diyagramlar structured olarak temsil edildi mi?
   - ornekler ve kritik ayrimlar korunmus mu?
11. JSON'u validasyonla kontrol et.
12. DB'ye yuklemeden once veya sonra QA raporu olustur.

## QA Raporu Zorunlulugu

Her ders importu ile birlikte ayni klasorde QA raporu tutulur.

Ornek dosya adlari:

- `halkla_iliskiler_konu_import.json`
- `halkla_iliskiler_kapsam_qa.json`

QA raporu semasi:

```json
{
  "course": "Halkla İlişkiler",
  "source_files": [
    {
      "file": "Halkla İlişkiler.pdf",
      "pages": 21,
      "role": "primary"
    }
  ],
  "topic_count": 6,
  "coverage": [
    {
      "topic_name": "Konu adı",
      "source_pages": "189-192",
      "covered_headings": ["I) GİRİŞ", "II) HALKLA İLİŞKİLERDE SORUNLAR"],
      "tables": 0,
      "figures_or_diagrams": 0,
      "omissions": []
    }
  ],
  "global_omissions": [],
  "copyright_review": {
    "long_verbatim_passages_found": false,
    "source_like_paragraphs_rewritten": true
  },
  "needs_human_review": []
}
```

Kural:

- `global_omissions` bos olmalidir.
- Bir bolum bilincli alinmadiysa nedeni yazilir; "kisa tutmak icin" gecerli neden
  degildir.
- OCR bozuk veya okunamayan yerler `needs_human_review` icine yazilir.

## Basari Olcutu

Basarili telifli ders konu anlatimi:

- Kaynaktaki ders kapsamini eksiksiz tasir.
- Ogrencinin kaynak dokumana geri donmeden calisabilecegi ayrintidadir.
- Kaynak metni aynen veya yakin bicimde tekrar etmez.
- Uzun kaynak paragraflarini ozgun, parcalanmis ve okunur ders anlatimina
  donusturur.
- Topic sayisini sismez, fakat topic icindeki icerigi kismaz.
- Tablo, liste, sekil ve diyagramlari UI'da yeniden anlamli hale getirir.
- JSON import edildiginde mevcut konu anlatimi UI'inda dogru render edilir.
- Sonradan revize edilebilmesi icin proje icinde JSON ve QA raporu olarak saklanir.
