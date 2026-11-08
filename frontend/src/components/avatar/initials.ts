/** "Media Markt" -> "MM", "PayPal" -> "PP", "Rewe" -> "R", "dm" -> "D". */
export function initials(name: string): string {
  const words = name.trim().split(/[\s\-_/&+.]+/).filter(Boolean);
  const first = (word: string) => Array.from(word)[0] ?? '';
  if (words.length === 0) return '?';
  if (words.length >= 2) return (first(words[0]!) + first(words[1]!)).toUpperCase();
  const word = words[0]!;
  // CamelCase brand names: "PayPal", "MediaMarkt"
  const inner = /^(.)\p{Ll}+(\p{Lu})/u.exec(word);
  if (inner) return (inner[1]! + inner[2]!).toUpperCase();
  return first(word).toUpperCase();
}
