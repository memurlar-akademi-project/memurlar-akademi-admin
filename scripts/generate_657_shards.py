#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

import json
import re
from pathlib import Path


BASE_DIR = Path("/Users/pazanova-5/Desktop/projects/memurlar-akademi-admin/Komiser Yardımcılığı Sınavı")
RAW_PATH = BASE_DIR / "657_raw.txt"
OUTPUT_DIR = BASE_DIR / "657_parca_importlari_final"
SUBJECT_ID = 1
TARGET_PARAGRAPH_WORDS = 95
HARD_PARAGRAPH_WORDS = 150
MIN_SPLIT_WORDS = 28


KISIMS = [
    ("II", "Sınıflandırma", "657_02_KISIM_II_Siniflandirma.json"),
    ("III", "Devlet Memurluğuna Alınma", "657_03_KISIM_III_Devlet_Memurluguna_Alinma.json"),
    ("IV", "Hizmet Şartları ve Şekilleri", "657_04_KISIM_IV_Hizmet_Sartlari_ve_Sekilleri.json"),
    ("V", "Mali Hükümler", "657_05_KISIM_V_Mali_Hukumler.json"),
    ("VI", "Sosyal Haklar ve Yardımlar", "657_06_KISIM_VI_Sosyal_Haklar_ve_Yardimlar.json"),
    ("VII", "Devlet Memurlarının Yetiştirilmesi", "657_07_KISIM_VII_Devlet_Memurlarinin_Yetistirilmesi.json"),
    ("VIII", "Çeşitli Hükümler", "657_08_KISIM_VIII_Cesitli_Hukumler.json"),
]


ARTICLE_RE = re.compile(r"^Madde\s+(\d+)\s*[–-]\s*(.*)$")
ORDERED_RE = re.compile(r"^(\d+)\s*(?:[.)]|[-–])\s*(.*)$")
ALPHA_RE = re.compile(r"^([A-Za-zÇĞİÖŞÜçğıöşü])\)\s*(.*)$")


def seg(text: str) -> dict:
    return {"text": text, "bold": True}


def normalize_space(text: str) -> str:
    text = text.replace("\xa0", " ")
    text = text.replace(" ", " ")
    text = text.replace("\u2009", " ")
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r"\s+([,.;:])", r"\1", text)
    text = re.sub(r"([.!?])([A-ZÇĞİÖŞÜ])", r"\1 \2", text)
    return text.strip()


def word_count(text: str) -> int:
    return len(re.findall(r"\S+", text))


def split_by_pattern(text: str, pattern: str) -> list[str]:
    pieces: list[str] = []
    start = 0
    for match in re.finditer(pattern, text):
        end = match.end()
        pieces.append(text[start:end].strip())
        start = end
    tail = text[start:].strip()
    if tail:
        pieces.append(tail)
    return [piece for piece in pieces if piece]


def pack_readable_chunks(pieces: list[str], target_words: int = TARGET_PARAGRAPH_WORDS) -> list[str]:
    chunks: list[str] = []
    current: list[str] = []
    current_words = 0

    for piece in pieces:
        piece = normalize_space(piece)
        if not piece:
            continue

        piece_words = word_count(piece)
        if current and current_words + piece_words > target_words and current_words >= MIN_SPLIT_WORDS:
            chunks.append(normalize_space(" ".join(current)))
            current = [piece]
            current_words = piece_words
        else:
            current.append(piece)
            current_words += piece_words

    if current:
        chunks.append(normalize_space(" ".join(current)))

    return chunks


def split_long_text(text: str) -> list[str]:
    text = normalize_space(text)
    if word_count(text) <= HARD_PARAGRAPH_WORDS:
        return [text] if text else []

    sentence_pieces = split_by_pattern(text, r"(?<=[.!?])\s+")
    sentence_chunks = pack_readable_chunks(sentence_pieces)
    if sentence_chunks and max(word_count(chunk) for chunk in sentence_chunks) <= HARD_PARAGRAPH_WORDS:
        return sentence_chunks

    semi_pieces: list[str] = []
    for chunk in sentence_chunks or [text]:
        if word_count(chunk) > HARD_PARAGRAPH_WORDS:
            semi_pieces.extend(split_by_pattern(chunk, r"(?<=;)\s+"))
        else:
            semi_pieces.append(chunk)
    semi_chunks = pack_readable_chunks(semi_pieces)
    if semi_chunks and max(word_count(chunk) for chunk in semi_chunks) <= HARD_PARAGRAPH_WORDS:
        return semi_chunks

    comma_pieces: list[str] = []
    for chunk in semi_chunks or [text]:
        if word_count(chunk) > HARD_PARAGRAPH_WORDS:
            comma_pieces.extend(split_by_pattern(chunk, r"(?<=,)\s+"))
        else:
            comma_pieces.append(chunk)

    return pack_readable_chunks(comma_pieces)


def postprocess_blocks(blocks: list[dict]) -> list[dict]:
    processed: list[dict] = []

    for block in blocks:
        block_type = block.get("type")

        if block_type == "paragraph" and isinstance(block.get("content"), str):
            for part in split_long_text(block["content"]):
                processed.append({**block, "content": part})
            continue

        if block_type in {"list", "ordered_list", "alpha_list"} and isinstance(block.get("items"), list):
            items = []
            for item in block["items"]:
                if isinstance(item, str):
                    items.append("\n\n".join(split_long_text(item)))
                else:
                    items.append(item)
            processed.append({**block, "items": items})
            continue

        processed.append(block)

    return processed


def strip_legal_notes(text: str) -> str:
    if not text:
        return ""

    text = text.replace("(…)", "").replace("(...)", "")
    note_pattern = re.compile(
        r"\((?=[^)]*(?:\d{1,2}/\d{1,2}/\d{2,4}|KHK|md\.|Mülga|Değişik|Ek paragraf|Ek fıkra|Aynen kabul|İptal|Yeniden düzenleme))[^)]*\)"
    )
    prev = None
    while prev != text:
        prev = text
        text = note_pattern.sub("", text)
    return normalize_space(text)


def is_substantive(text: str) -> bool:
    cleaned = strip_legal_notes(text)
    if not cleaned:
        return False
    if cleaned.lower().startswith("mülga"):
        return False
    return True


def slugify_ascii(text: str) -> str:
    repl = str.maketrans(
        {
            "Ç": "C",
            "Ğ": "G",
            "İ": "I",
            "Ö": "O",
            "Ş": "S",
            "Ü": "U",
            "ç": "c",
            "ğ": "g",
            "ı": "i",
            "ö": "o",
            "ş": "s",
            "ü": "u",
        }
    )
    text = text.translate(repl)
    text = re.sub(r"[^A-Za-z0-9]+", "_", text).strip("_")
    return text


def split_kisims(raw: str) -> dict[str, str]:
    markers = list(re.finditer(r"^KISIM\s*-\s*([IVXLC]+)\s*$", raw, re.M))
    result: dict[str, str] = {}
    for i, marker in enumerate(markers):
        roman = marker.group(1)
        start = marker.start()
        end = markers[i + 1].start() if i + 1 < len(markers) else len(raw)
        result[roman] = raw[start:end].strip()
    return result


def next_nonempty(lines: list[str], start: int) -> str | None:
    for idx in range(start, len(lines)):
        if lines[idx].strip():
            return lines[idx].strip()
    return None


def split_inline_alpha(text: str) -> list[str]:
    parts = re.split(r"(?=(?:^|\s)[A-ZÇĞİÖŞÜ]\)\s)", text)
    items = []
    for part in parts:
        part = normalize_space(part)
        if re.match(r"^[A-ZÇĞİÖŞÜ]\)\s+", part):
            items.append(part)
    return items


