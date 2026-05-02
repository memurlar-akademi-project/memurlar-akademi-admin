# SORU IMPORT SKILL

Bu skill, verilen mevzuat dokumani ve konu referans listesi uzerinden Memurlar Akademi admin panelindeki `Soru Import` ekranina uygun soru JSON'u uretmek icin kullanilir.

Ana hedef sadece soru uretmek degil; MEB/ODSGM gorevde yukselme sinavlarina benzer bicimde, tek dogru cevabi olan, çeldiricileri guclu ve konuya dogru baglanmis sorular uretmektir.

## Temel ilke

- Sadece verilen kaynak metne dayan.
- Kaynakta olmayan bilgi, yorum, guncel hukuk bilgisi, genel kultur veya tahmin ekleme.
- Soru, şıklar ve aciklama kaynak metinden turemeli.
- Her soru tek bir net olcme hedefine sahip olmali.
- Bir sorunun dogru cevabi, mevzuati bilmeyen biri tarafindan yalnizca sagduyu ile kolayca tahmin edilememeli.
- Cikti yalnizca gecerli JSON olmalidir; Markdown, aciklama veya kod blogu yazma.

## MEB tarzina yaklasim

MEB/ODSGM soru dilinde tek bir kalip baskin degildir. Bu nedenle butun sorulari ayni kokle uretme.

Ornek sinav kalibi acisindan iki soru evreni ayrilir:

- Genel kultur / tarih / Turkce gibi mevzuat kaynagi olmayan sorular dogrudan soru kokuyla baslayabilir.
- Kanun, anayasa, kararname, yonetmelik, genelge ve benzeri mevzuat sorularinda kaynak adi soru kokunun basinda acikca yer alir.

Mevzuat sorularinda varsayilan kok yapisi:

- `657 sayılı Devlet Memurları Kanunu’na göre, ...`
- `T.C. Anayasası’na göre, ...`
- `... Kanunu’na göre, ...`
- `... Yönetmeliği’ne göre, ...`
- `... Kararnamesi’ne göre, ...`
- `... Genelgesi’ne göre, ...`

Bu kural sadece 657 icin degil, tum kanun/yonetmelik/kararname/genelge sorulari icin gecerlidir. Kaynak adinin baslikta verilmis olmasi, soru kokunden kaynak adini dusurmek icin yeterli sebep degildir.

Uygun soru kokleri:

- `[Kaynak mevzuat adı]’na göre, aşağıdakilerden hangisi doğrudur?`
- `[Kaynak mevzuat adı]’na göre, aşağıdakilerden hangisi yanlıştır?`
- `[Kaynak mevzuat adı]’na göre, aşağıdakilerden hangisi ... değildir?`
- `[Kaynak mevzuat adı]’na göre, aşağıdakilerden hangisi ... arasında sayılmamıştır?`
- `[Kaynak mevzuat adı]’na göre, ... aşağıdakilerden hangisidir?`
- `[Kaynak mevzuat adı]’na göre, verilenlerden hangileri ...?`
- `[Kaynak mevzuat adı]’na göre, bu hükümde boş bırakılan yere aşağıdakilerden hangisi getirilmelidir?`
- `[Kaynak mevzuat adı]’na göre, numaralanmış ifadelerden hangileri doğrudur?`
- `[Kaynak mevzuat adı]’na göre, numaralanmış ifadelerden hangileri yanlıştır?`
- `[Kaynak mevzuat adı]’na göre, numaralanmış hükümler doğru (D) - yanlış (Y) olarak değerlendirildiğinde sıralama aşağıdakilerden hangisi olur?`

Kok cesitliligi:

- Bir partide klasik dogrudan bilgi sorulari kullan.
- Bir partide olumsuz koklu sorular kullan; ama sorularin cogunu `yanlıştır/değildir` kalibina yigma.
- Bir partide oncul sorular kullan.
- Bir partide sure, oran, sayi, merci, usul, istisna ve kapsam ayrimi sorularina agirlik ver.

## Soru tipi dagilimi

Kullanici farkli bir dagilim istemedikce genel batch dagilimi su mantikta olsun:

- Yaklasik %35 dogrudan mevzuat bilgisi: yetki, merci, kapsam, tanim, sart.
- Yaklasik %25 nuans farki olan ayrim sorusu: `hangisi yanlıştır/değildir`, kapsam disi, istisna.
- Yaklasik %20 oncul sorusu: I, II, III biciminde ve secenekler `Yalnız I`, `I ve II`, `I, II ve III` gibi.
- Yaklasik %20 sayisal/usul sorusu: sure, oran, gun, ay, karar merci, basvuru yolu, gorevli makam.
- Uygun kaynak varsa az sayida D/Y siralama veya bosluk doldurma sorusu kullanilabilir.

Bu oran kesin matematik degil, kaliteyi korumak icin esnek uygulanir.

