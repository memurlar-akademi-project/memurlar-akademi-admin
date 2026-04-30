# KONU IMPORT SKILL

Bu dosya artık kısa bir çalışma notudur.

Detaylı ve tek resmi kural seti:

- [KONU_ANALIZ_REHBERI.md](/Users/pazanova-5/Desktop/projects/memurlar-akademi-admin/KONU_ANALIZ_REHBERI.md)

## Kullanım

- Dokümanı parçalamadan önce ana referans olarak `KONU_ANALIZ_REHBERI.md` okunur.
- Konu import çıktısı her zaman structured JSON olur.
- `content_body` tek başına kullanılmaz.
- Kullanıcının verdiği bölme kuralı (`KISIM`, `BÖLÜM`, başlık vb.) aynen uygulanır.
- Tüm detay kuralları, temizlik mantığı, listeleme, tablo koruma, ek madde, orphan paragraf ve shard yaklaşımı ana rehberden alınır.

## Çıktı İskeleti

```json
{
  "subject_id": 1,
  "topics": [
    {
      "name": "KISIM - I - Genel Hükümler",
      "status": "draft",
      "content_blocks": []
    }
  ]
}
```
