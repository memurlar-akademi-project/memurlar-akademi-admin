export function formatSubjectName(name: string) {
  return name
    .replace(/\s*\(\s*Adalet Bakanlığı\s*\)\s*/giu, " ")
    .replace(/\s*(?:[-–—]\s*)?\(?\s*Seçili Hükümler\s*\)?\s*$/iu, "")
    .replace(
      /\s*(?:[-–—]\s*)?\(?\s*(?:Madde(?:ler|leri)?\s*)?\d+\s*(?:[-–—]|ila|ile)\s*\d+\.?\s*(?:Madde(?:ler|leri)?)?\s*\)?\s*$/iu,
      "",
    )
    .replace(/\s{2,}/g, " ")
    .trim();
}
