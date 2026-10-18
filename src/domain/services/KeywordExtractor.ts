/**
 * Pure keyword extraction (no I/O). Shared by the CLI file-based extractor and
 * the HTTP job analyzer so both behave identically.
 *
 * The tokenizer deliberately preserves compound technical terms — "node.js",
 * "c++", "c#", "ci/cd", "react-native", ".net" — instead of splitting them on
 * punctuation, because those tokens are exactly what a recruiter and an ATS
 * match a resume against.
 */

const STOP_WORDS = new Set([
  'e', 'de', 'da', 'do', 'em', 'com', 'para', 'por', 'os', 'as',
  'um', 'uma', 'o', 'a', 'que', 'se', 'na', 'no', 'ao', 'aos',
  'das', 'dos', 'nos', 'nas', 'sua', 'seu', 'ser', 'foi', 'são',
  'the', 'and', 'or', 'in', 'of', 'to', 'for', 'with', 'is',
  'are', 'you', 'we', 'our', 'be', 'at', 'on', 'an', 'us', 'it',
  'this', 'that', 'will', 'have', 'has', 'not',
]);

const LETTERS = 'a-z0-9áéíóúàâêîôûãõçäëïöüñ';
// A token is a run of letters/digits that may contain internal connectors
// (. + # / -), with connectors trimmed from the edges afterwards.
const TOKEN_RE = new RegExp(`[${LETTERS}][${LETTERS}+#./-]*[${LETTERS}+#]|[${LETTERS}]+`, 'gi');

export function extractKeywordsFromText(text: string): string[] {
  const seen = new Set<string>();
  const matches = text.toLowerCase().match(TOKEN_RE) ?? [];

  return matches
    .map((w) => w.replace(/^[.+#/-]+/, '').replace(/[./-]+$/, ''))
    .filter(
      (w) =>
        w.length > 2 &&
        !STOP_WORDS.has(w) &&
        new RegExp(`[${LETTERS}]`, 'i').test(w),
    )
    .filter((w) => {
      if (seen.has(w)) return false;
      seen.add(w);
      return true;
    });
}

export { STOP_WORDS };
