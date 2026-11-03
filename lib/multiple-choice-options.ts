export type ChoiceOption = { label: string; option_text: string; is_correct: boolean };
const labels = ["A", "B", "C", "D", "E"];

export function hasValidChoiceLabels(options: Array<{ label: string }>): boolean {
  return (options.length === 4 || options.length === 5) && options.every((option, i) => option.label === labels[i]);
}

export function normalizeChoiceOptions(options?: Array<{ label: string; option_text?: string | null; is_correct?: boolean | null }> | null, count: 4 | 5 = options?.length === 4 ? 4 : 5): ChoiceOption[] {
  const map = new Map((options ?? []).map(option => [option.label, option]));
  return labels.slice(0, count).map((label, i) => ({ label, option_text: map.get(label)?.option_text ?? "", is_correct: map.get(label)?.is_correct ?? (!options?.length && i === 0) }));
}
