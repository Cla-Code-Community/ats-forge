import {
  NormalizedProfile,
  NormalizedProject,
  NormalizedSkill,
} from '../../domain/entities/NormalizedProfile';
import {
  categoryOf,
  extractTechnologies,
  normalizeTechList,
} from '../../domain/services/TechTaxonomy';

/**
 * Enriches a normalized profile with PUBLIC GitHub data: the profile, the
 * profile README, the public repositories and the READMEs of the most relevant
 * ones. Technologies are extracted from languages, topics, descriptions and
 * README text, then normalized to canonical names.
 *
 * Only public, authorized data is used — no auth tokens, no scraping, no private
 * data. Everything merged is real (tagged `source: "github"`); nothing is
 * fabricated (spec §2/§3/§7/§24).
 */

export interface EnrichmentSources {
  github?: string;
  linkedin?: string;
}

export interface EnrichmentResult {
  profile: NormalizedProfile;
  warnings: string[];
  /** Which external sources actually contributed data (for UI transparency). */
  sourcesUsed: string[];
}

interface GitHubUser {
  login: string;
  name?: string | null;
  bio?: string | null;
  blog?: string | null;
  location?: string | null;
  company?: string | null;
  html_url: string;
}

interface GitHubRepo {
  name: string;
  description?: string | null;
  html_url: string;
  language?: string | null;
  stargazers_count: number;
  forks_count: number;
  fork: boolean;
  archived: boolean;
  topics?: string[];
  pushed_at?: string;
}

interface GitHubReadme {
  content?: string;
  encoding?: string;
}

const API = 'https://api.github.com';
const TIMEOUT_MS = 8000;
const MAX_PROJECTS = 5;
const MAX_README_FETCHES = 5;
const MAX_SKILLS_FROM_GITHUB = 20;

export class GitHubEnricher {
  async enrich(
    profile: NormalizedProfile,
    sources: EnrichmentSources | undefined,
  ): Promise<EnrichmentResult> {
    const warnings: string[] = [];
    const sourcesUsed = ['candidate'];
    let enriched = profile;

    const linkedin = normalizeLinkedIn(sources?.linkedin);
    if (linkedin) {
      enriched = addLink(enriched, 'linkedin', linkedin);
      sourcesUsed.push('linkedin');
    }

    const username = parseGitHubUsername(sources?.github);
    if (!username) return { profile: enriched, warnings, sourcesUsed };

    try {
      const [user, repos] = await Promise.all([
        this.fetchJson<GitHubUser>(`${API}/users/${username}`),
        this.fetchJson<GitHubRepo[]>(
          `${API}/users/${username}/repos?per_page=100&sort=pushed`,
        ),
      ]);

      const relevant = (repos ?? [])
        .filter((r) => !r.fork && !r.archived)
        .sort(byRelevance)
        .slice(0, Math.max(MAX_PROJECTS, MAX_README_FETCHES));

      // Read the profile README + the top repo READMEs (best-effort, in parallel).
      const [profileReadme, ...repoReadmes] = await Promise.all([
        this.fetchReadme(username, username),
        ...relevant
          .slice(0, MAX_README_FETCHES)
          .map((r) => this.fetchReadme(username, r.name)),
      ]);

      enriched = this.mergeGitHub(enriched, user, relevant, profileReadme, repoReadmes);
      sourcesUsed.push('github');
    } catch (err) {
      warnings.push(
        `Não foi possível importar o GitHub "${username}": ${(err as Error).message}. O currículo foi gerado com os demais dados.`,
      );
    }

    return { profile: enriched, warnings, sourcesUsed };
  }