def build_kisim_ii() -> list[dict]:
    rows = [
        ["İlkokulu bitirenler", "15", "1", "7", "Son"],
        ["Ortaokulu bitirenler", "14", "2", "5", "Son"],
        ["Ortaokul dengi mesleki veya teknik öğrenimi bitirenler", "14", "3", "5", "Son"],
        ["Ortaokul üstü 1 yıl mesleki veya teknik öğrenimi bitirenler", "13", "1", "4", "Son"],
        ["Ortaokul üstü 2 yıl mesleki veya teknik öğrenimi bitirenler", "13", "2", "4", "Son"],
        ["Liseyi bitirenler", "13", "3", "3", "Son"],
        ["Lise dengi mesleki veya teknik öğrenimi bitirenler", "12", "2", "3", "Son"],
        ["Lise veya dengi okullar üstü 1 yıllık mesleki veya teknik öğrenimi bitirenler", "11", "1", "2", "Son"],
        ["Lise veya dengi okullar üstü 2 yıl veya Ortaokul üstü en az 5 yıllık mesleki veya teknik öğrenimi bitirenler", "10", "1", "2", "Son"],
        ["Lise veya dengi okullar üstü 3 yıl teknik veya mesleki öğrenimi bitirenler", "10", "2", "2", "Son"],
        ["2 yıl süreli yüksek öğrenimi bitirenler", "10", "2", "1", "Son"],
        ["3 yıl süreli yüksek öğrenimi bitirenler", "10", "3", "1", "Son"],
        ["4 yıl süreli yüksek öğrenimi bitirenler", "9", "1", "1", "Son"],
        ["5 yıl süreli yüksek öğrenimi bitirenler", "9", "2", "1", "Son"],
        ["6 yıl süreli yüksek öğrenimi bitirenler", "9", "3", "1", "Son"],
    ]

    cetvel_rows = [
        ["1", "1320", "1380", "1440", "1500", "—", "—", "—", "—", "—"],
        ["2", "1155", "1210", "1265", "1320", "1380", "1440", "—", "—", "—"],
        ["3", "1020", "1065", "1110", "1155", "1210", "1265", "1320", "1380", "—"],
        ["4", "915", "950", "985", "1020", "1065", "1110", "1155", "1210", "1265"],
        ["5", "835", "865", "895", "915", "950", "985", "1020", "1065", "1110"],
        ["6", "760", "785", "810", "835", "865", "895", "915", "950", "985"],
        ["7", "705", "720", "740", "760", "785", "810", "835", "865", "895"],
        ["8", "660", "675", "690", "705", "720", "740", "760", "785", "810"],
        ["9", "620", "630", "645", "660", "675", "690", "705", "720", "740"],
        ["10", "590", "600", "610", "620", "630", "645", "660", "675", "690"],
        ["11", "560", "570", "580", "590", "600", "610", "620", "630", "645"],
        ["12", "545", "550", "555", "560", "570", "580", "590", "600", "610"],
        ["13", "530", "535", "540", "545", "550", "555", "560", "570", "580"],
        ["14", "515", "520", "525", "530", "535", "540", "545", "550", "555"],
        ["15", "500", "505", "510", "515", "520", "525", "530", "535", "540"],
    ]

    item11 = strip_legal_notes(
        "Mesleğe özel yarışma sınavına tabi tutulmak suretiyle alınan; Başbakanlık, Bakanlık, Müsteşarlık ve bağımsız genel müdürlükler müfettiş yardımcıları ile bağlı müfettiş yardımcıları ve Diyanet İşleri Başkanlığı müfettiş yardımcıları, Sosyal Güvenlik Kurumu Müfettiş Yardımcıları, Başbakanlık Uzman Yardımcıları, Adalet Uzman Yardımcıları, Seçim Uzman Yardımcıları, Dışişleri Uzman Yardımcıları, İçişleri Uzman Yardımcıları, Millî Savunma Uzman Yardımcıları, Millî Güvenlik Kurulu Genel Sekreterliği Uzman Yardımcıları, Yükseköğretim Kurulu Uzman Yardımcıları, Özelleştirme İdaresi Başkanlığı Uzman Yardımcıları, Vakıf Uzman Yardımcıları, Tapu ve Kadastro Uzman Yardımcıları, Devlet Personel Başkanlığı Devlet Personel Uzman Yardımcıları, Afet ve Acil Durum Yönetimi Uzman Yardımcıları, Başbakanlık Yüksek Denetleme Kurulu Uzman Yardımcıları, Hazine Müsteşarlığı Bankalar Yeminli Murakıp Yardımcıları, Stajyer Hazine Kontrolörleri, Maiyet memurları; Dışişleri Bakanlığı meslek memurları konsolosluk ve ihtisas memurları; Maliye Bakanlığı Vergi Müfettiş Yardımcıları, Bakanlık Maarif Müfettiş Yardımcıları, Sigorta Denetleme Uzman Yardımcıları ve Aktüer Yardımcıları, Bakanlıklar merkez kuruluşu stajyer kontrolörleri, İçişleri Bakanlığı Dernekler Denetçi Yardımcıları, Sınai Mülkiyet Uzman Yardımcıları, Sosyal Güvenlik Uzman Yardımcıları, Çalışma Uzman Yardımcıları ve Sosyal Güvenlik Eğitim Uzman Yardımcıları, Yurt Dışı İşçi Hizmetleri Uzman Yardımcıları, İş Sağlığı ve Güvenliği Uzman Yardımcıları, Çalışma ve Sosyal Güvenlik Eğitim Uzman Yardımcıları, Kültür ve Turizm Uzman Yardımcıları, Yazma Eser Uzman Yardımcıları, Ulaştırma ve Haberleşme Uzman Yardımcıları, Havacılık ve Uzay Teknolojileri Uzman Yardımcıları, Denizcilik Uzman Yardımcıları, TİKA Uzman Yardımcıları, Maliye Uzman Yardımcıları, Devlet Gelir Uzman Yardımcıları, Defterdarlık Uzman Yardımcıları, Vergi İstihbarat Uzman Yardımcıları, Gelir Uzman Yardımcıları, Mali Hizmetler Uzman Yardımcıları, bakanlık ve bağlı kuruluşların A.B. Uzman Yardımcıları, Hazine Uzman Yardımcıları, Dış Ticaret Uzman Yardımcıları, Diyanet İşleri Uzman Yardımcıları, Din İşleri Yüksek Kurulu Uzman Yardımcıları, Avrupa Birliği İşleri Uzman Yardımcıları, Yurtdışı Türkler ve Akraba Topluluklar Uzman Yardımcıları, Ölçme, Seçme ve Yerleştirme Merkezi Uzman Yardımcıları, Türkiye İstatistik Kurumu Uzman Yardımcıları, Maarif Müfettiş Yardımcıları ile İçişleri Bakanlığı Planlama Uzman Yardımcıları, İstihdam Uzman Yardımcıları, İl İstihdam Uzman Yardımcıları, Kalkınma Bakanlığı Planlama Uzman Yardımcıları, Çevre ve Şehircilik Uzman Yardımcıları, Orman ve Su İşleri Uzman Yardımcıları, Meteoroloji Uzman Yardımcıları, Sanayi ve Teknoloji Uzman Yardımcıları, Gümrük ve Ticaret Uzman Yardımcıları, Gençlik ve Spor Uzman Yardımcıları, Gıda, Tarım ve Hayvancılık Uzman Yardımcıları, Aile ve Sosyal Politikalar Uzman Yardımcıları, İnsan Hakları ve Eşitlik Uzman Yardımcıları, Savunma Sanayii Uzman Yardımcıları, Basın ve Enformasyon Uzman Yardımcıları, Yüksek Kurum Uzman Yardımcıları, Kamu Denetçiliği Uzman Yardımcıları, Aile ve Sosyal Politikalar Denetçi Yardımcıları, Ürün Denetmen Yardımcıları, Sosyal Güvenlik Denetmen Yardımcıları, Millî Eğitim Uzman Yardımcıları, Gençlik ve Spor Denetçi Yardımcıları, Sağlık Uzman Yardımcıları ve Sağlık Denetçi Yardımcıları, Enerji ve Tabii Kaynaklar Uzman Yardımcıları, Göç Uzman Yardımcıları, İl Göç Uzman Yardımcıları, Helal Akreditasyon Uzman Yardımcıları ve Enerji ve Tabii Kaynaklar Denetçi Yardımcıları, Gümrük ve Ticaret Denetmen Yardımcıları, Belediye Müfettiş Yardımcılarının özel yeterlik sınavı yönetmeliklerine göre yapılacak yeterlik sınavlarında başarı göstererek Müfettişliğe, Kaymakamlığa, Başbakanlık Uzmanlığına, Adalet Uzmanlığına, Seçim Uzmanlığına, Dışişleri Uzmanlığına, İçişleri Uzmanlığına, Millî Savunma Uzmanlığına, Millî Güvenlik Kurulu Genel Sekreterliği Uzmanlığına, Yükseköğretim Kurulu Uzmanlığına, Özelleştirme İdaresi Başkanlığı Uzmanlığına, Vakıf Uzmanlığına, Tapu ve Kadastro Uzmanlığına, Devlet Personel Uzmanlığına, Afet ve Acil Durum Yönetimi Uzmanlığına, Bankalar Yeminli Murakıplığına, Vergi Müfettişliğine, Bakanlık Maarif Müfettişliğine, Sigorta Denetleme Uzmanlığına ve Aktüerliğine, Kontrolörlüğe, İçişleri Bakanlığı Dernekler Denetçiliğine, Sınai Mülkiyet Uzmanlığına, Sosyal Güvenlik Uzmanlığına, Çalışma Uzmanlığına, Yurt Dışı İşçi Hizmetleri Uzmanlığına, İş Sağlığı ve Güvenliği Uzmanlığına, Çalışma ve Sosyal Güvenlik Eğitim Uzmanlığına, Kültür ve Turizm Uzmanlığına, Yazma Eser Uzmanlığına, Ulaştırma ve Haberleşme Uzmanlığına, Havacılık ve Uzay Teknolojileri Uzmanlığına, Denizcilik Uzmanlığına, TİKA Uzmanlığına, Devlet Gelir Uzmanlığına, Maliye Uzmanlığına, Gelir Uzmanlığına, Mali Hizmetler Uzmanlığına, Defterdarlık Uzmanlığına, Vergi İstihbarat Uzmanlığına, bakanlık ve bağlı kuruluşların A.B. Uzmanlığına, Hazine Uzmanlığına, Dış Ticaret Uzmanlığına, Diyanet İşleri Uzmanlığına, Din İşleri Yüksek Kurulu Uzmanlığına, Avrupa Birliği İşleri Uzmanlığına, Yurtdışı Türkler ve Akraba Topluluklar Uzmanlığına, Ölçme, Seçme ve Yerleştirme Merkezi Uzmanlığına, Türkiye İstatistik Kurumu Uzmanlığına, Maarif Müfettişliğine, İçişleri Bakanlığı Planlama Uzmanlığına, İstihdam Uzmanlığına, İl İstihdam Uzmanlığına, Kalkınma Bakanlığı Planlama Uzmanlığına, Çevre ve Şehircilik Uzmanlığına, Orman ve Su İşleri Uzmanlığına, Meteoroloji Uzmanlığına, Sanayi ve Teknoloji Uzmanlığına, Gümrük ve Ticaret Uzmanlığına, Gençlik ve Spor Uzmanlığına, Gıda, Tarım ve Hayvancılık Uzmanlığına, Aile ve Sosyal Politikalar Uzmanlığına, İnsan Hakları ve Eşitlik Uzmanlığına, Savunma Sanayii Uzmanlığına, Basın ve Enformasyon Uzmanlığına, Yüksek Kurum Uzmanlığına, Kamu Denetçiliği Uzmanlığına, Aile ve Sosyal Politikalar Denetçiliğine, Ürün Denetmenliğine, Sosyal Güvenlik Denetmenliğine, Millî Eğitim Uzmanlığına, Gençlik ve Spor Denetçiliğine, Sağlık Uzmanlığına ve Sağlık Denetçiliğine, Enerji ve Tabii Kaynaklar Uzmanlığına, Göç Uzmanlığına, İl Göç Uzmanlığına, Helal Akreditasyon Uzmanlığına ve Enerji ve Tabii Kaynaklar Denetçiliğine, Gümrük ve Ticaret Denetmenliğine, Dışişleri Bakanlığı meslek memurluğu ile konsolosluk ve ihtisas memurluğunda ise Dışişleri Bakanlığınca sınavla girilmesi şart koşulan bir dereceye atanmaları sırasında ve bir defaya mahsus olmak üzere haklarında ayrıca bir derece yükselmesi uygulanır."
    )

    return [
        {"type": "section_heading", "content": "KISIM - II"},
        {"type": "section_title", "content": "Sınıflandırma"},
        {"type": "subheading", "content": "Kadroların tespiti"},
        {"type": "article_line", "segments": [seg("Madde 33")]},
        {"type": "paragraph", "content": "Kadrosuz memur çalıştırılamaz."},
        {"type": "paragraph", "content": "Kadrolar, Cumhurbaşkanlığı kararnamesinde gösterildiği şekilde düzenlenir."},
        {"type": "subheading", "content": "Tesis edilen sınıflar"},
        {"type": "article_line", "segments": [seg("Madde 36")]},
        {"type": "paragraph", "content": "Bu Kanuna tabi kurumlarda çalıştırılan memurların sınıfları aşağıda gösterilmiştir."},
        {"type": "subheading", "content": "I - GENEL İDARE HİZMETLERİ SINIFI"},
        {"type": "paragraph", "content": "Bu Kanunun kapsamına dahil kurumlarda yönetim, icra, büro ve benzeri hizmetleri gören ve bu Kanunla tespit edilen diğer sınıflara girmeyen memurlar Genel İdare Hizmetleri sınıfını teşkil eder."},
        {"type": "subheading", "content": "II - TEKNİK HİZMETLER SINIFI"},
        {"type": "paragraph", "content": "Bu Kanunun kapsamına giren kurumlarda meslekleriyle ilgili görevleri fiilen ifa eden ve meri hükümlere göre yüksek mühendis, mühendis, yüksek mimar, mimar, jeolog, hidrojeolog, hidrolog, jeofizikçi, fizikçi, kimyager, matematikçi, istatistikçi, yöneylemci (Hareket araştırmacısı), matematiksel iktisatcı, ekonomici ve benzeri ile teknik öğretmen okullarından mezun olup da öğretmenlik mesleği dışında teknik hizmetlerde çalışanlar, Mimarlık ve Mühendislik Fakültesi veya bölümlerinden mezun şehir plancısı, yüksek şehir plancısı, yüksek Bölge Plancısı, 3437 ve 9/5/1969 tarih 1177 sayılı Kanunlara göre tütün eksperi yetiştirilenler ile müskirat ve çay eksperleri, fen memuru, yüksek tekniker, tekniker, teknisyen ve emsali teknik unvanlara sahip olup, en az orta derecede mesleki tahsil görmüş bulunanlar, Teknik Hizmetler sınıfını teşkil eder."},
        {"type": "subheading", "content": "III - SAĞLIK HİZMETLERİ VE YARDIMCI SAĞLIK HİZMETLERİ SINIFI"},
        {"type": "paragraph", "content": "Bu sınıf, sağlık hizmetlerinde (Hayvan sağlığı dahil) mesleki eğitim görerek yetişmiş olan tabip, diş tabibi, eczacı, veteriner hekim gibi memurlar ile bu hizmet sahasında çalışan yüksek öğrenim görmüş fizikoterapist, tıp teknoloğu, ebe, hemşire, sağlık memuru, sosyal hizmetler mütehassısı, biyolog, pisikolog, diyetçi, sağlık muhendisi, sağlık fizikçisi, sağlık idarecisi ile ebe ve hemşire, hemşire yardımcısı, (Fizik tedavi, laboratuvar, eczacı, diş anestezi, röntgen teknisyenleri ve yardımcıları, çevre sağlığı ve toplum sağlığı teknisyeni dahil) sağlık savaş memuru, hayvan sağlık memuru ve benzeri sağlık personelini kapsar."},
        {"type": "paragraph", "content": "Bu sınıfa dahil personel tarafından yerine getirilmesi gereken hizmetler, lüzumu halinde bedeli döner sermaye gelirlerinden ödenmek kaydıyla, Bakanlıkça tespit edilecek esas ve usullere göre hizmet satın alınması yoluyla gördürülebilir."},
        {"type": "subheading", "content": "IV - EĞİTİM VE ÖĞRETİM HİZMETLERİ SINIFI"},
        {"type": "paragraph", "content": "Bu sınıf, bu Kanun kapsamına giren kurumlarda eğitim ve öğretim vazifesiyle görevlendirilen öğretmenleri kapsar."},
        {"type": "subheading", "content": "V - AVUKATLIK HİZMETLERİ SINIFI"},
        {"type": "paragraph", "content": "Avukatlık hizmetleri sınıfı, özel kanunlarına göre avukatlık ruhsatına sahip, baroya kayıtlı ve kurumlarını yargı mercilerinde temsil yetkisini haiz olan memurları kapsar."},
        {"type": "subheading", "content": "VI - DİN HİZMETLERİ SINIFI"},
        {"type": "paragraph", "content": "Din hizmetleri sınıfı, özel kanunlarına göre çeşitli derecelerde dini eğitim görmüş olan ve dini görev yapan memurları kapsar."},
        {"type": "subheading", "content": "VII - EMNİYET HİZMETLERİ SINIFI"},
        {"type": "paragraph", "content": "Bu sınıf, özel kanunlarına göre çarşı ve mahalle bekçisi, polis, komiser muavini, komiser, başkomiser, emniyet müfettişi, polis müfettişi, emniyet amiri ve emniyet müdürü ile emniyet müdürü sıfatını kazanmış emniyet mensubu memurları kapsar."},
        {"type": "subheading", "content": "VIII - JANDARMA HİZMETLERİ SINIFI"},
        {"type": "paragraph", "content": "Bu sınıf Jandarma Genel Komutanlığı kadrolarında bulunan subay, astsubay, uzman jandarma ile çarşı ve mahalle bekçilerini kapsar."},
        {"type": "subheading", "content": "IX - SAHİL GÜVENLİK HİZMETLERİ SINIFI"},
        {"type": "paragraph", "content": "Bu sınıf Sahil Güvenlik Komutanlığı kadrolarında bulunan subay ve astsubayları kapsar."},
        {"type": "subheading", "content": "X - YARDIMCI HİZMETLER SINIFI"},
        {"type": "paragraph", "content": "Yardımcı hizmetler sınıfı, kurumlarda her türlü yazı ve dosya dağıtmak ve toplamak, müracaat sahiplerini karşılamak ve yol göstermek; hizmet yerlerini temizleme, aydınlatma ve ısıtma işlerinde çalışmak veya basit iklim rasatlarını yapmak; ilaçlama yapmak veya yaptırmak veya tedavi kurumlarında hastaların ve hastanelerin temizliği ve basit bakımı ile ilgili hizmetleri yapmak veya kurumlarda koruma ve muhafaza hizmetleri gibi anahizmetlere yardımcı mahiyetteki görevlerde her kurumun özel bünyesine göre ve yine bu mahiyette olmak üzere ihdasına lüzum gördüğü yardımcı hizmetleri ifa ile görevli bulunanlardan 4 üncü maddenin (D) bendinde tanımlananların dışında kalanları kapsar."},
        {"type": "paragraph", "content": "Bu sınıfa dahil personel tarafından yerine getirilmesi gereken hizmetlerden hizmet yerlerinin ve tedavi kurumlarının temizlenmesi, tesisatın bakım ve işletilmesi ve benzeri nitelikteki hizmetlerin üçüncü şahıslara ihale yoluyla gördürülmesi mümkündür."},
        {"type": "subheading", "content": "XI - MÜLKİ İDARE AMİRLİĞİ HİZMETLERİ SINIFI"},
        {"type": "paragraph", "content": "Bu sınıf, valiler ve kaymakamlar ile bu sıfatları kazanmış olup İçişleri Bakanlığı merkez ve iller kuruluşunda çalışanları ve maiyet memurlarını kapsar."},
        {"type": "subheading", "content": "XII - MİLLİ İSTİHBARAT HİZMETLERİ SINIFI"},
        {"type": "paragraph", "content": "Bu sınıf, Milli İstihbarat Teşkilatı kadrolarında veya bu teşkilat emrinde çalıştırılanlardan özel kanunlarında gösterilen veya Cumhurbaşkanınca tespit edilen görevleri ifa edenleri kapsar."},
        {"type": "heading", "content": "ORTAK HÜKÜMLER"},
        {"type": "subheading", "content": "A) Sınıfların öğrenim durumlarına göre giriş ve yükselebilecek derece ve kademeleri aşağıda gösterilmiştir."},
        {"type": "table", "headers": ["Öğrenim durumu", "Giriş Derece", "Giriş Kademe", "Yükselinebilecek Derece", "Yükselinebilecek Kademe"], "rows": rows},
        {"type": "ordered_list", "items": [
            "Avukatlık stajını açıkta iken yapanlara iki, memuriyette iken yapanlara bir kademe ilerlemesi uygulanır.",
            "Dört yıl süreli yüksek öğrenimi bitirenlerden yüksek mühendis, mühendis, yüksek mimar, mimar sıfatını almış olanlar ile bunlardan öğretmenlik hizmetinde çalışanlar, Erkek Teknik Yüksek Öğretmen Okulu, Erkek Teknik Öğretmen Okulu ve Devlet Tatbiki Güzel Sanatlar Yüksek Okulu mezunları, İstanbul Devlet Güzel Sanatlar Akademisi ile uygulamalı Endüstri Sanatları Yüksek Okulu mezunları, Teknik Eğitim Fakültesi (Yüksek Teknik Öğretmen Okulu ve Güzel Sanatlar Fakültesi, İstanbul Devlet Tatbiki Güzel Sanatlar Yüksek Okulu) mezunları, öğrenimlerine göre tesbit edilen giriş derece ve kademelerine bir derece ilavesiyle hizmete alınırlar.",
            "Beş yıl ve daha fazla süreli yüksek öğrenimini bitirenlerden yüksek mühendis, mühendis, yüksek mimar, mimar sıfatını almış olanlar ile bunlardan eğitim ve öğretim hizmetinde çalışanlar, öğrenimlerine göre tespit edilen giriş derece ve kademelerine bir derece ilavesiyle hizmete alınırlar.",
            "Teknik hizmetler sınıfında görev almak şartiyle jeolog, jeofizikçi, hidrojeolog, hidrolog, jeomorflog, kimyager, fizikçi, matematikçi, istatistikçi, yöneylemci (harekat araştırmacısı), matematiksel iktisatçı (ekonometrici), Erkek Teknik Öğretmen Okulu mezunları, fen memurları, teknikerler ve yüksek teknikerler, tütün ve müskirat eksperleri, tarım alet ve makineleri Uzmanlık Yüksek Okulu mezunları ile benzeri fen bilimleri ve teknik bilimler lisansiyerleri, Mimarlık ve Mühendislik Fakültesi veya bölümlerinden mezun olan şehir plancısı, yüksek şehir plancısı, yüksek bölge plancısı, Gazi Üniversitesi Mesleki Eğitim Fakültesi Teknoloji Bölümü İş ve Teknik Anabilim Dalı mezunları, Ankara Üniversitesi Ziraat Fakültesi Ev Ekonomisi Yüksek Okulu mezunları, üniversitelerin arkeoloji ve sanat tarihi bölümlerinin prehistorya, protohistorya ve önasya arkeolojisi, klasik arkeoloji anabilim dallarından mezun olanlar öğrenimlerine göre tespit edilen giriş derece ve kademelerine bir derece ilavesiyle hizmete alınırlar.",
            "Dört yıl ve daha fazla süreli yüksek öğrenim görenlerden tabip, diş tabibi, veteriner hekim, eczacı ile benzeri sağlık bilimleri lisansiyerleri (Hayvan sağlığı dahil) ve biyolog unvanına sahip akademik personel giriş derece ve kademelerine bir derece eklenmek suretiyle bulunacak derece ve kademelerden hizmete alınırlar.",
            "a) Lise ve dengi okul mezunu olup, özel kanunları gereğince sınava tabi tutularak orta dereceli okul öğretmenliği ehliyetini alanlar ve eğitim müfettişliği unvanını kazananlar, mesleki ve teknik öğretim okulları meslek, atelye veya kurs öğretmenliğinde görevlendirilenler ile özel kanunlarına ya da özel kanunların verdiği izne dayanılarak orta dereceli okul öğretmenliğine atananlar 11 inci derecenin birinci kademesinden hizmete alınırlar. b) Ortaokul ve dengi, lise ve dengi okulların, normal öğrenim süresinden fazla olması halinde, başarılı her öğrenim yılı için bir kademe ilerlemesi uygulanır. Bunlardan teknik öğretim okulları mezunlarına, meslekleri ile ilgili görevlerde çalışmaları halinde ayrıca bir kademe ilerlemesi daha verilir.",
            "a) Kurumlarınca açılan ve bir kısım görevlere atanmada kanuni nitelik olarak şart koşulan kursları, memurluğa girmeden önce başarı ile bitirenler hakkında bu meslekleri ile ilgili görevlerde çalışmış olmak ve 3 kademeyi geçmemek şartiyle, bu kurslarda geçirdikleri başarılı sürelerin her yılı için bir kademe ilerlemesi uygulanır. b) Diyanet İşleri Başkanlığı kuruluşunda halen görevli bulunanlarla yeniden göreve atanacaklardan hafız oldukları Diyanet İşleri Başkanlığınca tespit edilecek bir yönetmelik uyarınca belirlenenlere bir derece yükselmesi verilir. Lisans üstü eğitim sebebiyle verilen derece ve kademe ilerlemesi bu fıkra gereğince verilen derece ilerlemesiyle birlikte uygulanamaz.",
            "a) Emniyet hizmetleri sınıfına girenlerden; ilkokul, ortaokul ve dengi okulları bitirenler, ilkokul ve ortaokulu bitirenlerin giriş derecelerine iki derece; lise ve dengi okulları bitirenler, liseyi bitirenler için tespit edilen giriş derece ve kademesine bir derece bir kademe; yüksek öğrenimi bitirenler aynı yüksek öğrenimi bitirenler için tespit edilen giriş derece ve kademesine bir derece ilavesiyle hizmete alınırlar. b) Genel İdare Hizmetleri sınıfına girenlerden Orman Muhafaza Memuru ve Başmemuru ile Gümrük muhafaza memur ve amirlerine ilkokul ve ortaokul ve lise öğrenimleri için bu kanunda tespit edilen giriş derece ve kademelerine bir derece ilave edilir. c) Mesleki öğrenim veya kurs görmek ve özel yarışma sınavını başarmak suretiyle atanacak Cumhuriyet Senatosu ve Millet Meclisi Tutanak Müdürlüğü stenograflarına öğrenim giriş derece ve kademelerine bir derece ilave edilir. İlave edilmek suretiyle bulunacak derece ve kademelerden hizmete alınırlar.",
            "Memurluğa girmeden önce veya memuriyetleri sırasında yüksek öğrenim üstü master derecesi almış olanlarla yüksek öğrenim kurumlarında en az bir yıl ilave öğrenim yaparak lisans üstü ihtisas sertifikası alanlara bir kademe ilerlemesi, tıpta uzmanlık belgesi alanlara, meslekleri ile ilgili öğrenim dallarında doktora yapanlara bir derece yükselmesi uygulanır. Master derecesini alıp bir kademe ilerlemesinden yararlanan memura, mesleği ile ilgili öğrenim dalında doktora yaptığı takdirde iki kademe ilerlemesi uygulanır.",
            "Doktora üstü üniversite doçentliği unvanını üniversitede görevli iken kazananlara bir derece, diğer memuriyetlerde iken bu unvanı kazananlara iki kademe ilerlemesi uygulanır.",
            item11,
            "a) Memuriyete girmeden önce veya memurlukları sırasında ortaokul ve dengi veya lise ve dengi öğrenim üzerine hizmet içi eğitim sayılmayan ve öğrenim süreleri en az aralıksız 1 veya 2 öğrenim yılı olan ve kurumlarınca açılan mesleki kursları bitirenler hakkında; 1 yıllık öğrenim için 1 kademe, 2 yıldan az olmayan öğrenim için 1 derece yükselmesi uygulanır. b) Lise ve dengi okulları bitirdikten sonra memurlukları sırasında Milli Eğitim Bakanlığınca belli edilen ve kurumlarınca düzenlenen bir yıl süreli mesleki hizmet içi eğitim kurslarını tamamlayanların bulundukları derece ve kademelere bir kademe ilave edilir. c) Memuriyetleri sırasında Türkiye ve Ortadoğu Amme İdaresi Enstitüsünü bitirenlere her başarılı öğrenim yılı için öğrenim süreleri kadar (2 yılı geçmemek şartiyle) her yıl için bir kademe ilerlemesi uygulanır. d) Memuriyette iken veya memuriyetten ayrılarak (87 nci maddeye tâbi kurumlarda çalışanlar dahil) üst öğrenimi bitirenler, aynı üst öğrenimi tahsile ara vermeden başlayan ve normal süresi içinde bitirdikten sonra memuriyete giren emsallerinin ulaştıkları derece ve kademeyi aşmamak kaydıyla, bitirdikleri üst öğrenimin giriş derece ve kademesine memuriyette geçirdikleri başarılı hizmet sürelerinin tamamı her yıl bir kademe, her üç yıl bir derece hesabıyla ilave edilmek suretiyle bulunacak derece ve kademeye yükseltilirler."
        ]},
        {"type": "subheading", "content": "B) Öğrenim durumları itibariyle (A) bendinde gösterilen yükselinebilecek derece ve kademelerden farklı olanlar aşağıda gösterilmiştir."},
        {"type": "ordered_list", "items": [
            "Lise ve lise dengi mesleki veya teknik öğretim görenlerden, öğrenim eksikliğini giderecek hizmet içi eğitimden geçerek, Devlet Personel Başkanlığı tarafından hazırlanacak yönetmelikte belirlenecek esaslara göre yapılacak özel yükselme sınavlarında başarı gösterenler 1 inci derecenin son kademesine kadar yükselebilirler.",
            "(A) bendinin 12 nci fıkrasının (a) şıkkında gösterilenler 3 üncü derecenin son kademesine kadar yükselebilirler.",
            "Emniyet Hizmetleri Sınıfı mensuplarından: a) Emniyet müdürleri ve bu sıfatı taşımakta olan emniyet teşkilatı mensupları ile başkomiser ve emniyet amirleri dışında kalanlar 3 üncü derecenin son kademesine, b) Başkomiser ile emniyet amirleri 2 nci derecenin son kademesine, c) Yukarıda sayılanlardan yükseköğrenimli olanlar 1 inci derecenin son kademesine, d) Emniyet müdürleri ve bu sıfatı taşımakta olan emniyet teşkilatı mensupları 1 inci derecenin son kademesine kadar yükselebilirler."
        ]},
        {"type": "subheading", "content": "C)"},
        {"type": "ordered_list", "items": [
            "Teknik hizmetler sınıfına girenlerden memurluğa girmeden önce yurt içinde veya yurt dışında mesleklerini serbest olarak veya resmi veya özel müesseselerde ifa edenlerle memuriyetten ayrıldıktan sonra bu işlerde çalışarak yeniden memuriyete girmek isteyenlerin teknik hizmetlerde geçen süresinden bu kanun ve bu kanunun 87 nci maddesinde sözü edilen kurumlarda geçen sürenin tamamı ve geri kalan sürenin 3/4 ü toplamı memuriyette geçmiş sayılarak bu süreler her yılı bir kademe ilerlemesi ve her üç yıl için bir derece yükselmesi verilmek suretiyle değerlendirilir.",
            "Sağlık hizmetleri ve yardımcı sağlık hizmetleri sınıfına girenlerden memurluğa girmeden önce yurt içinde veya yurt dışında mesleklerini serbest olarak veya resmi veya özel kurumlarda yapanlarla, memurluktan ayrıldıktan sonra bu işlerde çalışarak yeniden memurluğa girmek isteyenlerin sağlık hizmetlerinde geçen süresinden, bu kanun ve bu kanunun 87 nci maddesinde sözü edilen kurumlarda geçen süreleri ile 196 ncı maddede belirtilen şekilde tespit edilecek mahrumiyet bölgelerinde en az 3 yıl çalışanların veya çalışacak olanların sürelerinin tamamı ve geri kalan sürelerinin 3/4 ü toplamı memurlukta geçmiş sayılarak bu sürelerin her yılı için bir kademe ilerlemesi ve her üç yılı için bir derece yükselmesi verilmek suretiyle değerlendirilir.",
            "Avukatlık hizmetleri sınıfına girenlerin memuriyete girmeden önce veya memurluktan ayrılarak avukatlıkla geçirdikleri sürelerin 3/4 ü memuriyette geçmiş sayılarak, bu sürelerin her yılı bir kademe ilerlemesine ve her üç yılı bir derece yükselmesine esas olacak şekilde değerlendirilir.",
            "Basın Kartları Yönetmeliğine göre, basın kartına sahip olmak suretiyle gazetecilik yaparak memurluğa girenlerin; meslekleriyle ilgili görevlerde istihdam edilmeleri şartiyle, fiilen gazetecilik yaparak geçirdikleri sürenin 3/4 ü fiilen memuriyette geçmiş sayılarak, bu sürenin her yılı bir kademe ilerlemesi ve her üç yılı bir derece yükselmesi verilmek suretiyle değerlendirilir.",
            "Özel okullarda öğretmenlik veya yöneticilik yaptıktan sonra Milli Eğitim Bakanlığı emrinde memuriyet kabul edenlerin özel okullarda geçen hizmet sürelerinin 2/3 ünün her yılı bir kademe ilerlemesine ve her üç yılı bir derece yükselmesine esas olacak şekilde değerlendirilir.",
            "Bu kanunun 4 üncü ve 237 nci maddesinin (e) fıkrasına göre sözleşme ile istihdam edilenlerin, memuriyete geçirilmeleri halinde, sözleşmeli olarak geçirdikleri hizmet süreleri, her yıl için bir kademe ilerlemesi ve her üç yıl için bir derece yükselmesi verilmek suretiyle değerlendirilir.",
            "2834 ve 2836 sayılı kanunlara göre kurulmuş olan Tarım Kredi ve Tarım Satış Kooperatiflerinde çalışanlardan sonradan memuriyete girenlerin bu kooperatiflerde geçen hizmetlerinin 12 yılı geçmemek üzere her yıl için bir kademe ilerlemesi ve her üç yılı için bir derece yükselmesi verilmek suretiyle değerlendirilir.",
            "108 inci maddenin (B) fıkrası uyarınca kullanılan aylıksız izin süreleri, her yıl için bir kademe ilerlemesi ve her üç yıl için bir derece yükselmesi verilmek suretiyle değerlendirilir."
        ]},
        {"type": "paragraph", "content": "Yukarıdaki fıkralara göre, değerlendirilecek hizmet süresinden sadece özel sektörde geçen süre 12 yılı geçemez."},
        {"type": "paragraph", "content": "Ancak, T. C. Emekli Sandığı ve Sosyal Sigortalar kanunlarına tabi görevlerde bulunmuş olanların kazanılmış hakları saklıdır."},
        {"type": "paragraph", "content": "Yapılacak intibak neticesinde ilgililerin girecekleri dereceler öğrenim durumlarına göre yükselebilecekleri derecenin son kademe aylığını geçemez."},
        {"type": "subheading", "content": "D)"},
        {"type": "paragraph", "content": "Memur iken, girişteki öğrenim derecelerinden bir üst derecedeki öğrenimi tamamlayanlar, bu üst öğrenim derecesi için 36 ncı maddede yazılı memuriyete giriş derecelerinde boş kadro bulunduğu takdirde bu kanunun 68 inci maddesinde yazılı derece yükselmesinde süre kaydı aranmaksızın bu derecedeki görevlere atanabilirler. 68 inci maddenin (A) bendinin (b) ve (c) fıkralarındaki hükümler saklıdır."},
        {"type": "subheading", "content": "E)"},
        {"type": "paragraph", "content": "Sınıfların giriş derecelerinin ileri kademelerinden işe başlayanlarla yukarıdaki fıkralar uyarınca kendilerine kademe ilerlemesi uygulananların, kademe ilerlemesine tekabül eden süreleri 68 inci maddede derece yükselmesi için gerekli olduğu öngörülen sürelerin hesabında ayrıca değerlendirilir. Artan süreler üst derece ve kademedeki kanuni bekleme süresinde geçmiş sayılır."},
        {"type": "subheading", "content": "F)"},
        {"type": "paragraph", "content": "Bu kanunla tespit edilen çeşitli hizmet sınıfları mensuplarından Cumhurbaşkanlığı Genel Sekreterliğinde ve Türkiye Büyük Millet Meclisi Başkanlığı İdari Teşkilatında asli ve sürekli görevlerde bulunanların kadro, ünvan, derece ile intibak ve diğer haklarının tespit ve kullanılması ile ilgili yetkiler Cumhurbaşkanlığı Genel Sekreterliği ile Türkiye Büyük Millet Meclisi Başkanlık Divanına aittir."},
        {"type": "paragraph", "content": "Bu kanunla tespit edilen çeşitli hizmet sınıflarına dahil olup da MİT Müsteşarlığı emrinde çalışan MİT mensuplarının atama, derece yükselmesi ve kademe ilerlemesi ve disiplin hükümleri ile ilgili yetkilerin kullanılmasının düzenlenmesi Cumhurbaşkanına aittir."},
        {"type": "paragraph", "content": "Milli İstihbarat hizmetleri sınıfına yapılan atamalarda bu maddenin (A) bendinin (8/a-b) fıkralarındaki derece ve kademe ilerlemesi ile ilgili hükümleri uygulanır."},
        {"type": "subheading", "content": "G)"},
        {"type": "paragraph", "content": "Bu maddede sayılan sınıfların ve fıkraların kapsamının tayininde, benzeri veya eşdeğer öğrenim veya hizmetler Cumhurbaşkanınca tespit olunur."},
        {"type": "subheading", "content": "Yükselinebilecek derecenin üstünde bir dereceye yükselme"},
        {"type": "article_line", "segments": [seg("Madde 37")]},
        {"type": "paragraph", "content": "Bu kanun hükümlerine göre öğrenim durumları, hizmet sınıfları ve görev unvanları itibariyle azami yükselebilecekleri derecelerin dördüncü kademesinden aylık almaya hak kazanan ve son sekiz yıllık süre içinde herhangi bir disiplin cezası almayanların kazanılmış hak aylıkları kadro şartı aranmaksızın bir üst dereceye yükseltilir."},
        {"type": "subheading", "content": "Sınıf dışında kadro ihdas edilemiyeceği"},
        {"type": "article_line", "segments": [seg("Madde 39")]},
        {"type": "paragraph", "content": "Bu kanuna tabi kurumlarda sınıflar dışında memurluk kadroları ihdas edilemez."},
        {"type": "subheading", "content": "Memuriyete girişte yaş"},
        {"type": "article_line", "segments": [seg("Madde 40")]},
        {"type": "paragraph", "content": "Genel olarak 18 yaşını tamamlıyanlar Devlet memuru olabilirler."},
        {"type": "paragraph", "content": "Bir meslek veya sanat okulunu bitirenler en az 15 yaşını doldurmuş olmak ve Türk Medeni Kanununun 12 nci maddesine göre kazai rüşt kararı almak şartiyle Devlet memurluklarına atanabilirler."},
        {"type": "subheading", "content": "Sınıflandırmada öğrenim unsuru"},
        {"type": "article_line", "segments": [seg("Madde 41")]},
        {"type": "paragraph", "content": "Genel olarak ortaokulu bitirenler memur olabilirler. Ortaokul mezunlarından istekli bulunmadığı takdirde ilkokulu bitirenlerin de alınması caizdir. Bir sınıfta belli görevlere atanabilmek veya bu görevlerde belli derecelere yükselebilmek için, kuruluş kanunları veya bu kanun, Cumhurbaşkanlığı kararnameleri ve kuruluş kanunlarına dayanılarak çıkarılacak yönetmelikler ile işin gereğine göre daha yüksek öğrenim dereceleri veya muayyen fakülte, okul veya öğrenim dallarını veya meslek içi veya meslekle ilgili eğitim programlarını bitirmiş olmak veya yabancı dil bilmek gibi şartlar konulabilir."},
        {"type": "subheading", "content": "Göstergeler"},
        {"type": "article_line", "segments": [seg("Madde 43")]},
        {"type": "paragraph", "content": "Bu Kanuna tabi kurumların kadrolarında bulunan personelin aylık ve ek göstergeleri aşağıda gösterildiği şekilde tespit edilir:"},
        {"type": "subheading", "content": "A) Aylık Göstergesi"},
        {"type": "paragraph", "content": "Bütün sınıflar itibariyle her derece ve kademenin aylıklarının hesaplanmasına esas teşkil edecek Aylık Gösterge Tablosu aşağıdaki I Numaralı Cetvelde gösterilmiştir."},
        {"type": "subheading", "content": "I Numaralı Cetvel"},
        {"type": "subheading", "content": "AYLIK GÖSTERGE TABLOSU"},
        {"type": "table", "headers": ["Derece", "1", "2", "3", "4", "5", "6", "7", "8", "9"], "rows": cetvel_rows},
        {"type": "subheading", "content": "B) Ek Gösterge"},
        {"type": "paragraph", "content": "Bu Kanuna tabi kurumların kadrolarında bulunan personelin aylıkları; hizmet sınıfları, görev türleri ve aylık alınan dereceler dikkate alınarak bu kanuna ekli I ve II sayılı cetvellerde gösterilen ek gösterge rakamlarının eklenmesi suretiyle hesaplanır. II sayılı cetvelde yer alan unvanlarda değişiklik yapmaya ve yeni unvanlar ilave etmeye Cumhurbaşkanı yetkilidir."},
        {"type": "paragraph", "content": "Bu ek göstergeler, ilgililerin belirtilen sınıf ve görevlerde bulundukları sürece ödemelere esas alınıp, terfi bakımından kazanılmış hak sayılmaz. Kurumların 1, 2, 3 ve 4 üncü dereceli kadrolarına atananlara uygulanacak ek göstergeler, ilgililerin daha önce bulunmuş oldukları kariyerleri ile ilgili sınıf veya ekli I sayılı Cetvelin Genel İdare Hizmetleri Sınıfı (g) bölümünde belirtilen görevlerde kazanılmış hak aylık derecelerine göre alabilecekleri ek göstergelerden düşük olamaz."},
        {"type": "paragraph", "content": "Başbakanlık Yüksek Denetleme Kurulu Başkan ve Üyelikleri, Milli Eğitim Bakanlığı Talim ve Terbiye Kurulu Başkan ve üyelikleri, Bayındırlık ve İskan Bakanlığı Yüksek Fen Kurulu Başkan ve Üyelikleri, Müşavir ve 1'inci dereceden uzman ünvanlı kadrolara atananlara bu kadrolarda bulundukları sürece daha önce almış oldukları en yüksek ek gösterge üzerinden ödeme yapılır."},
        {"type": "paragraph", "content": "Kadroları Milli İstihbarat Hizmetleri Sınıfına dahil olanlara, bu maddede gösterilen emsallerini geçmemek üzere Cumhurbaşkanı tarafından tespit edilecek ek gösterge rakamları uygulanır."},
        {"type": "subheading", "content": "Memurun başka sınıfta ve derecesinin altında bir görevde çalıştırılmıyacağı"},
        {"type": "article_line", "segments": [seg("Madde 45")]},
        {"type": "paragraph", "content": "Hiç bir memur sınıfının dışında ve sınıfının içindeki derecesinin altında bir derecenin görevinde çalıştırılamaz."},
        {"type": "paragraph", "content": "5 inci ve daha aşağı derecelerdeki kadrolara, derece yükselmesi için gerekli nitelikleri haiz memur bulunmaması hallerinde, 36 ncı maddede belirtilen öğrenim durumları itibariyle tespit olunan yükselinebilecek dereceyi aşmamak ve karşılık gösterilecek kadro derecesi kazanılmış hak aylık derecelerinin üç üst derecesinden fazla olmamak kaydıyla, bu dereceler karşılık gösterilerek, kendi derecesi ile aynı sınıftan memur atanması mümkündür."},
        {"type": "paragraph", "content": "Bu gibiler, işgal ettikleri kadroda kazanılmış derece ve kademelerinin aylığını almaya devam ederler ve kazanılmış aylıklarındaki kademe ilerlemesi ve derece yükselmesi genel esaslara göre yapılır. Karşılık gösterilen kadrolar, ilgililer için kazanılmış hak teşkil etmez."},
    ]


