import { JobTarget, NormalizedProfile } from '../entities/NormalizedProfile';
import { extractKeywordsFromText } from './KeywordExtractor';
import { extractTechnologies, normalizeTechList } from './TechTaxonomy';

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

const ACTION_VERBS = [
  'desenvolv', 'implement', 'cri', 'constru', 'projet', 'lider', 'arquitet',
  'otimiz', 'integr', 'automat', 'migr', 'refator', 'mant', 'escal', 'reduz',
  'aument', 'entreg', 'coorden', 'gerenci', 'develop', 'implement', 'creat',
  'built', 'design', 'led', 'optimi', 'integrat', 'automat', 'migrat', 'deliver',
];

export class AtsAnalyzer {
  analyzeJob(job: JobTarget | null | undefined): JobAnalysis {
    const text = [job?.title ?? '', job?.description ?? ''].join('\n');
    const keywords = extractKeywordsFromText(text);
    const hardSkills = extractTechnologies(text);

    let seniority: string | null = job?.seniority ?? null;
    if (!seniority) {
      for (const [re, label] of SENIORITY_TERMS) {
        if (re.test(text)) {
          seniority = label;
          break;
        }
      }
    }
    return { keywords, hardSkills, seniority };
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

    return {
      score,
      status: score >= PASS_THRESHOLD ? 'PASSED' : 'NEEDS_IMPROVEMENT',
      breakdown,
      matchedKeywords: matched,
      missingKeywords: missing.slice(0, 20),
      weakSections,
      recommendations,
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
        `Evidencie (quando for verdade) termos da vaga ausentes: ${missing.slice(0, 6).join(', ')}.`,
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
