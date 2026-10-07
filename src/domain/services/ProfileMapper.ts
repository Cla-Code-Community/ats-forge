import { EnrichedExperience } from '../entities/EnrichedExperience';
import { JobTarget, NormalizedProfile } from '../entities/NormalizedProfile';
import { RenderPayload, RenderProject } from '../interfaces/IResumeRenderer';
import { humanizeName, sanitizeText } from './TextSanitizer';

/**
 * Maps the framework-agnostic NormalizedProfile onto the RenderPayload the
 * renderers draw. It separates real professional experience from GitHub
 * projects, sanitizes every string (removing emoji/HTML noise) and never
 * invents data (spec §7).
 */

const DEFAULT_SKILL_CATEGORY = 'Competências';

export function mapProfileToRenderPayload(
  profile: NormalizedProfile,
  job: JobTarget | null | undefined,
  matchedKeywords: string[],
): RenderPayload {
  return {
    contact: {
      nome: sanitizeText(profile.name),
      email: sanitizeText(profile.contact.email) || '',
      telefone: sanitizeText(profile.contact.phone) || '',
      linkedin: findLink(profile, 'linkedin'),
      github: findLink(profile, 'github'),
      portfolio: profile.contact.website
        ? sanitizeText(profile.contact.website)
        : findLink(profile, 'portfolio'),
      formacao: profile.education.map(formatEducation).filter(Boolean),
      idiomas: profile.languages.map(formatLanguage).filter(Boolean),
    },
    focus: 'candidate',
    title: sanitizeText(job?.title) || sanitizeText(profile.headline) || 'Profissional',
    profile: buildSummary(profile),
    skills: buildSkills(profile),
    experiencias: buildExperiences(profile),
    projetos: buildProjects(profile),
    extraKeywords: matchedKeywords.map((k) => sanitizeText(k)).filter(Boolean),
  };
}

function findLink(profile: NormalizedProfile, type: string): string {
  const link = profile.links.find((l) => l.type.toLowerCase() === type.toLowerCase());
  return link?.url ? sanitizeText(link.url) : '';
}

function formatEducation(ed: NormalizedProfile['education'][number]): string {
  const degree = [ed.degree, ed.field].filter(Boolean).join(' em ');
  const parts = [ed.institution, degree].filter((p) => p && p.trim());
  const base = sanitizeText(parts.join(' - '));
  return ed.period ? `${base} (${sanitizeText(ed.period)})` : base;
}

function formatLanguage(lang: NormalizedProfile['languages'][number]): string {
  return lang.level
    ? `${sanitizeText(lang.name)} - ${sanitizeText(lang.level)}`
    : sanitizeText(lang.name);
}

function buildSummary(profile: NormalizedProfile): string {
  if (profile.summary?.trim()) return sanitizeText(profile.summary);

  const topSkills = profile.skills.slice(0, 6).map((s) => sanitizeText(s.name));
  const role = sanitizeText(profile.headline);
  if (role && topSkills.length > 0) {
    return `${role} com experiência prática em ${topSkills.join(', ')}.`;
  }
  if (role) return role;
  if (topSkills.length > 0) {
    return `Profissional com experiência prática em ${topSkills.join(', ')}.`;
  }
  return '';
}

function buildSkills(profile: NormalizedProfile): Record<string, string[]> {
  const groups: Record<string, string[]> = {};
  for (const skill of profile.skills) {
    const category = sanitizeText(skill.category) || DEFAULT_SKILL_CATEGORY;
    const name = sanitizeText(skill.name);
    if (!name) continue;
    if (!groups[category]) groups[category] = [];
    if (!groups[category].includes(name)) groups[category].push(name);
  }
  return groups;
}

function buildExperiences(profile: NormalizedProfile): EnrichedExperience[] {
  return profile.experience.map((exp) => ({
    empresa: sanitizeText(exp.company),
    cargo: sanitizeText(exp.role),
    periodo: formatPeriod(exp),
    stack: (exp.stack ?? []).map((s) => sanitizeText(s)).filter(Boolean).join(', '),
    atividades: (exp.highlights ?? []).map((a) => sanitizeText(a)).filter(Boolean),
    resultados: (exp.results ?? []).map((r) => sanitizeText(r)).filter(Boolean),
  }));
}

function buildProjects(profile: NormalizedProfile): RenderProject[] {
  return profile.projects.map((proj) => ({
    name: humanizeName(sanitizeText(proj.name)),
    stack: (proj.stack ?? []).map((s) => sanitizeText(s)).filter(Boolean).join(', '),
    description: sanitizeText(proj.description),
    // highlights excludes the description (which is rendered separately) to
    // avoid the duplicated-bullet problem.
    highlights: (proj.highlights ?? [])
      .map((h) => sanitizeText(h))
      .filter((h) => h && h !== sanitizeText(proj.description)),
    url: proj.url ? sanitizeText(proj.url) : undefined,
  }));
}

function formatPeriod(exp: NormalizedProfile['experience'][number]): string {
  if (exp.period?.trim()) return sanitizeText(exp.period);
  const end = exp.current ? 'Atual' : sanitizeText(exp.endDate);
  return [sanitizeText(exp.startDate), end].filter(Boolean).join(' - ');
}
