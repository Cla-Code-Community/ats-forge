import { describe, expect, it } from 'vitest';
import {
  categoryOf,
  extractTechnologies,
  normalizeTech,
  normalizeTechList,
} from '../src/domain/services/TechTaxonomy';

describe('TechTaxonomy — correspondências falsas por substring', () => {
  it('não reconhece a linguagem C dentro de palavras ("código", "colaboração", "Clean Architecture", "CI/CD")', () => {
    for (const text of [
      'Aplicação de Clean Architecture e SOLID',
      'Pipelines de CI/CD com Docker',
      'Boa escrita de código e colaboração em equipe',
      'Trabalho com C# e C++ no projeto',
    ]) {
      expect(extractTechnologies(text)).not.toContain('C');
    }
  });

  it('reconhece C# e C++ corretamente (sem confundir com C)', () => {
    expect(extractTechnologies('Experiência com C# e ASP.NET')).toContain('C#');
    expect(extractTechnologies('Desenvolvimento em C++')).toContain('C++');
  });

  it('ainda reconhece C como skill explícita (normalização de token)', () => {
    expect(normalizeTech('C')).toBe('C');
    expect(categoryOf('C')).toBe('Linguagens');
    expect(normalizeTechList(['C', 'Java'])).toEqual(['C', 'Java']);
  });

  it('distingue Java de JavaScript', () => {
    expect(extractTechnologies('Experiência com Java e Spring Boot')).toContain('Java');
    expect(extractTechnologies('Experiência com Java e Spring Boot')).not.toContain('JavaScript');
    expect(extractTechnologies('Front-end em JavaScript')).toContain('JavaScript');
  });

  it('não confunde AWS com Azure ou Google Cloud', () => {
    const techs = extractTechnologies('Deploy em AWS');
    expect(techs).toContain('AWS');
    expect(techs).not.toContain('Azure');
    expect(techs).not.toContain('Google Cloud');
  });

  it('normaliza aliases de Node.js', () => {
    expect(normalizeTech('NodeJS')).toBe('Node.js');
    expect(normalizeTech('node js')).toBe('Node.js');
    expect(extractTechnologies('Backend em NodeJS')).toContain('Node.js');
  });

  it('não reconhece Git a partir de "Gitea"', () => {
    expect(extractTechnologies('Versionamento com Gitea')).not.toContain('Git');
    expect(extractTechnologies('Uso de Git no dia a dia')).toContain('Git');
  });
});
