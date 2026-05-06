# Soru Revizyon Yönergesi

Bu doküman, mevcut soru bankasını sınav tarzına yaklaştırmak için kullanılacak kalıcı revizyon standardıdır. Amaç sıfırdan binlerce soru üretmek değil; mevcut soruları konu konu ele alıp sınav mantığına uygun hale getirmektir.

## Ana Yaklaşım

- `2709 Türkiye Cumhuriyeti Anayasası` için dışarıdan alınan örnek soru seti, yalnızca sınav tarzını anlamak için benchmark olarak kullanılır.
- Diğer dersler için ayrıca örnek soru toplamak zorunlu değildir; sınav dili ve soru kalıbı tüm mevzuat derslerinde aynı mantıkla uygulanır.
- Mevcut sorular ham soru bankası olarak kabul edilir. Bilgi doğruysa soru mümkün olduğunca kurtarılır; yalnızca çok zayıf, tekrar, anlamsız veya kurtarılamaz sorular değiştirilir.
- Revizyon işlemi konu konu yapılır. 20 soruluk parti yalnızca çalışma kolaylığı içindir; her partiden 20 soru çıkarma zorunluluğu yoktur.
- Sayı hedefi kalite hedefinin önüne geçemez. 10 zayıf soru yerine 1 kaliteli soru tercih edilir.
- Her başlıktan soru üretmek zorunlu değildir. Bir hükümden sınavlık, ayırt edici ve çeldiricisi güçlü soru çıkmıyorsa o hükümden soru üretilmez.
- Çok zayıf mevcut sorular kurtarılmaya çalışılmaz; gerekiyorsa tamamen elenir veya aynı konunun daha sınavlık kazanımından yeni soru yazılır.
- OpenRouter/harici kalite agentı bu aşamada zorunlu değildir; maliyeti azaltmak için revizyon manuel Codex çalışmasıyla yürütülür.
- Üretilen veya revize edilen içeriklerin bir sınav sorusu olduğu unutulmamalıdır. Amaç konu anlatımı yazmak değil, sınav adayının bilgiyi ayırt etmesini ölçmektir.
- Normatif dayanak kaynak metindir. Doğru cevap, seçenek ve açıklamalarda kaynakta olmayan hüküm kurulamaz; kaynak hüküm yorumla genişletilemez, daraltılamaz veya anlamı değiştirilemez.
- Çeldirici üretirken de kaynak metnin mantığı dışına çıkılmaz. Yanlış seçenekler makul görünmeli, ancak normatif olarak doğruymuş gibi uydurulmuş yeni hükümler içermemelidir.

## 2709 Benchmark'tan Çıkan Standart

Örnek sınav setlerinde sorular genellikle şu özellikleri taşır:

- Soru kökü mevzuat adıyla başlar: `T.C. Anayasası'na göre...`, `657 sayılı Devlet Memurları Kanunu'na göre...`
- Sorular yalnızca düz bilgi sormaz; kapsam, istisna, süre, yetki, şart, sonuç ve sınıflandırma ilişkilerini ölçer.
- `yanlıştır`, `değildir`, `yer almaz`, `söylenemez` gibi olumsuz kökler kullanılır.
- I-II-III öncüllü sorular kullanılır.
- Çeldiriciler aynı mevzuat ailesinden gelir; absürt, kolay elenen veya konu dışı seçenek kullanılmaz.
- Doğru cevap diğer şıklardan bariz uzun, bariz resmi veya tek makul seçenek gibi durmaz.
- Açıklamalar kısa ama öğreticidir; sadece cevabı tekrar etmez.

## Direkt Bilgi Soruları

Direkt bilgi soruları tamamen yasak değildir. Sınavlarda doğrudan bilgi soruları da bulunur.

Ancak direkt bilgi soruları şu seviyede olmamalıdır:

- Herkesin kolayca ayırt edebileceği çok temel kimlik bilgileri.
- Kaynak cümlede yan yana geçen iki ifadeden birini soran metin devamı soruları.
- Adaydan yalnızca kelime veya ifade ezberi isteyen cümle tamamlama soruları.
- Çeldiricileri konu dışı veya açıkça absürt olduğu için doğru cevabı hemen belli eden sorular.

Bu tür sorular çok temel, metin tamamlama hissi veren veya cevabı aşırı bariz olduğu için zayıf kabul edilir. Soru yalnızca kaynak cümledeki bir ifadeyi yakalatıyorsa, sınav tarzı kabul edilmez.

Direkt bilgi soruları şu alanlarda kullanılabilir:

- Süreler
- Yetkili makamlar
- Başvuru/usul şartları
- Kapsama giren veya girmeyen haller
- İstisnalar
- Yasaklar
- Karar yeter sayıları
- Hukuki sonuçlar

Direkt bilgi sorusu yazılacaksa bile ölçtüğü şey anlamlı bir sınav kazanımı olmalıdır. Adaydan yalnızca bir cümlenin devamını hatırlaması değil; hükmün kapsamını, sonucunu, sınırını, istisnasını veya diğer hükümlerle ilişkisini ayırt etmesi beklenmelidir.

Daha iyi yaklaşım:

```text
Mevzuat hükmündeki temel ilke, yetki sınırı, istisna veya hukuki sonuç üzerinden adayın ayırt etme becerisini ölçmek.
```

veya:

```text
Birden fazla yakın ifadeyi birlikte verip hangilerinin hükümle bağdaştığını veya bağdaşmadığını sormak.
```

## Soru Tipi Karışımı

Her 20 soruluk partide tek tip soru yazılmamalıdır. Hedef karışım yaklaşık olarak şöyledir:

- 5-7 adet direkt bilgi/usul/süre/yetki sorusu
- 4-6 adet olumsuz köklü soru
- 3-5 adet kapsam/istisna sorusu
- 2-4 adet I-II-III öncüllü soru
- 2-3 adet karşılaştırma veya sınıflandırma sorusu

Bu oranlar katı kota değildir. Konunun yapısı uygunsa değişebilir; ancak tüm parti düz bilgi sorularından oluşmamalıdır.

## Öncüllü Soru Formatı

Öncüllü sorularda öncüller soru metninin başında alt alta yazılır. UI tarafında düzgün görünmesi için satır sonları korunmalıdır.

Doğru format:

```text
I. Milli güvenlik
II. Kamu düzeni
III. Suç işlenmesinin önlenmesi

T.C. Anayasası'na göre yukarıdakilerden hangileri konut dokunulmazlığının sınırlanması sebepleri arasında yer alır?
```

Yanlış format:

```text
I. Milli güvenlik II. Kamu düzeni III. Suç işlenmesinin önlenmesi T.C. Anayasası'na göre...
```

Öncüller yan yana düz metin gibi yazılmamalıdır.

## Revizyon Kararları

Her soru için aşağıdaki kararlardan biri verilir:

- `keep`: Soru sınav standardına uygundur; en fazla küçük yazım/dil düzeltmesi yapılır.
- `light_edit`: Soru kökü uygundur, şıklar veya açıklama güçlendirilir.
- `rewrite`: Bilgi doğru ama soru sınav tarzında değildir; kök, şıklar ve açıklama yeniden yazılır.
- `replace`: Soru çok basit, tekrar, anlamsız veya kurtarılamazdır; aynı kazanımdan yeni soru yazılır.
- `delete`: Soru gereksizdir ve yerine soru yazılması uygun değildir.

## Soru Kökü Kuralları

