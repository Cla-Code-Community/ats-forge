import type {
  DataSource,
  JobTarget,
  NormalizedProfile,
} from '../entities/NormalizedProfile';
import { extractKeywordsFromText } from './KeywordExtractor';
import {
  JobRequirementParser,
  type ParsedJobDescription,
  type ParsedJobRequirement,
} from './JobRequirementParser';
import {
  categoryOf,
  extractTechnologies,
  findTechnologyMentions,
  normalizeTechList,
} from './TechTaxonomy';

/**
 * AtsAnalyzer v2 — scores a resume the way a real ATS + senior recruiter would,
 * across six dimensions, and explains the result (breakdown, missing keywords,
 * weak sections, recommendations). Evidence-based: a keyword/skill only counts
 * when it is backed by the candidate's own data (spec §7/§9/§10/§13).
 */

export interface JobAnalysis {
  keywords: string[];
  /** Technologies required by the job (canonical). */
  hardSkills: string[];
  seniority: string | null;
  title: string | null;
  description: string;
  jobDetails: ParsedJobDescription;
}

export interface AtsScoreBreakdown {
  keywords: number;
  experience: number;
  technicalSkills: number;
  structure: number;
  achievements: number;
  readability: number;
}

export type AtsStatus = 'PASSED' | 'NEEDS_IMPROVEMENT' | 'INSUFFICIENT_DATA';

export interface AtsReport {
  score: number;
  status: AtsStatus;
  breakdown: AtsScoreBreakdown;
  matchedKeywords: string[];
  missingKeywords: string[];
  weakSections: string[];
  recommendations: string[];
  jobFitScore: number | null;
  jobFitExplanation: string;
  requirements: AnalyzedJobRequirement[];
  jobDetails: Pick<ParsedJobDescription, 'title' | 'company'>;
}

export interface RequirementEvidence {
  skillId: string;
  canonicalName: string;
  source: DataSource;
  evidenceType: 'professional_experience' | 'project' | 'profile_mention' | 'education';
  originalExcerpt: string;
  position: number;
  confidence: number;
  occurrences: number;
}

export interface AtsAnalyzerOptions {
  requirementWeights?: Partial<
    Record<'required' | 'preferred' | 'responsibility', number>
  >;
  evidenceWeights?: Partial<
    Record<RequirementEvidence['evidenceType'], number>
  >;
}

export interface AnalyzedJobRequirement extends ParsedJobRequirement {
  evidence: RequirementEvidence[];
  matchStrength: number;
}

const SENIORITY_TERMS: Array<[RegExp, string]> = [
  [/\b(est[aá]gi|intern|trainee)/i, 'Estágio/Trainee'],
  [/\b(j[úu]nior|junior|jr)\b/i, 'Júnior'],
  [/\b(pleno|mid[- ]?level|mid)\b/i, 'Pleno'],
  [/\b(s[êe]nior|senior|sr)\b/i, 'Sênior'],
  [/\b(especialista|specialist|staff|principal|lead|l[íi]der)\b/i, 'Especialista/Lead'],
];

const WEIGHTS: Record<keyof AtsScoreBreakdown, number> = {
  keywords: 0.3,
  experience: 0.2,
  technicalSkills: 0.2,
  structure: 0.15,
  achievements: 0.08,
  readability: 0.07,
};

const PASS_THRESHOLD = 80;
const DEFAULT_REQUIREMENT_WEIGHTS = {
  required: 3,
  preferred: 1,
  responsibility: 0.5,
} as const;
const DEFAULT_EVIDENCE_WEIGHTS: Record<RequirementEvidence['evidenceType'], number> = {
  professional_experience: 1,
  project: 0.8,
  profile_mention: 0.45,
  education: 0.75,
};
const REQUIREMENT_PARSER = new JobRequirementParser();

