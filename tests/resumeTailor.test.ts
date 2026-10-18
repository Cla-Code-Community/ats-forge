import { describe, expect, it } from 'vitest';
import { NormalizedProfile } from '../src/domain/entities/NormalizedProfile';
import { ResumeTailor } from '../src/domain/services/ResumeTailor';

const tailor = new ResumeTailor();

function profile(): NormalizedProfile {
  return {
    name: 'Dev',
    contact: {},
    experience: [
      {
        company: 'Acme',
        role: 'Dev',
        stack: ['Java', 'Spring Boot', 'React'],
        highlights: [
          'Criei telas em React',
          'Desenvolvi APIs REST com Java e Spring Boot',
        ],
        results: [],
      },
    ],
    education: [],
    skills: [
      { name: 'React' },
      { name: 'Node.js' },
      { name: 'Java' },
      { name: 'Spring Boot' },
    ],
    projects: [
      { name: 'frontend-app', stack: ['React'], highlights: [] },
      { name: 'java-api', description: 'API em Java e Spring Boot', stack: ['Java', 'Spring Boot'], highlights: [] },
    ],
    links: [],
    languages: [],
  };
}

describe('ResumeTailor', () => {
  const job = { title: 'Backend Java', description: 'Java, Spring Boot e REST API' };

  it('prioriza skills exigidas pela vaga', () => {
    const t = tailor.tailor(profile(), job);
    const names = t.skills.map((s) => s.name);
    expect(names.indexOf('Java')).toBeLessThan(names.indexOf('Node.js'));
    expect(names.indexOf('Spring Boot')).toBeLessThan(names.indexOf('React'));
  });

  it('reordena bullets da experiência por relevância à vaga', () => {
    const t = tailor.tailor(profile(), job);
    expect(t.experience[0].highlights?.[0]).toMatch(/APIs REST com Java/);
  });

  it('prioriza projetos relacionados à vaga', () => {
    const t = tailor.tailor(profile(), job);
    expect(t.projects[0].name).toBe('java-api');
  });

  it('não altera a ordem quando não há vaga', () => {
    const original = profile();
    const t = tailor.tailor(original, null);
    expect(t.skills.map((s) => s.name)).toEqual(original.skills.map((s) => s.name));
  });

  it('preserva todo o conteúdo (apenas reordena)', () => {
    const original = profile();
    const t = tailor.tailor(original, job);
    expect(t.skills).toHaveLength(original.skills.length);
    expect(t.projects).toHaveLength(original.projects.length);
    expect(t.experience[0].highlights).toHaveLength(2);
  });
});