- Soru kökü madde numarasıyla başlamamalıdır.
- `Madde 45'e göre...` yerine ilgili mevzuat adı kullanılmalıdır.
- Mevzuat adı doğal biçimde yazılmalıdır.
- `... kısmına göre`, `... bölümüne göre`, `... maddeye göre` gibi konu/bölüm/madde etiketi tekrarları varsayılan kalıp haline getirilmemelidir.
- Soru kökü her seferinde `şu bakımdan`, `bu kapsamda`, `... ile ilgili` gibi kalıplara zorlanmamalıdır. Bu ifadeler yalnızca sorunun anlamını netleştiriyorsa kullanılmalıdır.
- Konu adı veya alt başlık, soru kökünde otomatik tekrar edilmez. Gerekliyse doğal kavram olarak kullanılır.
- Soru kökü gereksiz uzun olmamalı; ancak ölçülen şart açıkça anlaşılmalıdır.
- `hangisi doğrudur` ve `hangisi yanlıştır` kökleri kullanılabilir, ama aynı partide sürekli tekrarlanmamalıdır.
- Soru kökü tek kelime cevabı çağıracak kadar basit olmamalıdır.

Doğal soru kökü örnekleri:

```text
T.C. Anayasası'na göre, aşağıdakilerden hangisi değiştirilemeyecek hükümlerden biridir?
```

```text
T.C. Anayasası'na göre, egemenliğin kullanılması hakkında aşağıdakilerden hangisi yanlıştır?
```

```text
T.C. Anayasası'na göre, aşağıdakilerden hangisi sosyal ve ekonomik haklar arasında yer almaz?
```

Gereksiz kalıplaşmış örnekler:

```text
T.C. Anayasası'nın Başlangıç kısmına göre...
```

```text
T.C. Anayasası'nın üçüncü kısmının ikinci bölümüne göre...
```

```text
T.C. Anayasası'na göre, millet iradesi bakımından...
```

Son örnekteki `bakımından` ifadesi ancak gerçekten karşılaştırma veya hukuki yön soruluyorsa kullanılmalıdır. Aksi halde soru dili gereksiz yapaylaşır.

## Şık Kuralları

- Her soruda 5 seçenek olmalıdır.
- Çeldiriciler aynı konu ailesinden gelmelidir.
- Absürt seçenek kullanılmamalıdır.
- Doğru cevap diğer şıklardan belirgin uzun veya belirgin resmi görünmemelidir.
- Şık uzunlukları mümkün olduğunca dengeli olmalıdır.
- Çeldiriciler yanlış olmalı ama sınav adayı için makul görünmelidir.
- `hepsi`, `hiçbiri` gibi seçenekler zorunlu olmadıkça kullanılmamalıdır.
- Doğru cevap dağılımı doğal olmalıdır; A/B/C/D/E yapay eşitlenmeye çalışılmamalıdır.

## Açıklama Kuralları

- `Kaynak metne göre...` kalıbı kullanılmamalıdır.
- Açıklama kullanıcıya cevabın dayandığı mevzuat parçasını göstermelidir.
- Açıklamada yorum veya normatif genişletme yapılmamalıdır. Kaynakta olmayan anlam kurulamaz.
- Tüm madde veya tüm konu metni kopyalanmamalıdır. Yalnızca soruyu çözdüren ilgili hüküm parçası gösterilmelidir.
- Kritik mevzuat ifadesi korunmalıdır. Mümkün olduğunca kaynak metindeki ifade kullanılmalı, yalnızca bağlayıcı kısa cevap bağlantısı eklenmelidir.
- Açıklama yalnızca doğru cevabı tekrar etmemelidir; ilgili hüküm ile doğru cevap arasındaki teknik bağlantıyı göstermelidir.
- Olumsuz köklü sorularda cevap bağlantısı, sorunun ters hükmü aradığını açıkça belirtmelidir.
- Açıklama çok kısa cevap anahtarı gibi kalmamalı, gereksiz uzun mevzuat kopyasına da dönüşmemelidir.

Tercih edilen açıklama yapısı:

```text
Dayanak: [Mevzuat adı] [madde/başlık/dayanak bilgisi].
İlgili hüküm: “Soruyu çözdüren kaynak hüküm parçası.”
Cevap bağlantısı: Sorunun istediği doğru/yanlış/kapsam dışı ifade bu hükme göre belirlenir.
```

Madde numarası olan yerlerde dayanak maddeyle verilmelidir:

