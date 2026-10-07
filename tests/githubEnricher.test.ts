import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  GitHubEnricher,
  parseGitHubUsername,
} from '../src/infrastructure/enrichment/GitHubEnricher';
import { minimalProfile } from './fixtures';

const enricher = new GitHubEnricher();

afterEach(() => {
  vi.restoreAllMocks();
});

function mockFetchOnce(user: unknown, repos: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      const u = String(url);
      let body: unknown;
      if (/\/readme$/.test(u)) {
        // README endpoint (profile + repos). Return a small base64 README.
        body = {
          content: Buffer.from('Projeto em Node.js e TypeScript.').toString('base64'),
          encoding: 'base64',
        };
      } else if (/\/repos\?/.test(u)) {
        body = repos;
      } else {
        body = user;
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(body),
      } as Response);
    }),
  );
}

describe('parseGitHubUsername', () => {
  it('extrai o username de uma URL do GitHub', () => {
    expect(parseGitHubUsername('https://github.com/bene-tesla')).toBe('bene-tesla');
  });
  it('aceita handle puro', () => {
    expect(parseGitHubUsername('@bene-tesla')).toBe('bene-tesla');
  });
  it('retorna null para entrada inválida', () => {
    expect(parseGitHubUsername('not a user!!')).toBeNull();
    expect(parseGitHubUsername(undefined)).toBeNull();
  });
});

describe('GitHubEnricher', () => {
  it('adiciona o link do LinkedIn (sem scraping)', async () => {
    const { profile } = await enricher.enrich(minimalProfile(), {
      linkedin: 'https://www.linkedin.com/in/bene-tesla',
    });
    expect(profile.links.find((l) => l.type === 'linkedin')?.url).toContain(
      'linkedin.com/in/bene-tesla',
    );
  });

  it('normaliza handle de LinkedIn para URL pública', async () => {
    const { profile } = await enricher.enrich(minimalProfile(), {
      linkedin: 'bene-tesla',
    });
    expect(profile.links.find((l) => l.type === 'linkedin')?.url).toBe(
      'https://www.linkedin.com/in/bene-tesla',
    );
  });

  it('importa repositórios públicos como projetos e linguagens como skills', async () => {
    mockFetchOnce(
      {
        login: 'ana',
        name: 'Ana',
        bio: 'Dev backend',
        blog: 'ana.dev',
        location: 'SP',
        html_url: 'https://github.com/ana',
      },
      [
        {
          name: 'cool-api',
          description: 'API em Node',
          html_url: 'https://github.com/ana/cool-api',
          language: 'TypeScript',
          stargazers_count: 120,
          forks_count: 8,
          fork: false,
          archived: false,
          topics: ['node', 'api'],
        },
        {
          name: 'fork-repo',
          description: 'fork',
          html_url: 'x',
          language: 'Go',
          stargazers_count: 999,
          forks_count: 0,
          fork: true,
          archived: false,
        },
      ],
    );

    const { profile, warnings } = await enricher.enrich(minimalProfile(), {
      github: 'https://github.com/ana',
    });

    expect(warnings).toEqual([]);
    expect(profile.projects.map((p) => p.name)).toContain('cool-api');
    // forks são ignorados
    expect(profile.projects.map((p) => p.name)).not.toContain('fork-repo');
    expect(profile.skills.map((s) => s.name)).toContain('TypeScript');
    expect(profile.links.find((l) => l.type === 'github')?.url).toBe(
      'https://github.com/ana',
    );
    expect(profile.contact.location).toBe('SP');
  });

  it('não falha a geração quando o GitHub retorna erro (gera warning)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) } as Response),
      ),
    );

    const { profile, warnings } = await enricher.enrich(minimalProfile(), {
      github: 'ghost-user',
    });

    expect(warnings.length).toBe(1);
    expect(profile.projects).toEqual([]);
  });

  it('sem sources, retorna o perfil intacto', async () => {
    const { profile, warnings } = await enricher.enrich(minimalProfile(), undefined);
    expect(warnings).toEqual([]);
    expect(profile.links).toEqual([]);
  });
});