const ACTION_VERBS = [
  'desenvolv', 'implement', 'cri', 'constru', 'projet', 'lider', 'arquitet',
  'otimiz', 'integr', 'automat', 'migr', 'refator', 'mant', 'escal', 'reduz',
  'aument', 'entreg', 'coorden', 'gerenci', 'develop', 'implement', 'creat',
  'built', 'design', 'led', 'optimi', 'integrat', 'automat', 'migrat', 'deliver',
];

export class AtsAnalyzer {
  private readonly requirementWeights: Record<
    'required' | 'preferred' | 'responsibility',
    number
  >;
  private readonly evidenceWeights: Record<
    RequirementEvidence['evidenceType'],
    number
  >;

  constructor(options: AtsAnalyzerOptions = {}) {
    this.requirementWeights = {
      ...DEFAULT_REQUIREMENT_WEIGHTS,
      ...options.requirementWeights,
    };
    this.evidenceWeights = {
      ...DEFAULT_EVIDENCE_WEIGHTS,
      ...options.evidenceWeights,
    };
    for (const weight of [
      ...Object.values(this.requirementWeights),
      ...Object.values(this.evidenceWeights),
    ]) {
      if (!Number.isFinite(weight) || weight < 0) {
        throw new RangeError('Pesos de pontuação devem ser números finitos não negativos.');
      }
    }
  }

  analyzeJob(job: JobTarget | null | undefined): JobAnalysis {
    const text = [job?.title ?? '', job?.description ?? ''].join('\n');
    const keywords = extractKeywordsFromText(text);
    const hardSkills = extractTechnologies(text);
    const jobDetails = REQUIREMENT_PARSER.parse(job);

    let seniority: string | null = job?.seniority ?? null;
    if (!seniority) {
      for (const [re, label] of SENIORITY_TERMS) {
        if (re.test(text)) {
          seniority = label;
          break;
        }
      }
    }
    return {
      keywords,
      hardSkills,
      seniority,
      title: job?.title?.trim() || null,
      description: job?.description ?? '',
      jobDetails,
    };
  }

  score(profile: NormalizedProfile, analysis: JobAnalysis): AtsReport {
    const evidence = this.buildEvidenceSet(profile);
    const profileTechs = this.profileTechnologies(profile);

    const { keywords, matched, missing } = this.scoreKeywords(
      profile,
      analysis,
      evidence,
      profileTechs,
    );

    const breakdown: AtsScoreBreakdown = {
      keywords,
      experience: this.scoreExperience(profile),
      technicalSkills: this.scoreTechnicalSkills(profile, analysis, profileTechs),
      structure: this.scoreStructure(profile),
      achievements: this.scoreAchievements(profile),
      readability: this.scoreReadability(profile),
    };

    const score = this.clamp(
      Math.round(
        (Object.keys(breakdown) as Array<keyof AtsScoreBreakdown>).reduce(
          (sum, k) => sum + breakdown[k] * WEIGHTS[k],
          0,
        ),
      ),
    );

    const weakSections = this.findWeakSections(profile, breakdown);
    const recommendations = this.buildRecommendations(profile, breakdown, missing);
    const requirements = analyzeRequirements(
      profile,
      analysis.jobDetails.requirements,
      this.evidenceWeights,
    );
    const scoredRequirements = requirements.flatMap((requirement) => {
      const weight =
        requirement.priority === 'required'
          ? this.requirementWeights.required
          : requirement.priority === 'preferred'
            ? this.requirementWeights.preferred
            : requirement.category === 'responsibility' &&
                requirement.technologies.length > 0
              ? this.requirementWeights.responsibility
              : 0;
      return weight > 0 ? [{ requirement, weight }] : [];
    });
    const totalRequirementWeight = scoredRequirements.reduce(
      (sum, item) => sum + item.weight,
      0,
    );
    const jobFitScore =
      totalRequirementWeight > 0
        ? Math.round(
            (scoredRequirements.reduce(
              (sum, item) =>
                sum +
                (item.requirement.matchStrength / 100) * item.weight,
              0,
            ) /
              totalRequirementWeight) *
              100,
          )
        : null;

    // §10: when the job defines required/preferred requirements, the structural/
    // textual score must not silently mask a poor job match — it is capped by a
    // ceiling derived from the job-fit score. Below that ceiling structure still
    // counts, so atsScore and jobFit stay distinct but consistent.
    const finalScore =
      jobFitScore !== null
        ? Math.min(score, this.clamp(50 + Math.round(jobFitScore * 0.5)))
        : score;

    return {
      score: finalScore,
      status: finalScore >= PASS_THRESHOLD ? 'PASSED' : 'NEEDS_IMPROVEMENT',
      breakdown,
      matchedKeywords: matched,
      missingKeywords: missing.slice(0, 20),
      weakSections,
      recommendations,
      jobFitScore,
      jobFitExplanation:
        `Compatibilidade textual: obrigatório peso ${this.requirementWeights.required}, desejável peso ${this.requirementWeights.preferred}, tecnologia em responsabilidade peso ${this.requirementWeights.responsibility}; evidência de experiência ${this.evidenceWeights.professional_experience * 100}%, projeto ${this.evidenceWeights.project * 100}%, menção de perfil ${this.evidenceWeights.profile_mention * 100}%, formação ${this.evidenceWeights.education * 100}%. Ambiguidades ficam fora da pontuação e são sinalizadas para revisão. Quando a vaga define requisitos, o ATS Score fica limitado a um teto de (50 + aderência/2), para que a estrutura não mascare baixa correspondência. Não representa probabilidade de contratação nem domínio real.`,
      requirements,
      jobDetails: {
        title: analysis.jobDetails.title,
        company: analysis.jobDetails.company,
      },
    };
  }