## Topic esleme mantigi

Sistemde sorular `topic_id` ile tutulur. Kullanici su tipte referans liste verebilir:

```json
[
  { "topic_id": 101, "topic_name": "Amaç ve Kapsam" },
  { "topic_id": 102, "topic_name": "Tanımlar" }
]
```

Kurallar:

- Konuyu anlamak icin `topic_name` alanini kullan.
- JSON ciktisinda dogru baglamak icin `topic_id` alanini kullan.
- Soru JSON'unda `topic_name` yazma; backend konu adini `topic_id` uzerinden DB'den alir.
- Hangi topic'e ait oldugunu guvenle belirleyemiyorsan o soruyu uretme.
- Yanlis topic'e baglanmis soru, uretilmemis sorudan daha kotudur.

## JSON semasi

Her zaman tam olarak su yapida don:

```json
{
  "questions": [
    {
      "topic_id": 101,
      "question_type": "multiple_choice",
      "difficulty": "medium",
      "status": "draft",
      "question_text": "657 sayılı Devlet Memurları Kanunu'na göre, aşağıdakilerden hangisi doğrudur?",
      "correct_answer_text": "B",
      "explanation_text": "Kaynak metne göre ...",
      "options": [
        { "label": "A", "option_text": "Şık A", "is_correct": false },
        { "label": "B", "option_text": "Şık B", "is_correct": true },
        { "label": "C", "option_text": "Şık C", "is_correct": false },
        { "label": "D", "option_text": "Şık D", "is_correct": false },
        { "label": "E", "option_text": "Şık E", "is_correct": false }
      ]
    }
  ]
}
```

Alan kurallari:

- `topic_id`: zorunlu.
- `question_type`: simdilik her zaman `multiple_choice`.
- `difficulty`: `easy`, `medium` veya `hard`.
- `status`: varsayilan `draft`.
- `question_text`: zorunlu ve net olcum hedefi tasimali.
- `correct_answer_text`: dogru şıkkın harfi olmali.
- `explanation_text`: zorunlu, bos olamaz, kisa ve kaynak dayanakli olmali.
- `options`: zorunlu, tam 5 secenek olmali.

## Soru kok kurallari

- Kanun, anayasa, kararname, yonetmelik ve genelge sorularinda kaynak mevzuat adi soru kokunun basinda yer almalidir.
- Soru kokunu `Madde 45'e göre`, `206 ncı maddeye göre`, `bu maddeye göre` gibi madde numarasi merkezli baslatma. Bunun yerine kaynak mevzuat adiyla basla.
- Madde numarasi gerekiyorsa aciklamada veya konu icini netlestiren ifadede kullanilabilir; soru kokunun ana referansi kaynak mevzuat adi olmalidir.
- Kaynak resmi adini makul olcude koru: kanunlarda mumkunse kanun numarasi + resmi ad, Anayasa icin `T.C. Anayasası`, yonetmelik/genelge/kararname icin resmi baslik kullan.
- Anayasa sorularinda MEB/ODSGM sinav diline yakinlik icin `2709 sayılı Türkiye Cumhuriyeti Anayasası’na göre` yerine varsayilan olarak `T.C. Anayasası’na göre` kalibini kullan.
- Ayni batchte tum sorular kaynak mevzuat adiyla baslayabilir; cesitlilik kaynak adini kaldirmakla degil, olcum hedefi ve kok tipiyle saglanir.
- Kisa kok daha iyidir; ancak kisaltma kaynak adini belirsizlestirmemeli.
- Olumsuz kok kullanildiginda `yanlıştır` veya `değildir` ifadesi acik ve gorunur olsun.
- Oncul sorularda oncul sayisi genellikle 3 olsun; kaynak cok zenginse 4 olabilir.
- Oncul ifadeler birbirinden bagimsiz ve test edilebilir olmali.
- D/Y siralama sorularinda her onculun dogru/yanlis durumu kaynak metinden acikca dogrulanabilmeli.
- Bosluk doldurma sorularinda bosluklar genellikle sure, oran, sayi, merci veya usul bilgisini olcmeli.
- Tek cumlede iki farkli dogruluk testi yapma.
- Sorunun cevabi ayni kok icinde ima edilmemeli.

## Şık kurallari

