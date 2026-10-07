import { JobTarget, NormalizedProfile } from '../entities/NormalizedProfile';
import { AtsAnalyzer } from './AtsAnalyzer';
import { extractTechnologies } from './TechTaxonomy';

/**
 * Tailors a profile to a specific job by REORDERING (never inventing) its
 * content by relevance: job-matched skills first, the most relevant bullets
 * first within each experience, and the most job-relevant projects first.
 *
 * All content is preserved — only the order changes — so the resume stays
 * truthful while surfacing what matters for the vacancy (spec §5/§7/§21/§22).
 */
export class ResumeTailor {
  constructor(private readonly analyzer: AtsAnalyzer = new AtsAnalyzer()) {}

  tailor(profile: NormalizedProfile, job: JobTarget | null | undefined): NormalizedProfile {
    const analysis = this.analyzer.analyzeJob(job);
    const jobTerms = new Set(
      [...analysis.keywords, ...analysis.hardSkills].map((t) => t.toLowerCase()),
    );
    if (jobTerms.size === 0) return profile;

    const score = (text: string): number => {
      if (!text) return 0;
      const lower = text.toLowerCase();
      const techs = extractTechnologies(text).map((t) => t.toLowerCase());
      let hits = 0;
      for (const term of jobTerms) {
        if (techs.includes(term) || lower.includes(term)) hits++;
      }
      return hits;
    };

    // Stable sort helper (preserves original order on ties).
    const stableSortDesc = <T>(arr: T[], weight: (item: T) => number): T[] =>
      arr
        .map((item, index) => ({ item, index, w: weight(item) }))
        .sort((a, b) => (b.w - a.w) || (a.index - b.index))
        .map((x) => x.item);

    const skills = stableSortDesc(profile.skills, (s) => score(s.name));

    const experience = profile.experience.map((exp) => ({
      ...exp,
      highlights: exp.highlights
        ? stableSortDesc(exp.highlights, (h) => score(`${h} ${(exp.stack ?? []).join(' ')}`))
        : exp.highlights,
    }));

    const projects = stableSortDesc(profile.projects, (p) =>
      score(
        [p.name, p.description ?? '', ...(p.stack ?? []), ...(p.highlights ?? [])].join(' '),
      ),
    );

    return { ...profile, skills, experience, projects };
  }
}