  // ── Evidence ──────────────────────────────────────────────────────────────────

  private buildEvidenceSet(profile: NormalizedProfile): Set<string> {
    const text = this.profileText(profile);
    const words = extractKeywordsFromText(text).map((w) => w.toLowerCase());
    const techs = extractTechnologies(text).map((t) => t.toLowerCase());
    return new Set([...words, ...techs]);
  }

  private profileText(profile: NormalizedProfile): string {
    return [
      profile.headline ?? '',
      profile.summary ?? '',
      ...profile.skills.map((s) => s.name),
      ...profile.experience.flatMap((e) => [
        e.role,
        e.company,
        ...(e.stack ?? []),
        ...(e.highlights ?? []),
        ...(e.results ?? []),
      ]),
      ...profile.projects.flatMap((p) => [
        p.name,
        p.description ?? '',
        ...(p.stack ?? []),
        ...(p.highlights ?? []),
      ]),
      ...profile.education.flatMap((ed) => [ed.degree ?? '', ed.field ?? '', ed.institution]),
    ].join('\n');
  }

  private profileTechnologies(profile: NormalizedProfile): Set<string> {
    const fromSkills = profile.skills.map((s) => s.name);
    const fromStacks = [
      ...profile.experience.flatMap((e) => e.stack ?? []),
      ...profile.projects.flatMap((p) => p.stack ?? []),
    ];
    const fromText = extractTechnologies(this.profileText(profile));
    return new Set(
      normalizeTechList([...fromSkills, ...fromStacks, ...fromText]).map((t) => t.toLowerCase()),
    );
  }

  // ── Dimension scores ────────────────────────────────────────────────────────

