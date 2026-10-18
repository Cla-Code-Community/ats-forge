import { NormalizedExperience } from '../entities/NormalizedProfile';
import { sanitizeText } from './TextSanitizer';

const HEADING_RE = /^(#{1,4})\s+(.*\S)\s*$/;
const EXPERIENCE_HEADING_RE =
  /\b(experi[êe]ncias?(\s+profissiona(l|is))?|hist[óo]rico\s+profissional|professional\s+experience|work\s+experience|experience|carreira|employment)\b/i;
const BULLET_RE = /^\s*(?:[-*+•]|\d+\.)\s+(.*\S)\s*$/;
const PERIOD_RE =
  /\(([^)]*?(?:19|20)\d{2}[^)]*?)\)|\b((?:19|20)\d{2}\s*(?:[-–—]|\bto\b|\baté\b|\ba\b)\s*(?:(?:19|20)\d{2}|atual|present(?:e)?|current|hoje|now|today))\b/i;
const SEP_RE = /\s+[—–|@]\s+|\s+[-–]\s+|\s+(?:at|em|na|no|da|do)\s+/i;

const MAX_ENTRIES = 12;
const MAX_HIGHLIGHTS = 12;
const MAX_FIELD_LEN = 160;
const MAX_HIGHLIGHT_LEN = 300;

interface RawEntry {
  title: string;
  lines: string[];
}

export function parseReadmeExperiences(markdown: string | null | undefined): NormalizedExperience[] {
  if (!markdown || !markdown.trim()) return [];
  const lines = markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  let sectionStart = -1;
  let sectionLevel = 0;
  for (let i = 0; i < lines.length; i++) {
    const heading = HEADING_RE.exec(lines[i]);
    if (heading && EXPERIENCE_HEADING_RE.test(heading[2])) {
      sectionStart = i + 1;
      sectionLevel = heading[1].length;
      break;
    }
  }
  if (sectionStart < 0) return [];

  let sectionEnd = lines.length;
  for (let i = sectionStart; i < lines.length; i++) {
    const heading = HEADING_RE.exec(lines[i]);
    if (heading && heading[1].length <= sectionLevel) {
      sectionEnd = i;
      break;
    }
  }

  const body = lines.slice(sectionStart, sectionEnd);
  const entries = splitEntries(body, sectionLevel);

  return entries
    .map(toExperience)
    .filter((entry): entry is NormalizedExperience => entry !== null)
    .slice(0, MAX_ENTRIES);
}

function splitEntries(body: string[], sectionLevel: number): RawEntry[] {
  const entries: RawEntry[] = [];
  let current: RawEntry | null = null;

  for (const line of body) {
    const title = entryTitle(line, sectionLevel);
    if (title) {
      if (current) entries.push(current);
      current = { title: title.title, lines: title.rest ? [title.rest] : [] };
      continue;
    }
    if (current) current.lines.push(line);
  }
  if (current) entries.push(current);
  return entries;
}

function entryTitle(line: string, sectionLevel: number): { title: string; rest?: string } | null {
  const heading = HEADING_RE.exec(line);
  if (heading && heading[1].length > sectionLevel) {
    return { title: heading[2].trim() };
  }

  const trimmed = line.trim();
  const bold = /^(?:\*\*|__)(.+?)(?:\*\*|__)\s*(.*)$/.exec(trimmed);
  if (bold) {
    return { title: bold[1].trim(), rest: bold[2].trim() || undefined };
  }

  return null;
}

function toExperience(entry: RawEntry): NormalizedExperience | null {
  const parsed = parseTitle(entry.title, entry.lines);
  if (!parsed) return null;
  if (!parsed.period || !/\d{4}/.test(parsed.period)) return null;

  const bulletHighlights = entry.lines
    .map((line) => BULLET_RE.exec(line))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => clamp(sanitizeText(match[1]), MAX_HIGHLIGHT_LEN))
    .filter((text) => text.length > 2);

  const highlights =
    bulletHighlights.length > 0
      ? bulletHighlights
      : entry.lines
          .map((line) => clamp(sanitizeText(line), MAX_HIGHLIGHT_LEN))
          .filter((text) => text.length > 3 && text !== parsed.period);

  return {
    company: parsed.company,
    role: parsed.role,
    period: parsed.period,
    highlights: highlights.slice(0, MAX_HIGHLIGHTS).length ? highlights.slice(0, MAX_HIGHLIGHTS) : undefined,
    source: 'github',
  };
}

function parseTitle(
  titleRaw: string,
  entryLines: string[],
): { role: string; company: string; period?: string } | null {
  let title = stripInlineMarkdown(titleRaw).trim();
  let period: string | undefined;

  const match = PERIOD_RE.exec(title);
  if (match) {
    period = cleanPeriod(match[1] ?? match[2]);
    title = `${title.slice(0, match.index)} ${title.slice(match.index + match[0].length)}`.trim();
  }
  title = title.replace(/[\s|,·•–—-]+$/g, '').trim();

  if (!period) period = periodFromLines(entryLines);

  const sep = SEP_RE.exec(title);
  if (!sep) return null;

  const role = clampName(sanitizeText(title.slice(0, sep.index)));
  const company = clampName(sanitizeText(title.slice(sep.index + sep[0].length)));
  if (!role || !company) return null;

  return { role, company, period };
}

function periodFromLines(lines: string[]): string | undefined {
  for (const line of lines) {
    const clean = stripInlineMarkdown(line).trim();
    if (clean.length > 60) continue;
    const match = PERIOD_RE.exec(clean);
    if (match) return cleanPeriod(match[1] ?? match[2]);
  }
  return undefined;
}

function cleanPeriod(value: string): string {
  return clamp(value.replace(/\s+/g, ' ').trim(), 60);
}

function stripInlineMarkdown(text: string): string {
  return text
    .replace(/[`*_]+/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .trim();
}

function clampName(text: string): string {
  return clamp(text.replace(/^[\s:–—-]+|[\s:–—-]+$/g, ''), MAX_FIELD_LEN);
}

function clamp(text: string, max: number): string {
  const trimmed = text.trim();
  return trimmed.length > max ? trimmed.slice(0, max).trim() : trimmed;
}
