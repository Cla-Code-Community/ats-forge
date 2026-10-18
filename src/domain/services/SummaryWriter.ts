import { JobTarget, NormalizedProfile } from '../entities/NormalizedProfile';
import { AtsAnalyzer } from './AtsAnalyzer';
import { extractTechnologies, normalizeTechList } from './TechTaxonomy';
import { sanitizeText } from './TextSanitizer';

/**
 * Writes a job-tailored professional summary (junção vaga + candidato):
 *  - leads with the candidate's own "about" when it already reads as a strong
 *    pitch (complete sentences, never cut mid-word), otherwise with a real role +
 *    the relevant technologies;
 *  - appends a targeting line with the job role and the technologies the vacancy
 *    asks for AND the candidate actually has.
 * It condenses — it never invents (spec §6).
 */

const MAX_LEN = 480;
const MAX_TECHS = 5;

const BARE_SENIORITY =
  /^(pleno|pleno\(a\)|s[êe]nior|senior|j[úu]nior|junior|mid|mid[- ]?level|estagi[áa]rio|estagi[áa]ria|trainee|especialista)$/i;

const ROLE_START =
  /^(engenheir|desenvolvedor|desenvolvedora|software|arquitet|analista|t[ée]cnic|full[\s-]?stack|back[\s-]?end|front[\s-]?end|programador|programadora|l[íi]der|tech lead)/i;

function listPt(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
}

export class SummaryWriter {
  constructor(private readonly analyzer: AtsAnalyzer = new AtsAnalyzer()) {}

  write(
    profile: NormalizedProfile,
    job: JobTarget | null | undefined,
    about: string | null | undefined,
  ): string {
    const analysis = this.analyzer.analyzeJob(job);
    const profileTechs = this.profileTechnologies(profile);
    const jobRole = sanitizeText(job?.title).trim();

    const relevant = analysis.hardSkills
      .filter((t) => profileTechs.has(t.toLowerCase()))
      .slice(0, MAX_TECHS);
    const techsToShow =
      relevant.length >= 2
        ? relevant
        : normalizeTechList(profile.skills.map((s) => s.name)).slice(0, MAX_TECHS);

    const aboutSentences = this.completeSentences(about, 3);
    const aboutHasRole = aboutSentences.length > 0 && ROLE_START.test(aboutSentences[0]);

    let core: string;
    if (aboutHasRole) {
      core = aboutSentences.slice(0, 2).join(' ');
    } else {
      const role = this.pickRole(profile, job);
      const opener =
        techsToShow.length > 0
          ? `${role} com experiência em ${listPt(techsToShow)}.`
          : `${role}.`;
      core = [opener, aboutSentences.slice(0, 1).join(' ')].filter(Boolean).join(' ');
    }

    const targeting =
      techsToShow.length >= 2
        ? jobRole
          ? `Direcionado à vaga de ${jobRole}, com experiência em ${listPt(techsToShow)}.`
          : `Experiência em ${listPt(techsToShow)}.`
        : jobRole
          ? `Direcionado à vaga de ${jobRole}.`
          : '';

    const summary = [core, targeting].filter(Boolean).join(' ').trim();
    return this.truncateAtSentence(summary, MAX_LEN);
  }

  private pickRole(profile: NormalizedProfile, job: JobTarget | null | undefined): string {
    const expRole = sanitizeText(profile.experience[0]?.role).trim();
    if (expRole && !BARE_SENIORITY.test(expRole)) return expRole;
    const headline = sanitizeText(profile.headline).trim();
    if (headline && !BARE_SENIORITY.test(headline)) return headline;
    const jobTitle = sanitizeText(job?.title).trim();
    if (jobTitle) return jobTitle;
    if (headline) return headline;
    return 'Profissional de tecnologia';
  }

  private completeSentences(about: string | null | undefined, max: number): string[] {
    const clean = sanitizeText(about).replace(/\s+/g, ' ').trim();
    if (clean.length < 20) return [];
    const matches = clean.match(/[^.!?]+[.!?]+/g) ?? [];
    return matches
      .map((s) => s.trim())
      .filter((s) => s.length > 15)
      .slice(0, max);
  }

  private truncateAtSentence(text: string, max: number): string {
    if (text.length <= max) return text;
    const cut = text.slice(0, max);
    const lastEnd = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
    if (lastEnd > max * 0.5) return cut.slice(0, lastEnd + 1).trim();
    const lastSpace = cut.lastIndexOf(' ');
    return `${cut.slice(0, lastSpace > 0 ? lastSpace : max).trimEnd()}…`;
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