  private scoreKeywords(
    profile: NormalizedProfile,
    analysis: JobAnalysis,
    evidence: Set<string>,
    profileTechs: Set<string>,
  ): { keywords: number; matched: string[]; missing: string[] } {
    // Only the job's real technical keywords (Java, Node.js, MuleSoft, …) count —
    // never generic words like "desenvolvimento" or "experiência". These are then
    // cross-referenced with the candidate's evidence (profile + GitHub + LinkedIn).
    const jobTechs = analysis.hardSkills;

    if (jobTechs.length === 0) {
      // No recognizable tech requirements: fall back to the breadth of the
      // candidate's own keyword footprint, with no noisy matched/missing lists.
      const count = evidence.size;
      const value = count >= 45 ? 92 : count >= 30 ? 85 : count >= 18 ? 72 : count >= 8 ? 55 : 32;
      return { keywords: value, matched: [], missing: [] };
    }

    const isMatch = (k: string) =>
      profileTechs.has(k.toLowerCase()) || evidence.has(k.toLowerCase());
    const matched = jobTechs.filter(isMatch);
    const missing = jobTechs.filter((k) => !isMatch(k));
    const coverage = Math.round((matched.length / jobTechs.length) * 100);
    return { keywords: this.clamp(coverage), matched, missing };
  }

  private scoreTechnicalSkills(
    profile: NormalizedProfile,
    analysis: JobAnalysis,
    profileTechs: Set<string>,
  ): number {
    const categories = new Set(
      profile.skills.map((s) => (s.category ?? '').trim()).filter(Boolean),
    );
    const breadth = Math.min(100, profileTechs.size * 9 + categories.size * 6);

    if (analysis.hardSkills.length === 0) {
      return profileTechs.size > 0 ? breadth : 30;
    }
    const covered = analysis.hardSkills.filter((s) => profileTechs.has(s.toLowerCase())).length;
    const jobMatch = Math.round((covered / analysis.hardSkills.length) * 100);
    // Blend job coverage with overall breadth.
    return this.clamp(Math.round(jobMatch * 0.7 + breadth * 0.3));
  }

  private scoreExperience(profile: NormalizedProfile): number {
    const entries = [
      ...profile.experience.map((e) => ({ bullets: (e.highlights ?? []).length, dated: Boolean(e.period || e.startDate) })),
      ...profile.projects.map((p) => ({ bullets: (p.highlights ?? []).length + (p.description ? 1 : 0), dated: false })),
    ];
    if (entries.length === 0) return 0;

    const countScore = Math.min(60, entries.length * 20);
    const withBullets = entries.filter((e) => e.bullets > 0).length;
    const bulletScore = Math.round((withBullets / entries.length) * 40);
    return this.clamp(countScore + bulletScore);
  }

  private scoreStructure(profile: NormalizedProfile): number {
    const sections = [
      Boolean(profile.name?.trim()),
      Boolean(profile.summary?.trim()),
      Boolean(profile.contact.email?.trim()),
      profile.skills.length > 0,
      profile.experience.length > 0 || profile.projects.length > 0,
      profile.education.length > 0,
      profile.links.length > 0,
    ];
    return Math.round((sections.filter(Boolean).length / sections.length) * 100);
  }

  private scoreAchievements(profile: NormalizedProfile): number {
    const bullets = [
      ...profile.experience.flatMap((e) => [...(e.highlights ?? []), ...(e.results ?? [])]),
      ...profile.projects.flatMap((p) => p.highlights ?? []),
    ];
    if (bullets.length === 0) return 0;

    const strong = bullets.filter((b) => {
      const lower = b.toLowerCase();
      const hasVerb = ACTION_VERBS.some((v) => lower.includes(v));
      const hasNumber = /\d/.test(b);
      return hasVerb || hasNumber;
    }).length;
    const ratio = strong / bullets.length;
    // Reward both the ratio and having a reasonable number of bullets.
    return this.clamp(Math.round(ratio * 80 + Math.min(20, bullets.length * 4)));
  }

