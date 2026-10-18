import { describe, expect, it } from 'vitest';
import { JobRequirementParser } from '../src/domain/services/JobRequirementParser';

describe('JobRequirementParser', () => {
  const parser = new JobRequirementParser();

  it('classifica requisitos, responsabilidades, formação, diferenciais e benefícios', () => {
    const result = parser.parse({
      title: 'Desenvolvedor Backend',
      description: [
        'Empresa: Acme',
        'Requisitos obrigatórios:',
        '- Experiência com Node.js e TypeScript',
        '- Formação superior em Ciência da Computação',
        'Será um diferencial:',
        '- Conhecimentos de Docker',
        '- Boa comunicação e trabalho em equipe',
        'Responsabilidades:',
        '- Implementar APIs com PostgreSQL',
        'Benefícios:',
        '- Plano de saúde e vale-refeição',
        'Sobre a empresa',
        'A Acme cria produtos para milhares de pessoas.',
      ].join('\n'),
    });

    expect(result.title).toBe('Desenvolvedor Backend');
    expect(result.company).toBe('Acme');
    expect(result.requirements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          text: 'Experiência com Node.js e TypeScript',
          category: 'required',
          priority: 'required',
          technologies: ['Node.js', 'TypeScript'],
        }),
        expect.objectContaining({
          text: 'Formação superior em Ciência da Computação',
          category: 'education',
          priority: 'required',
        }),
        expect.objectContaining({
          text: 'Conhecimentos de Docker',
          category: 'preferred',
          priority: 'preferred',
        }),
        expect.objectContaining({
          text: 'Boa comunicação e trabalho em equipe',
          category: 'behavioral',
          priority: 'preferred',
        }),
        expect.objectContaining({
          text: 'Implementar APIs com PostgreSQL',
          category: 'responsibility',
          priority: 'informational',
        }),
      ]),
    );
    expect(result.requirements.map((item) => item.text).join(' ')).not.toMatch(
      /plano de saúde|milhares de pessoas/i,
    );
  });

  it('retém requisitos não classificados para revisão e ignora blocos de código', () => {
    const result = parser.parse({
      description: [
        'Backend com Node.js',
        '```',
        'Experiência obrigatória com Kubernetes',
        '```',
        'É desejável ter experiência com Docker.',
      ].join('\n'),
    });

    expect(result.requirements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          text: 'Backend com Node.js',
          category: 'ambiguous',
          priority: 'review',
          reviewRequired: true,
        }),
        expect.objectContaining({
          text: 'É desejável ter experiência com Docker.',
          category: 'preferred',
          priority: 'preferred',
        }),
      ]),
    );
    expect(result.requirements.some((item) => item.text.includes('Kubernetes'))).toBe(false);
  });

  it('reconhece formatos alternativos e tabelas sem duplicar termos', () => {
    const result = parser.parse({
      description: [
        'O que esperamos de você',
        '| Conhecimentos obrigatórios | React.js e PostgreSQL |',
        'É essencial ter experiência com React e Postgres.',
      ].join('\n'),
    });

    expect(result.requirements).toHaveLength(2);
    expect(result.requirements[0].category).toBe('required');
    expect(result.requirements[0].technologies).toEqual(
      expect.arrayContaining(['React', 'PostgreSQL']),
    );
  });
});