- Her soru tam 5 secenek icermeli: `A`, `B`, `C`, `D`, `E`.
- Tek bir dogru secenek olmali.
- Dogru cevap şıklar arasinda dengeli dagilmali; batch icinde hep ayni harfe yigilma.
- Şıklar ayni gramer turunde olmali: makam sorusunda makamlar, sure sorusunda sureler, hak sorusunda haklar.
- Şık uzunluklari makul olcude dengeli olmali; dogru cevap surekli en uzun veya en detayli şık olmamali.
- Çeldiriciler kaynak metindeki yakin kavramlardan, benzer makam/sure/usul/kapsam ayrimlarindan uretilmeli.
- Konu disi, cocukca, komik veya ilk bakista elenen şık yazma.
- `Hepsi`, `Hiçbiri`, `Yukarıdakilerin tamamı`, `Yalnızca bunlar` gibi zayif toplu şıklar kullanma.
- Şıklarda kaynakta olmayan nitelik uretme.
- Bir şık sadece kelime oyunu ile yanlis olmamali; mevzuat bilgisini olcmeli.
- Dogru şıktaki ifade, kaynak metnin ayni cumlesini birebir kopyalamak zorunda degil; ama anlam degistirilemez.
- D/Y veya eslestirme tipi seçenekler gerekiyorsa `I: D, II: Y, III: D` gibi okunabilir tek satir format kullan.

## Çeldirici kalitesi

Iyi çeldirici, yanlis oldugu halde ayni konu evreninden gelir.

Kullanilabilecek çeldirici kaynaklari:

- Ayni maddede gecen baska sureler.
- Ayni kisimdaki baska yetkili makamlar.
- Benzer hak, yasak, istisna veya sartlar.
- Kapsam icine giren/girmeyen yakin gruplar.
- Bir usulun farkli asamalari.
- Ayni mevzuatta bulunan ama sorulan hukum icin gecerli olmayan kavramlar.

Kullanilmayacak çeldirici turleri:

- Kaynakta hic gecmeyen uydurma makamlar.
- Asiri genel ahlaki ifadeler.
- Bariz sacma secenekler.
- Dogru cevabi dil bilgisi veya uzunlukla belli eden secenekler.
- Birden fazla dogru kabul edilebilecek muallak ifadeler.

## Zorluk seviyesi

`easy`:

- Tek madde, tek bilgi, dogrudan sorulur.
- Celistiriciler yine mevzuat ici olur.

`medium`:

- Benzer kavramlar, makamlar, sureler veya kapsam ayrimlari karsilastirilir.
- Olumsuz kok veya oncul kullanilabilir.

`hard`:

- Birden fazla fikra/bent arasindaki nuans olculur.
- Oncul, istisna, usul sirasi veya benzer sure/merci ayrimi kullanilir.
- Ancak soru yine kaynak metinden cozulebilir olmali; yorum sorusu olmamali.

## Aciklama kurallari

- Aciklama kisa ve dogrudan olsun.
- Dogru cevabi neden dogru oldugunu belirt.
- Gerekirse yanlis seceneklerin neden yanlis oldugunu tek cumlede acikla.
- Aciklamada kaynak metin disi yorum, tavsiye veya ezber notu ekleme.
- `Kaynak metne göre` veya mevzuat adiyla baslayan sade aciklamalar uygundur.

## Uretim stratejisi

1. Kaynak metni konu konu tara.
2. Her topic icin olculebilir hukumleri belirle.
3. Tanim, sure, merci, kapsam, istisna ve usul bilgisini onceliklendir.
4. Once dogru cevabi belirle.
5. Sonra ayni konu evreninden 4 guclu celistirici kur.
6. Soru kokunu en uygun tipe gore sec.
7. JSON'a yazmadan once topic eslemesini kontrol et.

## Yasaklar

- Kaynakta olmayan bilgi uretme.
- Yorum, tavsiye, guncel uygulama, pratik bilgi veya sinav taktigi ekleme.
- Soru uretmek icin normatif metni anlamca degistirme.
- Ayni maddeyi kopya varyasyonlarla tekrar tekrar sorma.
- Belli bir secenek harfini surekli dogru yapma.
- Her soruyu `yanlıştır` kalibina sokma.
- Mevzuat sorusunu kaynak adini belirtmeden sorma.
- Mevzuat sorusunu `Madde X'e göre` kalibiyla baslatma.
- 4 secenekli soru uretme.

## Son kontrol

JSON'u dondurmeden once su kontrolu yap:

- Kokte `questions` var mi?
- Her soruda `topic_id` var mi?
- Her soru `multiple_choice` mi?
- Her soruda tam 5 secenek var mi?
- Secenek etiketleri sirasiyla `A`, `B`, `C`, `D`, `E` mi?
- Her soruda tek `is_correct: true` var mi?
- `correct_answer_text`, dogru secenek etiketiyle ayni mi?
- `explanation_text` bos degil mi?
- Soru, verilen kaynak metinden dogrulanabiliyor mu?
- Topic eslemesi dogru mu?
- Mevzuat sorularinda soru kokunun basinda kaynak mevzuat adi var mi?
- Soru kokleri madde numarasiyla baslamaktan kaciniyor mu?
- Dogru cevap dil, uzunluk veya asiri kesinlik nedeniyle belli oluyor mu?
- Çeldiriciler ayni mevzuat evreninden mi?
- Sorular arasinda kok ve dogru cevap harfi dagilimi dengeli mi?

Yanitin yalnizca JSON olmalidir.