  private scoreReadability(profile: NormalizedProfile): number {
    const bullets = [
      ...profile.experience.flatMap((e) => e.highlights ?? []),
      ...profile.projects.flatMap((p) => p.highlights ?? []),
    ];
    let score = 92;
    const tooLong = bullets.filter((b) => b.length > 300).length;
    if (bullets.length > 0) score -= Math.round((tooLong / bullets.length) * 30);

    // Penalize keyword stuffing in the summary.
    if (profile.summary && this.isKeywordStuffed(profile.summary)) score -= 25;
    if (!profile.summary?.trim()) score -= 10;
    return this.clamp(score);
  }

  private isKeywordStuffed(text: string): boolean {
    const words = text.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    if (words.length < 6) return false;
    const counts = new Map<string, number>();
    for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
    const maxRepeat = Math.max(...counts.values());
    return maxRepeat >= 5;
  }

  // ── Explanations ──────────────────────────────────────────────────────────────

  private findWeakSections(profile: NormalizedProfile, b: AtsScoreBreakdown): string[] {
    const weak: string[] = [];
    if (!profile.summary?.trim() || b.readability < 70) weak.push('Resumo Profissional');
    if (b.experience < 60) weak.push('Experiência / Projetos');
    if (b.technicalSkills < 60) weak.push('Habilidades Técnicas');
    if (b.achievements < 55) weak.push('Resultados / Conquistas');
    if (b.structure < 70) weak.push('Estrutura / Contato');
    return weak;
  }

  private buildRecommendations(
    profile: NormalizedProfile,
    b: AtsScoreBreakdown,
    missing: string[],
  ): string[] {
    const tips: string[] = [];
    if (!profile.summary?.trim()) {
      tips.push('Adicione um resumo profissional de 2–4 linhas no topo do currículo.');
    }
    if (!profile.contact.email?.trim() || !profile.contact.phone?.trim()) {
      tips.push('Inclua e-mail e telefone no cabeçalho.');
    }
    if (b.experience < 60) {
      tips.push('Conecte um GitHub/LinkedIn público ou descreva experiências com bullets de atividades.');
    }
    if (b.achievements < 55) {
      tips.push('Transforme responsabilidades em conquistas (verbo de ação + tecnologia + contexto + resultado).');
    }
    if (b.keywords < 70 && missing.length > 0) {
      tips.push(
        `Requisitos da vaga sem comprovação nos seus dados: ${missing.slice(0, 6).join(', ')}. Se você tiver essa experiência, adicione evidências concretas; caso contrário, não inclua tecnologias que você não domina.`,
      );
    }
    if (b.technicalSkills < 60) {
      tips.push('Liste mais competências técnicas comprovadas, agrupadas por categoria.');
    }
    return tips;
  }

  private clamp(n: number): number {
    return Math.max(0, Math.min(100, Math.round(n)));
  }
}

interface EvidenceSource {
  source: DataSource;
  evidenceType: RequirementEvidence['evidenceType'];
  excerpt: string;
  positionOffset?: number;
}

