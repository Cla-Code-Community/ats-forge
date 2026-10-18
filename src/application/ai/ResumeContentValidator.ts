import { NormalizedProfile } from '../../domain/entities/NormalizedProfile';
import { extractTechnologies, normalizeTechList } from '../../domain/services/TechTaxonomy';
import { EnhancedContentAI } from './aiSchemas';

const NUMBER_RE = /\d+(?:[.,]\d+)?/g;
const MAX_SUMMARY_LEN = 600;
const MAX_HIGHLIGHT_LEN = 500;
const MAX_HIGHLIGHTS = 8;

export interface ContentValidationResult {
  profile: NormalizedProfile;
  warnings: string[];
  acceptedSummary: boolean;
  rewrittenExperiences: number;
  rewrittenProjects: number;
}

export class ResumeContentValidator {
  reconcile(
    source: NormalizedProfile,
    content: EnhancedContentAI,
    about?: string | null,
  ): ContentValidationResult {
    const warnings: string[] = [];

    const summaryResult = this.validateSummary(source, content.summary, about, warnings);

    const experience = this.applySectionRewrites(
      source.experience,
      content.experiences,
      (item) => [...(item.stack ?? []), ...(item.highlights ?? []), ...(item.results ?? [])],
      (item, highlights) => ({ ...item, highlights }),
      'experiência',
      warnings,
    );

    const projects = this.applySectionRewrites(
      source.projects,
      content.projects,
      (item) => [item.description ?? '', ...(item.stack ?? []), ...(item.highlights ?? [])],
      (item, highlights) => ({ ...item, highlights }),
      'projeto',
      warnings,
    );

    return {
      profile: {
        ...source,
        summary: summaryResult.summary,
        experience: experience.items,
        projects: projects.items,
      },
      warnings,
      acceptedSummary: summaryResult.accepted,
      rewrittenExperiences: experience.rewritten,
      rewrittenProjects: projects.rewritten,
    };
  }

  private validateSummary(
    source: NormalizedProfile,
    aiSummary: string,
    about: string | null | undefined,
    warnings: string[],
  ): { summary: string | undefined; accepted: boolean } {
    const candidate = aiSummary?.trim();
    if (!candidate) return { summary: source.summary, accepted: false };

    const allowedTechs = this.profileTechSet(source, about);
    const summaryTechs = normalizeTechList(extractTechnologies(candidate)).map((t) => t.toLowerCase());
    const inventedTech = summaryTechs.find((t) => !allowedTechs.has(t));
    if (inventedTech) {
      warnings.push(`Resumo gerado por IA descartado: menciona tecnologia sem evidência ("${inventedTech}").`);
      return { summary: source.summary, accepted: false };
    }

    const allowedNumbers = this.numberSet([
      source.summary ?? '',
      about ?? '',
      ...this.profileText(source),
    ]);
    const invented = this.numbersOf(candidate).find((n) => !allowedNumbers.has(n));
    if (invented) {
      warnings.push(`Resumo gerado por IA descartado: contém número sem origem nos dados ("${invented}").`);
      return { summary: source.summary, accepted: false };
    }

    return { summary: this.truncate(candidate, MAX_SUMMARY_LEN), accepted: true };
  }

  private applySectionRewrites<T extends { highlights?: string[] }>(
    items: T[],
    rewrites: EnhancedContentAI['experiences'],
    sourceTextOf: (item: T) => string[],
    withHighlights: (item: T, highlights: string[]) => T,
    label: string,
    warnings: string[],
  ): { items: T[]; rewritten: number } {
    if (rewrites.length === 0) return { items, rewritten: 0 };

    const byIndex = new Map<number, string[]>();
    for (const rewrite of rewrites) {
      if (rewrite.index >= 0 && rewrite.index < items.length) {
        byIndex.set(rewrite.index, rewrite.highlights);
      }
    }

    let rewritten = 0;
    const next = items.map((item, index) => {
      const proposed = byIndex.get(index);
      if (!proposed) return item;

      const allowedNumbers = this.numberSet(sourceTextOf(item));
      const safe = proposed
        .map((h) => h.trim())
        .filter(Boolean)
        .filter((h) => {
          const invented = this.numbersOf(h).find((n) => !allowedNumbers.has(n));
          if (invented) {
            warnings.push(`Bullet de ${label} #${index + 1} descartado: número sem origem ("${invented}").`);
            return false;
          }
          return true;
        })
        .map((h) => this.truncate(h, MAX_HIGHLIGHT_LEN))
        .slice(0, MAX_HIGHLIGHTS);

      if (safe.length === 0) return item;
      rewritten++;
      return withHighlights(item, safe);
    });

    return { items: next, rewritten };
  }

  private profileTechSet(profile: NormalizedProfile, about: string | null | undefined): Set<string> {
    const names = [
      ...profile.skills.map((s) => s.name),
      ...profile.experience.flatMap((e) => e.stack ?? []),
      ...profile.projects.flatMap((p) => p.stack ?? []),
      ...extractTechnologies([about ?? '', ...this.profileText(profile)].join('\n')),
    ];
    return new Set(normalizeTechList(names).map((t) => t.toLowerCase()));
  }

  private profileText(profile: NormalizedProfile): string[] {
    return [
      profile.headline ?? '',
      profile.summary ?? '',
      ...profile.experience.flatMap((e) => [...(e.highlights ?? []), ...(e.results ?? [])]),
      ...profile.projects.flatMap((p) => [p.description ?? '', ...(p.highlights ?? [])]),
    ];
  }

  private numberSet(texts: string[]): Set<string> {
    return this.numbersOf(texts.join('\n')).reduce((set, n) => set.add(n), new Set<string>());
  }

  private numbersOf(text: string): string[] {
    return (text.match(NUMBER_RE) ?? []).map((n) => n.replace(',', '.'));
  }

  private truncate(text: string, max: number): string {
    if (text.length <= max) return text;
    const cut = text.slice(0, max);
    const lastSpace = cut.lastIndexOf(' ');
    return `${cut.slice(0, lastSpace > 0 ? lastSpace : max).trimEnd()}…`;
  }
}
