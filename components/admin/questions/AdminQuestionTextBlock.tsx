const ROMAN_MARKER = /^(I|II|III|IV|V|VI|VII|VIII|IX|X)\.\s+/u;

type ParsedQuestionText = {
  premises: Array<{
    marker: string;
    content: string;
  }>;
  prompt: string;
};

type Props = {
  compact?: boolean;
  text: string;
};

export function AdminQuestionTextBlock({ compact = false, text }: Props) {
  const parsed = parseQuestionText(text);

  if (parsed.premises.length === 0) {
    return (
      <p className={`${compact ? "text-sm leading-6" : "text-base leading-8"} whitespace-pre-line font-bold text-[var(--color-admin-ink)]`}>
        {text || "Soru metni yok"}
      </p>
    );
  }

  return (
    <div className={compact ? "space-y-2.5" : "space-y-4"}>
      <div className="overflow-hidden rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)]">
        {parsed.premises.map((premise) => (
          <div className={`${compact ? "px-3 py-2.5" : "px-4 py-3"} border-b border-[var(--color-admin-line)] last:border-b-0`} key={premise.marker}>
            <div className="flex items-start gap-3">
              <span className={`${compact ? "h-7 min-w-7 text-[11px]" : "h-8 min-w-8 text-xs"} mt-0.5 flex items-center justify-center rounded-full bg-white font-black text-[var(--color-admin-accent)] shadow-sm`}>
                {premise.marker}
              </span>
              <p className={`${compact ? "text-xs leading-5" : "text-sm leading-7"} font-bold text-[var(--color-admin-ink)]`}>
                {premise.content}
              </p>
            </div>
          </div>
        ))}
      </div>

      {parsed.prompt ? (
        <p className={`${compact ? "text-sm leading-6" : "text-base leading-8"} font-bold text-[var(--color-admin-ink)]`}>
          {parsed.prompt}
        </p>
      ) : null}
    </div>
  );
}

function parseQuestionText(text: string): ParsedQuestionText {
  const lines = text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length > 1 && lines[0] && ROMAN_MARKER.test(lines[0])) {
    const premises: ParsedQuestionText["premises"] = [];
    const promptLines: string[] = [];

    lines.forEach((line) => {
      const match = line.match(ROMAN_MARKER);
      if (match && promptLines.length === 0) {
        premises.push({
          marker: match[1],
          content: line.replace(ROMAN_MARKER, "").trim(),
        });
        return;
      }

      promptLines.push(line);
    });

    return {
      premises,
      prompt: promptLines.join(" "),
    };
  }

  const inlinePremise = parseInlinePremises(text);
  if (inlinePremise.premises.length > 1) {
    return inlinePremise;
  }

  return {
    premises: [],
    prompt: text,
  };
}

function parseInlinePremises(text: string): ParsedQuestionText {
  const matches = [...text.matchAll(/\b(I|II|III|IV|V|VI|VII|VIII|IX|X)\.\s+/gu)];

  if (matches.length < 2 || matches[0]?.index !== 0) {
    return {
      premises: [],
      prompt: text,
    };
  }

  const premises: ParsedQuestionText["premises"] = [];
  let prompt = "";

  matches.forEach((match, index) => {
    const marker = match[1];
    const start = (match.index ?? 0) + match[0].length;
    const nextStart = matches[index + 1]?.index;
    let raw = text.slice(start, nextStart ?? text.length).trim();

    if (index === matches.length - 1) {
      const split = raw.match(
        /^([\s\S]+?[.!?])\s+((?:T\.C\.|Türkiye Cumhuriyeti|[0-9]{3,4}\s+sayılı|[A-ZÇĞİÖŞÜ][\s\S]{0,140}?(?:Kanunu|Yönetmeliği|Anayasası))[\s\S]*)$/u,
      );

      if (split) {
        raw = split[1].trim();
        prompt = split[2].trim();
      }
    }

    premises.push({
      marker,
      content: raw,
    });
  });

  return {
    premises,
    prompt,
  };
}
