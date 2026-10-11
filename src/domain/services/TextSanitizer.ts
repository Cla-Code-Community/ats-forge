const HTML_ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&mdash;': '-',
  '&ndash;': '-',
  '&hellip;': '...',
};

function decodeEntities(text: string): string {
  let out = text;
  for (const [entity, value] of Object.entries(HTML_ENTITIES)) {
    out = out.split(entity).join(value);
  }
  // numeric entities
  out = out.replace(/&#(\d+);/g, (_, code) => {
    const n = Number(code);
    return Number.isFinite(n) ? String.fromCodePoint(n) : '';
  });
  return out;
}
function normalizeTypography(text: string): string {
  return text
    .replace(/[‘’‚‛]/g, "'") 
    .replace(/[“”„‟]/g, '"') // smart double quotes
    .replace(/[–—―]/g, '-') // en/em dashes -> hyphen
    .replace(/…/g, '...') // ellipsis
    .replace(/[•●▪·]/g, '-') // stray bullets in source text
    .replace(/ /g, ' '); // nbsp
}

/**
 * Removes emoji, pictographs, symbols, variation selectors and any remaining
 * character outside the Latin-1 printable set. Keeps standard whitespace and
 * accented Latin letters.
 */
function stripNonRenderable(text: string): string {
  let out = '';
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    const isTabOrNewline = ch === '\n' || ch === '\t';
    const isBasicPrintable = code >= 0x20 && code <= 0x7e;
    const isLatin1Printable = code >= 0xa0 && code <= 0xff;
    if (isTabOrNewline || isBasicPrintable || isLatin1Printable) {
      out += ch;
    } else {
      // Drop emoji / symbols / CJK / etc. Insert a space to avoid word merges.
      out += ' ';
    }
  }
  return out;
}

export function sanitizeText(input: string | null | undefined): string {
  if (!input) return '';
  const decoded = decodeEntities(input);
  const normalized = normalizeTypography(decoded);
  const cleaned = stripNonRenderable(normalized);
  return cleaned.replace(/[ \t]{2,}/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
}

/**
 * Removes README-only presentation noise before local text analysis. Visible
 * prose and link labels remain, while badges, code, markup, URLs and HTML
 * payloads cannot be mistaken for skills or project experience.
 */
export function stripGitHubReadmeMarkup(input: string | null | undefined): string {
  if (!input) return '';
  return input
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/~~~[\s\S]*?~~~/g, ' ')
    .replace(/!\[[^\]]*\](?:\([^)]*\)|\[[^\]]*\])?/g, ' ')
    .replace(/<img\b[^>]*>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/^\s*\[[^\]]+\]:\s*\S+.*$/gm, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`[^`]*`/g, ' ')
    .replace(/https?:\/\/\S+/gi, ' ')
    .split(/\r?\n/)
    .filter((line) => !/(?:shields\.io|badgen\.net|img\.shields|badge)/i.test(line))
    .join('\n')
    .replace(/^\s{0,3}#{1,6}\s*/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/[*_~]/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

/** Sanitizes and, if the text is empty afterwards, returns undefined. */
export function sanitizeOptional(input: string | null | undefined): string | undefined {
  const cleaned = sanitizeText(input);
  return cleaned.length > 0 ? cleaned : undefined;
}

/** Humanizes a repo/slug name: "node-monitoring" / "CARDS_ICON" -> "Node Monitoring". */
export function humanizeName(name: string): string {
  const spaced = name
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
  return spaced
    .split(' ')
    .map((w) => (w.length <= 3 ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(' ');
}
