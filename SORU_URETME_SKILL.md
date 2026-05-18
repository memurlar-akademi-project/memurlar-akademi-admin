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

Kanun sorularinda kaynak adi kisaltilamaz. `6136 sayılı Kanun'a göre`, `2559 sayılı Kanun'a göre`, `bu Kanun'a göre` gibi kisa kokler kullanma. Kanun numarasi ve resmi kanun adi birlikte yazilmalidir. Anayasa icin MEB/ODSGM diline uygun olarak `T.C. Anayasası'na göre` kalibi tercih edilir.

Kanun numarasi ile resmi ad mutlaka eslesmelidir. Numarasi veya resmi adi hatali yazilmis soru kalite hatasidir; emin olunmuyorsa konu/ders kaydindaki `code` ve resmi `name` birlikte kontrol edilir.

Soru kokleri coktan secmeli sinav formunda olmalidir; yazili cevap sorusu gibi bitmemelidir. `Hangi ceza öngörülür?`, `Ne yapılır?`, `Nasıl hareket edilir?` gibi acik uclu kokleri tek basina kullanma. Bunlari `aşağıdaki cezalardan hangisi öngörülür?`, `aşağıdaki işlemlerden hangisi yapılır?`, `aşağıdaki ifadelerden hangisi doğrudur?` gibi secenekli sinav kalibina cevir.

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
- Dogrudan bilgi sorulari da sınav diliyle sorulmalidir; soru basit gorunuyorsa bile seçenekler ayni kavram ailesinden güçlü çeldiriciler icermelidir.
- Kisa bilgi sorusu uretilecekse cevap tek kelime/tek makam olsa bile diger secenekler de ayni turden ve yakin mevzuat evreninden secilmelidir; aksi halde dogru cevap bagirir.

## Revizyon ve geri bildirimden ogrenme

Soru duzenleme/revizyon islerinde oncelik sirasi:

- `approval_status = approved` olan sorulara dokunma; bunlar ekip tarafindan kabul edilmis kabul edilir.
- Once `approval_status = rejected` ve `review_note` dolu olan sorulari ele al; insan geri bildirimi, genel tahminden daha gucludur.
- `review_note` icinde onerilen kok, kaynak adlandirmasi, yazim veya cevap duzeltmesi varsa once bunu uygula; sonra şıkları ve aciklamayi yeniden QA'den gecir.
- Soru revize edilip tekrar onaya gonderildiginde eski `review_note` korunmali; soru `approval_status = null` durumuna alinmali ve revize edilmis oldugu ayri alanda isaretlenmelidir.
- Revizyon sirasinda sadece sorulan hatayi duzeltmek yetmez; dogru cevap, 4 çeldirici, kaynak dayanak ve aciklama birlikte kontrol edilir.
- Bir geri bildirim genel bir kalite dersine isaret ediyorsa bu skill'e genellestirilerek eklenir; tek bir soruya ozel istisna gibi yazilmaz.

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
- Kanunlarda `kanun numarası + resmi kanun adı` birlikte yazilmalidir. Sadece `... sayılı Kanun'a göre` yazmak kalite hatasidir.
- Geri bildirim notunda `6136 sayılı Kanun'a göre` gibi kisaltilmis bir kok onerilse bile nihai soruda resmi ad tamamlanir: `6136 sayılı Ateşli Silahlar ve Bıçaklar ile Diğer Aletler Hakkında Kanun'a göre, ...`
- Soru kokunu `Madde 45'e göre`, `206 ncı maddeye göre`, `bu maddeye göre` gibi madde numarasi merkezli baslatma. Bunun yerine kaynak mevzuat adiyla basla.
- Madde numarasi gerekiyorsa aciklamada veya konu icini netlestiren ifadede kullanilabilir; soru kokunun ana referansi kaynak mevzuat adi olmalidir.
- Kaynak resmi adini aynen koru: kanunlarda kanun numarasi + resmi ad, Anayasa icin `T.C. Anayasası`, yonetmelik/genelge/kararname icin resmi baslik kullan.
- Anayasa sorularinda MEB/ODSGM sinav diline yakinlik icin `2709 sayılı Türkiye Cumhuriyeti Anayasası’na göre` yerine varsayilan olarak `T.C. Anayasası’na göre` kalibini kullan.
- Ayni batchte tum sorular kaynak mevzuat adiyla baslayabilir; cesitlilik kaynak adini kaldirmakla degil, olcum hedefi ve kok tipiyle saglanir.
- Kisa kok daha iyidir; ancak kisaltma kaynak adini belirsizlestirmemeli.
- `bakımından` kelimesini otomatik dolgu kalibi gibi kullanma. Gerekli degilse daha dogal sinav dili kur: `... ile ilgili olarak`, `... kapsamında`, `... hakkında`, `... aşağıdakilerden hangisidir?`
- Secenekli sorularda genellikle `aşağıdakilerden hangisi`, `aşağıdaki ifadelerden hangisi`, `aşağıdaki cezalardan hangisi`, `aşağıdaki sürelerden hangisi` gibi form kullan. Kısa sayi/sure sorularinda `kaç gün`, `kaç ay`, `ne kadar` gibi kokler kullanilabilir.
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
- Şıklar ayni gramer ve kavram turunde olmali: makam sorusunda makamlar, sure sorusunda sureler, hak sorusunda haklar, disiplin cezası sorusunda disiplin cezalari, izin suresi sorusunda benzer sureler.
- Şık uzunluklari makul olcude dengeli olmali; dogru cevap surekli en uzun veya en detayli şık olmamali.
- Çeldiriciler kaynak metindeki yakin kavramlardan, benzer makam/sure/usul/kapsam ayrimlarindan uretilmeli.
- Konu disi, cocukca, komik veya ilk bakista elenen şık yazma.
- `Hepsi`, `Hiçbiri`, `Yukarıdakilerin tamamı`, `Yalnızca bunlar` gibi zayif toplu şıklar kullanma.
- Şıklarda kaynakta olmayan nitelik uretme.
- Bir şık sadece kelime oyunu ile yanlis olmamali; mevzuat bilgisini olcmeli.
- Dogru şıktaki ifade, kaynak metnin ayni cumlesini birebir kopyalamak zorunda degil; ama anlam degistirilemez.
- D/Y veya eslestirme tipi seçenekler gerekiyorsa `I: D, II: Y, III: D` gibi okunabilir tek satir format kullan.
- Dogru cevap resmi merci ise diger secenekler de merci olmalidir; dogru cevap bir izin/ruhsat/islem ise diger secenekler de ayni izin/ruhsat/islem evreninden kurulmalidir.
- Dogru cevap bir tanimsa diger secenekler de ayni tanim ailesinden makul ama yanlis tanimlar olmalidir; alakasiz esya, meslek, kurum veya gunluk hayat nesnesi kullanma.
- Dogru cevap bir listedeki unsur ise soru mumkunse `hangisi sayilmamistir`, `hangi set tamamen sayilanlardan olusur`, `hangisi birlikte verilmiştir` gibi sinav kalibina cevrilir; tek dogru uzun cumle, dort absurt secenek yapma.

