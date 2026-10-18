import { describe, expect, it } from 'vitest';
import { parseReadmeExperiences } from '../src/domain/services/GithubReadmeExperienceParser';

describe('parseReadmeExperiences', () => {
  it('lê experiências de uma seção em português com subtítulos e bullets', () => {
    const md = [
      '# Olá, eu sou Bene',
      '',
      '## Experiência Profissional',
      '',
      '### Engenheiro de Software — Acme Corp (2022 - Atual)',
      '- Desenvolvi APIs REST em Node.js e TypeScript',
      '- Reduzi a latência em 30%',
      '',
      '### Desenvolvedor Júnior @ Empresa X (2020 - 2022)',
      '- Manutenção de serviços backend',
      '',
      '## Skills',
      '- Node.js',
    ].join('\n');

    const result = parseReadmeExperiences(md);
    expect(result).toHaveLength(2);

    expect(result[0]).toMatchObject({
      role: 'Engenheiro de Software',
      company: 'Acme Corp',
      period: '2022 - Atual',
      source: 'github',
    });
    expect(result[0].highlights).toContain('Reduzi a latência em 30%');

    expect(result[1]).toMatchObject({ role: 'Desenvolvedor Júnior', company: 'Empresa X', period: '2020 - 2022' });
  });

  it('lê seção em inglês com título em negrito', () => {
    const md = [
      '## Professional Experience',
      '**Backend Engineer — Globex (2019-2021)**',
      '- Built microservices',
    ].join('\n');

    const result = parseReadmeExperiences(md);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ role: 'Backend Engineer', company: 'Globex' });
    expect(result[0].highlights).toContain('Built microservices');
  });

  it('retorna vazio quando não há seção de experiência', () => {
    const md = '# Meu perfil\n\nAlgumas informações gerais sobre mim.\n';
    expect(parseReadmeExperiences(md)).toEqual([]);
  });

  it('ignora entradas sem separador cargo/empresa', () => {
    const md = ['## Experiência', '### Apenas um título sem empresa', '- bullet'].join('\n');
    expect(parseReadmeExperiences(md)).toEqual([]);
  });

  it('não quebra com entrada vazia/nula', () => {
    expect(parseReadmeExperiences(undefined)).toEqual([]);
    expect(parseReadmeExperiences('')).toEqual([]);
  });

  it('rejeita experiência sem data válida (ex.: cliente "2+ anos")', () => {
    const md = [
      '## Experiência Profissional',
      '### Natura & Avon — SysMap Solutions — 2+ anos',
      '- Projetos de transformação digital',
    ].join('\n');
    expect(parseReadmeExperiences(md)).toEqual([]);
  });

  it('extrai período quando está em linha separada', () => {
    const md = [
      '## Experiência Profissional',
      '### Tech Lead — Initech',
      '2018 - 2020',
      '- Liderou a equipe de plataforma',
    ].join('\n');

    const result = parseReadmeExperiences(md);
    expect(result[0]).toMatchObject({ role: 'Tech Lead', company: 'Initech', period: '2018 - 2020' });
  });
});