```text
Dayanak: T.C. Anayasası m. 21 - Konut dokunulmazlığı.
İlgili hüküm: “Kimsenin konutuna dokunulamaz. Millî güvenlik, kamu düzeni, suç işlenmesinin önlenmesi, genel sağlık ve genel ahlâkın korunması veya başkalarının hak ve özgürlüklerinin korunması sebeplerinden biri veya birkaçına bağlı olarak usulüne göre verilmiş hâkim kararı olmadıkça ... kimsenin konutuna girilemez, arama yapılamaz ve buradaki eşyaya el konulamaz.”
Cevap bağlantısı: Konuta girme, arama ve el koyma şartı bu hükümdeki sebepler ve hâkim kararı şartıyla belirlenir.
```

Madde numarası olmayan metinlerde dayanak başlık/metin adıyla verilmelidir:

```text
Dayanak: T.C. Anayasası Başlangıç metni.
İlgili hüküm: “... egemenliğin kayıtsız şartsız Türk Milletine ait olduğu ve bunu millet adına kullanmaya yetkili kılınan hiçbir kişi ve kuruluşun ... hukuk düzeni dışına çıkamayacağı ...”
Cevap bağlantısı: Soruda yanlış ifade arandığı için, bu hükmün tersini söyleyen seçenek doğru cevaptır.
```

Örnek açıklama:

```text
Dayanak: T.C. Anayasası m. 32 - Düzeltme ve cevap hakkı.
İlgili hüküm: “Düzeltme ve cevap yayımlanmazsa, yayımlanmasının gerekip gerekmediğine hakim tarafından ilgilinin müracaat tarihinden itibaren en geç yedi gün içerisinde karar verilir.”
Cevap bağlantısı: Süre sorulduğu için cevap, ilgili hükümde geçen “en geç yedi gün” ifadesidir.
```

## Kalite Kontrol Listesi

Bir soru revize edilmiş sayılmadan önce şu kontroller yapılır:

- Soru mevzuat adıyla başlıyor mu?
- Soru kökü sınav tarzında mı?
- Cevap aşırı bariz mi?
- Doğru şık diğerlerinden çok uzun veya çok özel mi?
- Çeldiriciler aynı konu ailesinden mi?
- Açıklama öğretici mi?
- Öncüllü soru varsa öncüller alt alta mı?
- Soru mevcut başka soruyla çok benzer mi?
- Soru ilgili konuya bağlı kalıyor mu?
- Cevap anahtarı doğru mu?

## Çalışma Akışı

1. Bir ders ve konu seçilir.
2. O konuya ait sorular 20'li partiler halinde alınır.
3. Her soru için `keep`, `light_edit`, `rewrite`, `replace` veya `delete` kararı verilir.
4. Revize edilen parti JSON/import formatına uygun şekilde kaydedilir.
5. Parti sonunda kısa rapor hazırlanır.
6. Onaylanan standart sonraki partilere aynen uygulanır.

## Parti Rapor Formatı

Her 20'li partinin sonunda şu özet tutulur:

```json
{
  "batch": "2709 - Genel Esaslar - 001",
  "total": 20,
  "kept": 4,
  "light_edited": 6,
  "rewritten": 8,
  "replaced": 2,
  "deleted": 0,
  "notes": [
    "Düz bilgi soruları azaltıldı.",
    "Çeldiriciler aynı mevzuat ailesinden yeniden yazıldı.",
    "Öncüllü sorularda satır sonları korundu."
  ]
}
```

## Başarı Ölçütü

Bir partinin başarılı sayılması için:

- Ekip soruları çözerken doğru cevap ilk bakışta bağırmamalıdır.
- Soru kökleri gerçek sınav diline yakın olmalıdır.
- Direkt bilgi, olumsuz kök, öncül ve kapsam soruları dengeli dağılmalıdır.
- Açıklamalar kısa, net ve öğretici olmalıdır.
- Aynı konu içinde birbirinin neredeyse aynısı sorular kalmamalıdır.
