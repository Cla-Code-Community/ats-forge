import { JobTarget, NormalizedProfile } from '../entities/NormalizedProfile';
import { AtsAnalyzer } from './AtsAnalyzer';
import { extractTechnologies, normalizeTechList } from './TechTaxonomy';
import { sanitizeText } from './TextSanitizer';

/**
 * Writes a SHORT, job-tailored professional summary.
 *
 * It starts from the candidate's own "about" text (e.g. the LinkedIn "Sobre"
 * they pasted) and the job description, and weaves in only the technologies the
 * candidate really has that the job asks for. It condenses — it never invents
 * (spec §6).
 */

const MAX_LEN = 320;
const MAX_TECHS = 5;

export class SummaryWriter {
  constructor(private readonly analyzer: AtsAnalyzer = new AtsAnalyzer()) {}

  write(
    profile: NormalizedProfile,
    job: JobTarget | null | undefined,
    about: string | null | undefined,
  ): string {
    const analysis = this.analyzer.analyzeJob(job);
    const profileTechs = this.profileTechnologies(profile);

    // Real + relevant: techs the job asks for AND the candidate actually has.
    const relevant = analysis.hardSkills.filter((t) => profileTechs.has(t.toLowerCase()));
    const techs = (relevant.length > 0
      ? relevant
      : normalizeTechList(profile.skills.map((s) => s.name))
    ).slice(0, MAX_TECHS);

    const role =
      sanitizeText(profile.headline) ||
      sanitizeText(job?.title) ||
      'Profissional de tecnologia';

    const techLine = techs.length > 0 ? `${role} com foco em ${techs.join(', ')}.` : `${role}.`;

    const aboutLine = this.firstSentences(about);

    const summary = [techLine, aboutLine].filter(Boolean).join(' ').trim();
    return this.truncate(summary, MAX_LEN);
  }

  /** First 1–2 clean sentences from the candidate's about text. */
  private firstSentences(about: string | null | undefined): string {
    const clean = sanitizeText(about).replace(/\s+/g, ' ').trim();
    if (clean.length < 20) return '';
    const sentences = clean.split(/(?<=[.!?])\s+/).slice(0, 2).join(' ');
    return this.truncate(sentences, 220);
  }

  private truncate(text: string, max: number): string {
    if (text.length <= max) return text;
    const cut = text.slice(0, max);
    const lastSpace = cut.lastIndexOf(' ');
    return `${cut.slice(0, lastSpace > 0 ? lastSpace : max).trimEnd()}...`;
  }

  private profileTechnologies(profile: NormalizedProfile): Set<string> {
    const names = [
      ...profile.skills.map((s) => s.name),
      ...profile.experience.flatMap((e) => e.stack ?? []),
      ...profile.projects.flatMap((p) => p.stack ?? []),
      ...extractTechnologies(
        [
          profile.summary ?? '',
          ...profile.experience.flatMap((e) => e.highlights ?? []),
          ...profile.projects.flatMap((p) => [p.description ?? '', ...(p.highlights ?? [])]),
        ].join('\n'),
      ),
    ];
    return new Set(normalizeTechList(names).map((t) => t.toLowerCase()));
  }
}
