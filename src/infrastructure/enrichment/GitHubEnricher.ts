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
import { extractSkillEvidence } from '../../domain/services/EvidenceExtractor';
import { stripGitHubReadmeMarkup } from '../../domain/services/TextSanitizer';

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
const TIMEOUT_MS = 6000;
// Orçamento total da importação; deve ficar abaixo do timeout do backend.
const TOTAL_BUDGET_MS = 14000;
const MAX_PROJECTS = 5;
const MAX_README_FETCHES = 5;
const MAX_SKILLS_FROM_GITHUB = 20;
const MAX_GITHUB_JSON_BYTES = 1024 * 1024;
const MAX_README_JSON_BYTES = 512 * 1024;

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
    if (!username) {
      if (sources?.github?.trim()) {
        warnings.push('O identificador informado não é um username ou URL válido do GitHub.');
      }
      return { profile: enriched, warnings, sourcesUsed };
    }

    try {
      enriched = await withDeadline(
        this.importGitHub(enriched, username),
        TOTAL_BUDGET_MS,
      );
      sourcesUsed.push('github');
    } catch (err) {
      warnings.push(
        `Não foi possível importar o GitHub "${username}": ${(err as Error).message}. O currículo foi gerado com os demais dados.`,
      );
    }

    return { profile: enriched, warnings, sourcesUsed };
  }

  private async importGitHub(
    profile: NormalizedProfile,
    username: string,
  ): Promise<NormalizedProfile> {
    {
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

      return this.mergeGitHub(profile, user, relevant, profileReadme, repoReadmes);
    }
  }

  private mergeGitHub(
    profile: NormalizedProfile,
    user: GitHubUser,
    repos: GitHubRepo[],
    profileReadme: string | null,
    repoReadmes: Array<string | null>,
  ): NormalizedProfile {
    const cleanProfileReadme = stripGitHubReadmeMarkup(profileReadme);
    const cleanRepoReadmes = repoReadmes.map(stripGitHubReadmeMarkup);
    // ── Technologies from every public signal ────────────────────────────────
    const techText = [
      user.bio ?? '',
      cleanProfileReadme,
      ...repos.map((r) => r.description ?? ''),
      ...repos.flatMap((r) => r.topics ?? []),
      ...cleanRepoReadmes,
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
        const readme = cleanRepoReadmes[idx] ?? '';
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

    const githubEvidence = [
      ...extractSkillEvidence(user.bio ?? '', 'github', 'profile_mention'),
      ...extractSkillEvidence(cleanProfileReadme, 'github', 'profile_mention'),
      ...repos.flatMap((repo, index) => [
        ...extractSkillEvidence(repo.language ?? '', 'github', 'profile_mention'),
        ...extractSkillEvidence((repo.topics ?? []).join(' '), 'github', 'profile_mention'),
        ...extractSkillEvidence(
          `${repo.description ?? ''}\n${cleanRepoReadmes[index] ?? ''}`,
          'github',
          'project',
        ),
      ]),
    ];

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
      evidence: [...(profile.evidence ?? []), ...githubEvidence],
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
    return readBoundedJson<T>(res, MAX_GITHUB_JSON_BYTES);
  }

  /** Fetches and decodes a repo's README. Returns null if there is none. */
  private async fetchReadme(owner: string, repo: string): Promise<string | null> {
    try {
      const res = await fetch(`${API}/repos/${owner}/${repo}/readme`, {
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'ats-forge' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) return null;
      const body = await readBoundedJson<GitHubReadme>(res, MAX_README_JSON_BYTES);
      if (!body.content) return null;
      const buf = Buffer.from(body.content, (body.encoding as BufferEncoding) ?? 'base64');
      return buf.toString('utf-8');
    } catch {
      return null;
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function withDeadline<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error('tempo limite excedido ao consultar a API do GitHub')),
      ms,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

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
  let candidate: string;
  if (/^(?:https?:\/\/)?(?:www\.)?github\.com\//i.test(trimmed)) {
    try {
      const url = new URL(
        /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`,
      );
      if (!['github.com', 'www.github.com'].includes(url.hostname.toLowerCase())) {
        return null;
      }
      const path = url.pathname.split('/').filter(Boolean);
      if (path.length !== 1) return null;
      candidate = path[0];
    } catch {
      return null;
    }
  } else if (trimmed.includes('/') || trimmed.includes('://')) {
    return null;
  } else {
    candidate = trimmed.replace(/^@/, '');
  }
  return /^[A-Za-z0-9-]{1,39}$/.test(candidate) ? candidate : null;
}

async function readBoundedJson<T>(response: Response, maxBytes: number): Promise<T> {
  const declaredLength = Number(response.headers?.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new Error('resposta do GitHub excede o limite de tamanho permitido');
  }

  if (!response.body) {
    const value: unknown = await response.json();
    return value as T;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let json = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      throw new Error('resposta do GitHub excede o limite de tamanho permitido');
    }
    json += decoder.decode(value, { stream: true });
  }
  json += decoder.decode();
  return JSON.parse(json) as T;
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
