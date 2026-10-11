import type {
  DataSource,
  NormalizedEvidence,
} from '../entities/NormalizedProfile';
import {
  extractTechnologies,
  findTechnologyMentions,
} from './TechTaxonomy';

type EvidenceType = NormalizedEvidence['evidenceType'];

export function extractSkillEvidence(
  text: string,
  source: DataSource,
  evidenceType: EvidenceType,
): NormalizedEvidence[] {
  const evidence: NormalizedEvidence[] = [];
  const lines = text.split(/\r?\n/);
  let offset = 0;

  for (const line of lines) {
    const excerpt = line.trim();
    const leadingWhitespace = line.length - line.trimStart().length;
    for (const canonicalName of extractTechnologies(excerpt)) {
      const mentions = findTechnologyMentions(excerpt, canonicalName);
      const firstMention = mentions[0];
      if (!firstMention) continue;
      const skillId = canonicalName
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      evidence.push({
        skillId,
        canonicalName,
        source,
        evidenceType,
        originalExcerpt: excerpt.slice(
          Math.max(0, firstMention.position - 80),
          Math.min(excerpt.length, firstMention.position + firstMention.text.length + 120),
        ),
        position: offset + leadingWhitespace + firstMention.position,
        confidence:
          firstMention.text.toLowerCase() === canonicalName.toLowerCase() ? 1 : 0.9,
        occurrences: mentions.length,
      });
    }
    offset += line.length + 1;
  }

  return evidence;
}
