import { describe, expect, it } from 'vitest';
import { focusJobDescription } from '../src/domain/services/JobDescriptionFocus';

const MINSAIT = [
  'Na Minsait, acreditamos na tecnologia como força para transformar realidades.',
  'Desenvolvemos soluções que conectam inovação e progresso.',
  '',
  'Nosso jeito de ser',
  'Inovamos com propósito',
  'Valorizamos a diversidade e quem transforma',
  '',
  'Valores',
  'Inovação, conexão, confiança e antecipação de futuro',
  '',
  'Responsabilidades e atribuições',
  'Desenvolver e manter aplicações Web e APIs REST;',
  'Atuar no desenvolvimento backend utilizando Java/Spring Boot, Node.js ou Python;',
  'Aplicar princípios de SOLID, Clean Architecture e Design Patterns;',
  'Trabalhar com aplicações conteinerizadas utilizando Docker;',
  '',
  'Requisitos e qualificações',
  'Experiência prática no desenvolvimento de APIs REST;',
  'Conhecimentos em OAuth2, JWT e segurança de APIs;',
  'Experiência com Docker;',
  '',
  'Diferencial',
  'Conhecimento em mensageria, como Kafka, AWS SQS ou tecnologias similares;',
  '',
  'Informações adicionais',
  'Modelo de contratação CLT.',
  'Plano de Saúde subsidiado pela empresa para o titular.',
  'Gympass - Wellhub (Acesso a mais de 700 academias).',
  'Vale Refeição ou Vale Alimentação.',
  '',
  'Todas as nossas vagas são abertas também para PCDs.',
  'Venha ser um Minsaiter!',
].join('\n');

describe('focusJobDescription', () => {
  it('mantém responsabilidades, requisitos e diferenciais', () => {
    const focused = focusJobDescription(MINSAIT);
    expect(focused).toMatch(/Responsabilidades/i);
    expect(focused).toContain('APIs REST');
    expect(focused).toContain('OAuth2');
    expect(focused).toContain('Docker');
    expect(focused).toMatch(/Diferencial/i);
    expect(focused).toContain('Kafka');
  });

  it('remove empresa, cultura, valores e benefícios', () => {
    const focused = focusJobDescription(MINSAIT);
    expect(focused).not.toMatch(/acreditamos na tecnologia/i);
    expect(focused).not.toMatch(/Nosso jeito de ser/i);
    expect(focused).not.toMatch(/Inovamos com propósito/i);
    expect(focused).not.toMatch(/Plano de Saúde/i);
    expect(focused).not.toMatch(/Gympass/i);
    expect(focused).not.toMatch(/Vale Refeição/i);
    expect(focused).not.toMatch(/Minsaiter/i);
  });

  it('retorna a descrição original quando não há seções reconhecíveis', () => {
    const plain = 'Procuramos uma pessoa dev com Node.js e React para o nosso time.';
    expect(focusJobDescription(plain)).toBe(plain);
  });

  it('lida com entrada vazia', () => {
    expect(focusJobDescription('')).toBe('');
    expect(focusJobDescription(undefined)).toBe('');
  });
});