function analyzeRequirements(
  profile: NormalizedProfile,
  requirements: ParsedJobRequirement[],
  evidenceWeights: Record<RequirementEvidence['evidenceType'], number>,
): AnalyzedJobRequirement[] {
  const sources: EvidenceSource[] = [
    ...profile.experience.flatMap((experience) => {
      const source = experience.source ?? 'candidate';
      return [
        ...(experience.stack ?? []).map((excerpt) => ({
          source,
          evidenceType: 'professional_experience' as const,
          excerpt,
        })),
        ...(experience.highlights ?? []).map((excerpt) => ({
          source,
          evidenceType: 'professional_experience' as const,
          excerpt,
        })),
        ...(experience.results ?? []).map((excerpt) => ({
          source,
          evidenceType: 'professional_experience' as const,
          excerpt,
        })),
      ];
    }),
    ...profile.projects.flatMap((project) => {
      const source = project.source ?? 'github';
      return [
        project.name,
        project.description ?? '',
        ...(project.stack ?? []),
        ...(project.highlights ?? []),
      ]
        .filter(Boolean)
        .map((excerpt) => ({
          source,
          evidenceType: 'project' as const,
          excerpt,
        }));
    }),
    ...profile.skills.map((skill) => ({
      source: skill.source ?? 'candidate',
      evidenceType: 'profile_mention' as const,
      excerpt: skill.name,
    })),
    ...(profile.evidence ?? []).map((item) => {
      const mentionPosition =
        findTechnologyMentions(item.originalExcerpt, item.canonicalName)[0]?.position ?? 0;
      return {
        source: item.source,
        evidenceType: item.evidenceType,
        excerpt: item.originalExcerpt,
        positionOffset: item.position - mentionPosition,
      };
    }),
    ...[profile.headline, profile.summary]
      .filter((text): text is string => Boolean(text?.trim()))
      .map((excerpt) => ({
        source: 'candidate' as const,
        evidenceType: 'profile_mention' as const,
        excerpt,
      })),
    ...profile.education.map((education) => ({
      source: education.source ?? 'candidate',
      evidenceType: 'education' as const,
      excerpt: [education.institution, education.degree, education.field]
        .filter(Boolean)
        .join(' '),
    })),
  ];

  const bestEvidenceFor = (term: string): RequirementEvidence | null => {
    let best: { ev: RequirementEvidence; strength: number } | null = null;
    for (const source of sources) {
      const ev = createEvidence(source, term);
      if (!ev) continue;
      const strength = evidenceWeights[ev.evidenceType] * ev.confidence * 100;
      if (!best || strength > best.strength) best = { ev, strength };
    }
    return best?.ev ?? null;
  };
  const fullStack = buildFullStackEvidence(profile, bestEvidenceFor);

  return requirements.map((requirement) => {
    const terms = requirement.technologies.length
      ? requirement.technologies
      : [requirement.text];
    const termResults = terms.map((term) => {
      const evidence = sources
        .map((source) => createEvidence(source, term))
        .filter((item): item is RequirementEvidence => item !== null);
      const strength = evidence.reduce(
        (strongest, item) =>
          Math.max(
            strongest,
            evidenceWeights[item.evidenceType] * item.confidence * 100,
          ),
        0,
      );
      return { evidence, strength };
    });
    const evidence = termResults.flatMap((result) => result.evidence);
    const matchStrength =
      termResults.length > 0
        ? Math.round(
            termResults.reduce((sum, result) => sum + result.strength, 0) /
              termResults.length,
          )
        : 0;

    // Full-stack requirement: proven when the candidate has BOTH backend and
    // frontend evidence — partial credit, flagged for review because the desired
    // seniority is not confirmed by the data alone (spec §7A).
    if (
      requirement.technologies.length === 0 &&
      isFullStackRequirement(requirement.text) &&
      fullStack &&
      matchStrength < FULL_STACK_STRENGTH
    ) {
      return {
        ...requirement,
        evidence: dedupeEvidence([...fullStack, ...evidence]),
        matchStrength: FULL_STACK_STRENGTH,
        reviewRequired: true,
      };
    }

    return { ...requirement, evidence, matchStrength };
  });
}

const FULL_STACK_STRENGTH = 65;
const BACKEND_LANGUAGES = new Set(['Java', 'Python', 'C#', 'Go', 'PHP', 'Ruby', 'Kotlin', 'Rust']);

function isFullStackRequirement(text: string): boolean {
  return /\bfull[\s-]?stack\b/i.test(text);
}

function isBackendTech(tech: string): boolean {
  return categoryOf(tech) === 'Backend' || BACKEND_LANGUAGES.has(tech);
}

function collectProfileTechs(profile: NormalizedProfile): string[] {
  return normalizeTechList([
    ...profile.skills.map((s) => s.name),
    ...profile.experience.flatMap((e) => e.stack ?? []),
    ...profile.projects.flatMap((p) => p.stack ?? []),
  ]);
}

