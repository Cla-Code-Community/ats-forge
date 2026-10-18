import { describe, expect, it } from 'vitest';
import { extractSkillEvidence } from '../src/domain/services/EvidenceExtractor';

describe('extractSkillEvidence', () => {
  it('retém fonte, trecho original, posição e ocorrências de aliases', () => {
    const evidence = extractSkillEvidence(
      'Experiência com NodeJS e Node.js em APIs.',
      'linkedin',
      'profile_mention',
    );

    expect(evidence).toHaveLength(1);
    expect(evidence[0]).toMatchObject({
      canonicalName: 'Node.js',
      source: 'linkedin',
      evidenceType: 'profile_mention',
      position: 16,
      confidence: 0.9,
      occurrences: 2,
      originalExcerpt: 'Experiência com NodeJS e Node.js em APIs.',
    });
  });

  it('não cria evidência para um alias ambíguo sem contexto', () => {
    expect(extractSkillEvidence('A sigla TS aparece aqui.', 'linkedin', 'profile_mention'))
      .toEqual([]);
  });
});
