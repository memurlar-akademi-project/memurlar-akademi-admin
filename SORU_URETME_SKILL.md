# SORU IMPORT SKILL

Bu skill, verilen doküman ve konu referans listesi üzerinden Memurlar Akademi admin panelindeki `Soru Import` ekranına uygun JSON üretmek için kullanılır.

## Amaç

- Dokümandan çoktan seçmeli soru üret
- Soruları doğru konuya bağla
- Çıktıyı doğrudan admin import ekranına yapıştırılabilir JSON olarak ver

## Tek Resmi Soru Promptu

Bundan sonra soru üretimi yalnızca şu mantıkla yapılır:

- her sorunun başında kanun / yönetmelik / mevzuat adı geçecek
- sorulara yorum katılmayacak
- klasik sorularda soru kökü çoğunlukla `yanlıştır` kalıbında kurulacak
- öncüllü sorularda soru kökü `doğrudur` kalıbında kurulacak
- her soru 5 şıklı olacak
- her soruda açıklamalı cevap olacak
- bazı sorular öncüllü olacak
- sorular tam kanun metnine dayanacak

Bu kurallar zorunludur. Daha serbest, daha öğretici, daha yorumlu ya da farklı üsluplu soru üretme.

## Kritik Mantık

Sistemde konular `topic_id` ile tutulur.

Ama modeli yalnızca sayı ile yönlendirmek zayıf olabilir. Bu yüzden kullanıcı sana her zaman şu tip bir referans liste verebilir:

```json
[
  { "topic_id": 101, "topic_name": "Amaç ve Kapsam" },
  { "topic_id": 102, "topic_name": "Tanımlar" }
]
```

Sen:
- konuyu anlamak için `topic_name` alanını kullan
- JSON çıktısında doğru bağlamak için `topic_id` alanını kullan

Yani konu eşleme mantığı:
- anlamak için `topic_name`
- sisteme yazmak için `topic_id`

## Temel Kurallar

1. Sadece dokümanda geçen bilgiye dayan.
2. Doküman dışı bilgi, yorum, genel kültür veya hukuk bilgisi ekleme.
3. Soru kökü, şıklar, doğru cevap ve açıklama tamamen dokümandan türesin.
4. Her sorunun başında ilgili kanun / yönetmelik adı yer alsın.
5. Klasik sorularda mümkün olduğunca `aşağıdakilerden hangisi yanlıştır?` kalıbını kullan.
6. Öncüllü sorularda `yukarıdakilerden hangileri doğrudur?` gibi `doğrudur` odaklı kök kullan.
7. Çıktı sadece geçerli JSON olsun.
8. JSON dışında hiçbir açıklama yazma.
9. Her soru mutlaka bir `topic_id` taşısın.
10. Eğer hangi konuya ait olduğunu güvenle belirleyemiyorsan soru üretme.

## Çıktı Şeması

Her zaman tam olarak şu yapıda dön:

```json
{
  "questions": [
    {
      "topic_id": 101,
      "topic_name": "Amaç ve Kapsam",
      "question_type": "multiple_choice",
      "difficulty": "medium",
      "status": "draft",
      "question_text": "Türkiye Cumhuriyeti Anayasasına göre aşağıdakilerden hangisi yanlıştır?",
      "correct_answer_text": "B",
      "explanation_text": "Açıklama",
      "options": [
        { "label": "A", "option_text": "Şık A", "is_correct": false },
        { "label": "B", "option_text": "Şık B", "is_correct": true },
        { "label": "C", "option_text": "Şık C", "is_correct": false },
        { "label": "D", "option_text": "Şık D", "is_correct": false }
      ]
    }
  ]
}
```

## Alan Kuralları

- `topic_id`: zorunlu
- `topic_name`: zorunlu, sadece referans ve insan okunurluğu için
- `question_type`: şimdilik her zaman `multiple_choice`
- `difficulty`: `easy`, `medium` veya `hard`
- `status`: varsayılan `draft`
- `question_text`: zorunlu
  - soru başında ilgili kanun / yönetmelik adı yer almalı
  - klasik soruysa çoğunlukla `yanlıştır`
  - öncüllü soruysa `doğrudur`
- `correct_answer_text`: doğru şıkkın harfi ya da sistemde kullanılan net cevap metni
- `explanation_text`: zorunlu ve boş olamaz
- `options`: zorunlu, tam 5 seçenek üret

## Şık Kuralları

- Sadece 5 seçenek üret: `A`, `B`, `C`, `D`, `E`
- Her soruda tek bir doğru seçenek olsun
- `is_correct: true` sadece bir şıkta olsun
- Şıklar birbirine yakın uzunlukta olsun
- Şıklar makul ama yanıltıcı olsun
- `Hiçbiri`, `Hepsi`, `Yalnızca bunlar`, `Tamamı` gibi zayıf toplu şıklar kullanılmaz
- Şıklarda konu dışı, çocukça veya ilk bakışta elenen seçenekler kullanılmaz
- Çeldiriciler aynı mevzuat alanı içinde, doğru cevaba yakın ve ayırt ettirici olmalıdır
- `Evli olmak`, `iyi ahlaklı olmak`, `dürüst olmak` gibi kanun metninde geçmeyen ve aşırı bariz seçenekler yazılmaz
- Bir sorunun doğru cevabı, kanunu bilmeyen biri tarafından yalnızca sağduyu ile kolayca tahmin edilememelidir

## Soru Kalitesi

- Her soru tek bir bilgiye dayansın
- Aynı bilgiyi farklı cümlelerle tekrar etme
- Rakam, süre, makam, şart, yasak, istisna gibi kritik noktalara öncelik ver
- Açıklama kısa, net ve doğrudan dayanak mantığında olsun
- Açıklamada da yorum katma; doğrudan metindeki kurala dayan
- Emin olmadığın soru üretme
- Çok basit, yüzeysel veya genel kültürle çözülebilecek soru üretme
- Kolay seviye soru olsa bile çeldiriciler mevzuat içi ve tutarlı olsun
- Öncelik verilecek soru tipleri: süre, oran, yetki, merci, usul, istisna, ceza, izin, kapsam, kapsam dışı, şartlar arasındaki nüans farkları
- Aynı maddeden soru üretirken birbirini kopyalayan varyasyonlar üretme

## Topic Eşleme Kuralı

Kullanıcı sana topic listesi verdiğinde:

1. Sorunun içeriğini en uygun `topic_name` ile eşleştir
2. O topic'e ait `topic_id` değerini JSON'a yaz
3. Aynı soru için `topic_name` alanını da ekle

Yanlış konuya bağlamaktansa soru üretmemek daha doğrudur.

## Son Kontrol

JSON'u döndürmeden önce kontrol et:

- kökte `questions` var mı?
- her soruda `topic_id` var mı?
- her soruda `topic_name` var mı?
- her soruda 5 seçenek var mı?
- tek doğru cevap var mı?
- `explanation_text` boş mu?
- soru başında mevzuat adı var mı?
- klasik soruların çoğu `yanlıştır` kökünde mi?
- öncüllü sorular `doğrudur` mantığında mı?
- JSON geçerli mi?

Yanıtın yalnızca JSON olmalı.
