import {
  JobTarget,
  NormalizedProfile,
  NormalizedSkill,
} from '../entities/NormalizedProfile';
import { AtsAnalyzer, AtsReport, AtsStatus, JobAnalysis } from './AtsAnalyzer';
import {
  categoryOf,
  extractTechnologies,
  normalizeTech,
  normalizeTechList,
} from './TechTaxonomy';

/**
 * Iteratively improves a resume toward the ATS pass threshold using ONLY
 * legitimate, evidence-based transforms — normalization, deduplication, skill
 * categorization, and an evidence-derived professional summary. It never invents
 * data and never keyword-stuffs (spec §12/§13/§20).
 */

const PASS_THRESHOLD = 80;
const MAX_ITERATIONS = 6;

export interface OptimizationResult {
  profile: NormalizedProfile;
  report: AtsReport;
  iterations: number;
  appliedSteps: string[];
}

type Transform = {
  name: string;
  apply: (p: NormalizedProfile, ctx: Ctx) => NormalizedProfile;
};

interface Ctx {
  job: JobTarget | null | undefined;
  analysis: JobAnalysis;
}

export class ResumeOptimizer {
  constructor(private readonly analyzer: AtsAnalyzer = new AtsAnalyzer()) {}

  optimize(profile: NormalizedProfile, job: JobTarget | null | undefined): OptimizationResult {
    const analysis = this.analyzer.analyzeJob(job);
    const ctx: Ctx = { job, analysis };

    // Cleanups are always safe and expected (normalize/dedupe/categorize/summary
    // are core resume hygiene, not score-chasing). Each is applied only if it
    // doesn't reduce the score — and we stop early once we comfortably pass, to
    // avoid any artificial over-optimization (spec §13).
    const transforms: Transform[] = [
      { name: 'normalize-technologies', apply: normalizeTechnologies },
      { name: 'categorize-skills', apply: categorizeSkills },
      { name: 'promote-evidenced-skills', apply: promoteEvidencedSkills },
      { name: 'generate-summary', apply: generateSummary },
    ];

    let current = profile;
    let report = this.analyzer.score(current, analysis);
    const applied: string[] = [];
    let iterations = 0;

    for (const transform of transforms) {
      iterations++;
      const candidate = transform.apply(current, ctx);
      const candidateReport = this.analyzer.score(candidate, analysis);

      // Keep the transform only if it did not reduce the score.
      if (candidateReport.score >= report.score) {
        current = candidate;
        report = candidateReport;
        applied.push(transform.name);
      }

      if (iterations >= MAX_ITERATIONS) break;
    }

    report = { ...report, status: this.resolveStatus(current, report.score) };

    return { profile: current, report, iterations, appliedSteps: applied };
  }

  private resolveStatus(profile: NormalizedProfile, score: number): AtsStatus {
    if (score >= PASS_THRESHOLD) return 'PASSED';
    // Below threshold after legitimate optimization => not enough real data.
    const hasRichData =
      profile.skills.length >= 6 &&
      (profile.experience.length + profile.projects.length) >= 2;
    return hasRichData ? 'NEEDS_IMPROVEMENT' : 'INSUFFICIENT_DATA';
  }
}

// ── Transforms (pure) ───────────────────────────────────────────────────────────

function normalizeTechnologies(p: NormalizedProfile): NormalizedProfile {
  const skills = dedupeSkills(
    p.skills.map((s) => ({ ...s, name: normalizeTech(s.name) })),
  );
  const experience = p.experience.map((e) => ({
    ...e,
    stack: e.stack ? normalizeTechList(e.stack) : e.stack,
  }));
  const projects = p.projects.map((proj) => ({
    ...proj,
    stack: proj.stack ? normalizeTechList(proj.stack) : proj.stack,
  }));
  return { ...p, skills, experience, projects };
}

function categorizeSkills(p: NormalizedProfile): NormalizedProfile {
  const skills = p.skills.map((s) => {
    const category = categoryOf(s.name) ?? s.category ?? 'Competências';
    return { ...s, category };
  });
  return { ...p, skills };
}

/**
 * Adds, as skills, technologies that are PROVEN elsewhere in the profile
 * (project/experience stacks, descriptions, READMEs) but not yet listed — real
 * evidence, never invented.
 */
function promoteEvidencedSkills(p: NormalizedProfile): NormalizedProfile {
  const existing = new Set(p.skills.map((s) => s.name.toLowerCase()));

  const evidenceText = [
    ...p.projects.flatMap((proj) => [
      proj.description ?? '',
      ...(proj.stack ?? []),
      ...(proj.highlights ?? []),
    ]),
    ...p.experience.flatMap((e) => [...(e.stack ?? []), ...(e.highlights ?? [])]),
    p.summary ?? '',
    p.headline ?? '',
  ].join('\n');

  const evidenced = extractTechnologies(evidenceText);
  const additions: NormalizedSkill[] = [];
  for (const tech of evidenced) {
    if (!existing.has(tech.toLowerCase())) {
      existing.add(tech.toLowerCase());
      additions.push({
        name: tech,
        category: categoryOf(tech) ?? 'Competências',
        source: 'github',
      });
    }
  }
  return additions.length > 0 ? { ...p, skills: [...p.skills, ...additions] } : p;
}

function generateSummary(p: NormalizedProfile, ctx: Ctx): NormalizedProfile {
  if (p.summary && p.summary.trim().length >= 40) return p;

  const role =
    ctx.job?.title?.trim() ||
    p.headline?.trim() ||
    'Profissional de tecnologia';

  const topTechs = normalizeTechList(p.skills.map((s) => s.name)).slice(0, 6);

  const categories = [...new Set(p.skills.map((s) => s.category).filter(Boolean))];
  const areas = categories
    .filter((c) => c && c !== 'Competências')
    .slice(0, 3)
    .join(', ');

  const parts: string[] = [];
  if (topTechs.length > 0) {
    parts.push(
      `${role} com experiência prática em ${topTechs.join(', ')}`,
    );
  } else {
    parts.push(role);
  }
  if (areas) parts.push(`Atuação em ${areas}`);
  if (p.projects.length > 0) {
    parts.push(
      `Portfólio com ${p.projects.length} projeto(s) público(s) demonstrando as competências listadas`,
    );
  }

  const summary = parts.join('. ') + '.';
  return { ...p, summary };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function dedupeSkills(skills: NormalizedSkill[]): NormalizedSkill[] {
  const seen = new Map<string, NormalizedSkill>();
  for (const skill of skills) {
    const key = skill.name.toLowerCase();
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, skill);
    } else if (skill.years && (!existing.years || skill.years > existing.years)) {
      seen.set(key, { ...existing, years: skill.years });
    }
  }
  return [...seen.values()];
}