  private mergeGitHub(
    profile: NormalizedProfile,
    user: GitHubUser,
    repos: GitHubRepo[],
    profileReadme: string | null,
    repoReadmes: Array<string | null>,
  ): NormalizedProfile {
    // ── Technologies from every public signal ────────────────────────────────
    const techText = [
      user.bio ?? '',
      profileReadme ?? '',
      ...repos.map((r) => r.description ?? ''),
      ...repos.flatMap((r) => r.topics ?? []),
      ...repoReadmes.filter((x): x is string => Boolean(x)),
    ].join('\n');

    const languages = repos.map((r) => r.language).filter((l): l is string => Boolean(l));
    const technologies = normalizeTechList([
      ...languages,
      ...extractTechnologies(techText),
    ]).slice(0, MAX_SKILLS_FROM_GITHUB);

    const existingSkillNames = new Set(profile.skills.map((s) => s.name.toLowerCase()));
    const githubSkills: NormalizedSkill[] = technologies
      .filter((t) => !existingSkillNames.has(t.toLowerCase()))
      .map((t) => ({
        name: t,
        category: categoryOf(t) ?? 'Tecnologias (GitHub)',
        source: 'github' as const,
      }));

    // ── Projects from the top repos, enriched with README-derived tech ───────
    const topProjects: NormalizedProject[] = repos
      .filter((r) => r.description || r.stargazers_count > 0 || r.topics?.length)
      .slice(0, MAX_PROJECTS)
      .map((r, idx) => {
        const readme = repoReadmes[idx] ?? '';
        const stack = normalizeTechList([
          ...(r.language ? [r.language] : []),
          ...(r.topics ?? []),
          ...extractTechnologies(`${r.description ?? ''}\n${readme}`),
        ]).slice(0, 8);
        return {
          name: r.name,
          description: r.description ?? undefined,
          url: r.html_url,
          stack: stack.length ? stack : undefined,
          highlights: buildRepoHighlights(r),
          source: 'github' as const,
        };
      });

    // ── Summary / contact fallbacks (never override candidate-provided data) ──
    // We intentionally do NOT use the raw profile README as the summary: READMEs
    // are full of emoji, badges and markdown that produce garbled output. We use
    // the short, clean bio as a fallback and let the optimizer craft a clean,
    // evidence-based summary otherwise. (profileReadme is still used for tech
    // extraction above.)
    void profileReadme;
    const summary =
      profile.summary || (user.bio && user.bio.length <= 240 ? user.bio : undefined);

    let merged: NormalizedProfile = {
      ...profile,
      summary: summary?.trim() || undefined,
      contact: {
        ...profile.contact,
        location: profile.contact.location || user.location || undefined,
        website: profile.contact.website || normalizeUrl(user.blog) || undefined,
      },
      skills: [...profile.skills, ...githubSkills],
      projects: [...profile.projects, ...topProjects],
    };

    merged = addLink(merged, 'github', user.html_url);
    const site = normalizeUrl(user.blog);
    if (site) merged = addLink(merged, 'portfolio', site);

    return merged;
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const res = await fetch(url, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'ats-forge' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status === 404) throw new Error('perfil não encontrado');
    if (res.status === 403) throw new Error('limite de requisições do GitHub atingido');
    if (!res.ok) throw new Error(`GitHub respondeu HTTP ${res.status}`);
    return (await res.json()) as T;
  }

  /** Fetches and decodes a repo's README. Returns null if there is none. */
  private async fetchReadme(owner: string, repo: string): Promise<string | null> {
    try {
      const res = await fetch(`${API}/repos/${owner}/${repo}/readme`, {
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'ats-forge' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) return null;
      const body = (await res.json()) as GitHubReadme;
      if (!body.content) return null;
      const buf = Buffer.from(body.content, (body.encoding as BufferEncoding) ?? 'base64');
      return buf.toString('utf-8');
    } catch {
      return null;
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function byRelevance(a: GitHubRepo, b: GitHubRepo): number {
  // Stars first, then most recently pushed.
  if (b.stargazers_count !== a.stargazers_count) {
    return b.stargazers_count - a.stargazers_count;
  }
  return (b.pushed_at ?? '').localeCompare(a.pushed_at ?? '');
}

function buildRepoHighlights(r: GitHubRepo): string[] {
  // Description is rendered separately by the mapper, so it is NOT repeated here.
  const highlights: string[] = [];
  const metrics: string[] = [];
  if (r.stargazers_count > 0) metrics.push(`${r.stargazers_count} stars`);
  if (r.forks_count > 0) metrics.push(`${r.forks_count} forks`);
  if (metrics.length > 0) highlights.push(`Projeto open source (${metrics.join(', ')}).`);
  return highlights;
}

export function parseGitHubUsername(input: string | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const urlMatch = /github\.com\/([A-Za-z0-9-]+)/i.exec(trimmed);
  const candidate = urlMatch ? urlMatch[1] : trimmed.replace(/^@/, '');
  return /^[A-Za-z0-9-]{1,39}$/.test(candidate) ? candidate : null;
}

function normalizeLinkedIn(input: string | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/linkedin\.com/i.test(trimmed)) return `https://${trimmed}`;
  return `https://www.linkedin.com/in/${trimmed.replace(/^@/, '')}`;
}

function normalizeUrl(input: string | null | undefined): string | undefined {
  if (!input) return undefined;
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function addLink(profile: NormalizedProfile, type: string, url: string): NormalizedProfile {
  if (profile.links.some((l) => l.type.toLowerCase() === type.toLowerCase())) return profile;
  return { ...profile, links: [...profile.links, { type, url }] };
}