def parse_generic_kisim(section_text: str, roman: str, title: str) -> list[dict]:
    lines = [line.rstrip() for line in section_text.splitlines()]
    blocks: list[dict] = [
        {"type": "section_heading", "content": f"KISIM - {roman}"},
        {"type": "section_title", "content": title},
    ]
    i = 0
    while i < len(lines):
        raw = lines[i].strip()
        if not raw:
            i += 1
            continue

        line = normalize_space(raw)
        if line.startswith("KISIM -"):
            i += 1
            continue
        if line == title:
            i += 1
            continue

        if line.startswith("BÖLÜM"):
            blocks.append({"type": "heading", "content": line.replace("BÖLÜM :", "BÖLÜM:").replace("BÖLÜM: ", "BÖLÜM: ").strip()})
            nxt = next_nonempty(lines, i + 1)
            if nxt and not nxt.startswith("Madde") and not nxt.startswith("BÖLÜM"):
                nxt_clean = strip_legal_notes(nxt.rstrip(":"))
                if nxt_clean and not nxt_clean.startswith("KISIM -"):
                    blocks.append({"type": "heading", "content": nxt_clean})
                    i += 1
            i += 1
            continue

        article_match = ARTICLE_RE.match(line)
        if article_match:
            article_no, remainder = article_match.groups()
            cleaned_remainder = strip_legal_notes(remainder)
            if "Mülga" in remainder and not cleaned_remainder:
                i += 1
                while i < len(lines) and not ARTICLE_RE.match(normalize_space(lines[i])) and not normalize_space(lines[i]).startswith("BÖLÜM") and not normalize_space(lines[i]).startswith("KISIM -"):
                    i += 1
                continue

            blocks.append({"type": "article_line", "segments": [seg(f"Madde {article_no}")]})
            inline_alpha = split_inline_alpha(cleaned_remainder)
            if inline_alpha:
                blocks.append({"type": "alpha_list", "items": inline_alpha})
            elif cleaned_remainder:
                blocks.append({"type": "subheading", "content": cleaned_remainder.rstrip(":")})
            i += 1
            continue

        next_line = next_nonempty(lines, i + 1)
        if line.endswith(":") and next_line and ARTICLE_RE.match(normalize_space(next_line)):
            heading = strip_legal_notes(line.rstrip(":"))
            if heading:
                blocks.append({"type": "subheading", "content": heading})
            i += 1
            continue

        if re.match(r"^[IVXLC]+\s*-\s*", line):
            blocks.append({"type": "subheading", "content": strip_legal_notes(line.rstrip(":"))})
            i += 1
            continue

        alpha_inline = split_inline_alpha(line)
        if alpha_inline:
            blocks.append({"type": "alpha_list", "items": alpha_inline})
            i += 1
            continue

        ord_match = ORDERED_RE.match(line)
        if ord_match:
            items = []
            while i < len(lines):
                current = normalize_space(lines[i].strip())
                m = ORDERED_RE.match(current)
                if not m:
                    break
                _, item_text = m.groups()
                item_text = strip_legal_notes(item_text)
                j = i + 1
                continuations = []
                while j < len(lines):
                    nxt = normalize_space(lines[j].strip())
                    if not nxt:
                        j += 1
                        continue
                    if ORDERED_RE.match(nxt) or ARTICLE_RE.match(nxt) or nxt.startswith("BÖLÜM") or nxt.startswith("KISIM -"):
                        break
                    if nxt.endswith(":") and next_nonempty(lines, j + 1) and ARTICLE_RE.match(normalize_space(next_nonempty(lines, j + 1) or "")):
                        break
                    continuations.append(strip_legal_notes(nxt))
                    j += 1
                full_item = normalize_space(" ".join([item_text] + [x for x in continuations if x]))
                items.append(full_item)
                i = j
            if items:
                blocks.append({"type": "ordered_list", "items": [item for item in items if item]})
            continue

        alpha_match = ALPHA_RE.match(line)
        if alpha_match:
            items = []
            while i < len(lines):
                current = normalize_space(lines[i].strip())
                m = ALPHA_RE.match(current)
                if not m:
                    break
                label, item_text = m.groups()
                j = i + 1
                continuations = []
                while j < len(lines):
                    nxt = normalize_space(lines[j].strip())
                    if not nxt:
                        j += 1
                        continue
                    if ALPHA_RE.match(nxt) or ORDERED_RE.match(nxt) or ARTICLE_RE.match(nxt) or nxt.startswith("BÖLÜM") or nxt.startswith("KISIM -"):
                        break
                    continuations.append(strip_legal_notes(nxt))
                    j += 1
                item = normalize_space(f"{label}) {item_text} {' '.join([x for x in continuations if x])}".strip())
                items.append(item)
                i = j
            if items:
                blocks.append({"type": "alpha_list", "items": items})
            continue

        paragraph_lines = [strip_legal_notes(line)]
        j = i + 1
        while j < len(lines):
            nxt = normalize_space(lines[j].strip())
            if not nxt:
                j += 1
                break
            if (
                nxt.startswith("BÖLÜM")
                or nxt.startswith("KISIM -")
                or ARTICLE_RE.match(nxt)
                or ORDERED_RE.match(nxt)
                or ALPHA_RE.match(nxt)
                or (nxt.endswith(":") and next_nonempty(lines, j + 1) and ARTICLE_RE.match(normalize_space(next_nonempty(lines, j + 1) or "")))
            ):
                break
            paragraph_lines.append(strip_legal_notes(nxt))
            j += 1
        paragraph = normalize_space(" ".join([x for x in paragraph_lines if x]))
        if paragraph:
            blocks.append({"type": "paragraph", "content": paragraph})
        i = j

    return [block for block in blocks if block and (block.get("content") or block.get("segments") or block.get("items") or block.get("rows"))]


def write_topic(filename: str, topic_name: str, blocks: list[dict]) -> None:
    blocks = postprocess_blocks(blocks)
    payload = {
        "subject_id": SUBJECT_ID,
        "topics": [
            {
                "name": topic_name,
                "status": "draft",
                "content_blocks": blocks,
            }
        ],
    }
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUTPUT_DIR / filename).write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")


def main() -> None:
    raw = RAW_PATH.read_text()
    kisim_texts = split_kisims(raw)

    write_topic(KISIMS[0][2], "KISIM - II - Sınıflandırma", build_kisim_ii())

    for roman, title, filename in KISIMS[1:]:
        section_text = kisim_texts[roman]
        blocks = parse_generic_kisim(section_text, roman, title)
        write_topic(filename, f"KISIM - {roman} - {title}", blocks)

    print(OUTPUT_DIR)


if __name__ == "__main__":
    main()