## Çeldirici kalitesi

Iyi çeldirici, yanlis oldugu halde ayni konu evreninden gelir.

Kullanilabilecek çeldirici kaynaklari:

- Ayni maddede gecen baska sureler.
- Ayni kisimdaki baska yetkili makamlar.
- Benzer hak, yasak, istisna veya sartlar.
- Kapsam icine giren/girmeyen yakin gruplar.
- Bir usulun farkli asamalari.
- Ayni mevzuatta bulunan ama sorulan hukum icin gecerli olmayan kavramlar.
- Soru dogru cevabi bir merci ise diger şıklar da kamu/adli/idari merci olmalidir.
- Soru dogru cevabi sure/oran/sayi ise diger şıklar da makul ve yakin sure/oran/sayi olmalidir.
- Soru dogru cevabi bir yaptirim/ceza/hak/yasak ise diger şıklar ayni mevzuat ailesinden benzer yaptirim/ceza/hak/yasak olmalidir.

Kullanilmayacak çeldirici turleri:

- Kaynakta hic gecmeyen uydurma makamlar.
- Asiri genel ahlaki ifadeler.
- Bariz sacma secenekler.
- Ayni hukuk evrenine ait olmayan ve ilk bakista elenen secenekler.
- Dogru cevabin yaninda konu disi kurumlar, okul/idare/medya/vergi gibi alakasiz alanlardan rastgele secenekler.
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
5. Dogru cevabin hangi kategoriye ait oldugunu belirle: sure, merci, ceza, hak, yasak, kapsam, istisna, usul, tanim.
6. Sonra ayni kategori ve mevzuat evreninden 4 guclu celistirici kur.
7. Soru kokunu yazili cevap gibi degil, coktan secmeli sinav formunda kur.
8. JSON'a yazmadan once topic eslemesini kontrol et.

## Uretim versiyonu

- Yeni kalite rejimiyle sifirdan uretilen sorularda `q_version` alani kullanilir.
- Bu tur icin `q_version: 5` yaz.
- Revize edilen eski sorulara otomatik `q_version` yazma; sadece sifirdan yeni uretilen ve ekip tarafindan yeni kalite seti olarak izlenecek sorular isaretlenir.
- `q_version`, kalite takibi icindir; soru kokune veya aciklama metnine yazilmaz.

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
- Yeni kalite seti ise `q_version: 5` var mi?
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