function buildFullStackEvidence(
  profile: NormalizedProfile,
  bestEvidenceFor: (term: string) => RequirementEvidence | null,
): RequirementEvidence[] | null {
  const techs = collectProfileTechs(profile);
  const backendTech = techs.find(isBackendTech);
  const frontendTech = techs.find((t) => categoryOf(t) === 'Frontend');
  if (!backendTech || !frontendTech) return null;
  const backend = bestEvidenceFor(backendTech);
  const frontend = bestEvidenceFor(frontendTech);
  if (!backend || !frontend) return null;
  return [backend, frontend];
}

function dedupeEvidence(items: RequirementEvidence[]): RequirementEvidence[] {
  const seen = new Set<string>();
  const out: RequirementEvidence[] = [];
  for (const item of items) {
    const key = `${item.source}:${item.canonicalName}:${item.originalExcerpt}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function createEvidence(source: EvidenceSource, term: string): RequirementEvidence | null {
  const excerpt = source.excerpt;
  const canonical = extractTechnologies(term)[0];
  const foundTechnologies = extractTechnologies(excerpt);
  let matchIndex = -1;
  let confidence = 0;
  let occurrences = 0;

  if (canonical && foundTechnologies.includes(canonical)) {
    const mentions = findTechnologyMentions(excerpt, canonical);
    const firstMention = mentions[0];
    if (firstMention) {
      matchIndex = firstMention.position;
      confidence =
        firstMention.text.toLowerCase() === canonical.toLowerCase() ? 1 : 0.9;
      occurrences = mentions.length;
    }
  } else if (!canonical) {
    const requirementWords = comparisonWords(term);
    const excerptWords = comparisonWords(excerpt);
    const overlap = requirementWords.filter((word) => excerptWords.includes(word));
    if (requirementWords.length > 0 && overlap.length === requirementWords.length) {
      matchIndex = findFirstWordPosition(excerpt, overlap[0]);
      confidence = 0.8;
    } else if (
      requirementWords.length >= 2 &&
      overlap.length >= Math.ceil(requirementWords.length * 0.7)
    ) {
      matchIndex = findFirstWordPosition(excerpt, overlap[0]);
      confidence = 0.65;
    }
  }

  if (matchIndex < 0) return null;
  const excerptStart = Math.max(0, matchIndex - 80);
  const excerptEnd = Math.min(excerpt.length, matchIndex + term.length + 120);
  const context = excerpt.slice(excerptStart, excerptEnd).trim();
  const canonicalName = canonical ?? term.trim();
  const skillId = canonicalName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  return {
    skillId,
    canonicalName,
    source: source.source,
    evidenceType: source.evidenceType,
    originalExcerpt: context,
    position: (source.positionOffset ?? 0) + matchIndex,
    confidence,
    occurrences: canonical ? occurrences : countOccurrences(excerpt, term),
  };
}

function comparisonWords(text: string): string[] {
  const nonSpecificTerms = new Set([
    'com',
    'em',
    'para',
    'de',
    'da',
    'do',
    'the',
    'and',
    'for',
    'with',
    'degree',
    'formacao',
    'academica',
    'superior',
    'experiencia',
    'conhecimento',
    'conhecimentos',
    'dominio',
    'obrigatorio',
    'obrigatoria',
    'necessario',
    'necessaria',
    'desejavel',
    'diferencial',
    'curso',
    'certificacao',
    'certificado',
  ]);
  return (
    text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .match(/[a-z0-9+#./-]{3,}/g) ?? []
  ).filter((word) => !nonSpecificTerms.has(word));
}

function findFirstWordPosition(text: string, word: string): number {
  const index = text.toLowerCase().indexOf(word.toLowerCase());
  return index >= 0 ? index : 0;
}

function countOccurrences(text: string, term: string): number {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [
    ...text.matchAll(
      new RegExp(`(?<![a-z0-9+#])${escaped}(?![a-z0-9+#])`, 'gi'),
    ),
  ].length;
}
