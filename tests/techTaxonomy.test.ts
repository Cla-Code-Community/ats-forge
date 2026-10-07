import { describe, expect, it } from 'vitest';
import {
  categoryOf,
  extractTechnologies,
  normalizeTech,
  normalizeTechList,
} from '../src/domain/services/TechTaxonomy';

describe('TechTaxonomy', () => {
  it('normaliza aliases para o nome canônico', () => {
    expect(normalizeTech('nodejs')).toBe('Node.js');
    expect(normalizeTech('node')).toBe('Node.js');
    expect(normalizeTech('ts')).toBe('TypeScript');
    expect(normalizeTech('postgres')).toBe('PostgreSQL');
    expect(normalizeTech('k8s')).toBe('Kubernetes');
  });

  it('remove duplicatas ao normalizar uma lista', () => {
    expect(normalizeTechList(['Node', 'node.js', 'NODEJS', 'TypeScript', 'ts'])).toEqual([
      'Node.js',
      'TypeScript',
    ]);
  });

  it('categoriza tecnologias conhecidas', () => {
    expect(categoryOf('React')).toBe('Frontend');
    expect(categoryOf('postgres')).toBe('Bancos de Dados');
    expect(categoryOf('docker')).toBe('Infraestrutura & DevOps');
    expect(categoryOf('Clean Architecture')).toBe('Arquitetura & Práticas');
  });

  it('extrai tecnologias de texto livre (README)', () => {
    const text =
      'Backend em Node.js e TypeScript, com PostgreSQL e Redis. Deploy com Docker e AWS. Testes com Jest. Clean Architecture e REST APIs.';
    const techs = extractTechnologies(text);
    expect(techs).toEqual(
      expect.arrayContaining([
        'Node.js',
        'TypeScript',
        'PostgreSQL',
        'Redis',
        'Docker',
        'AWS',
        'Jest',
        'Clean Architecture',
        'REST API',
      ]),
    );
  });

  it('prefere termos compostos (Spring Boot antes de Spring)', () => {
    const techs = extractTechnologies('Experiência com Spring Boot e microservices.');
    expect(techs).toContain('Spring Boot');
    expect(techs).toContain('Microservices');
  });

  it('não extrai tecnologias ausentes', () => {
    expect(extractTechnologies('Trabalho em equipe e boa comunicação.')).toEqual([]);
  });
});
