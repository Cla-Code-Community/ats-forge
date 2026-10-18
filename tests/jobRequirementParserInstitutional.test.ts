import { describe, expect, it } from 'vitest';
import { JobRequirementParser } from '../src/domain/services/JobRequirementParser';

const parser = new JobRequirementParser();

const MINSAIT = [
  'Na Minsait, acreditamos na tecnologia para transformar realidades.',
  'Valorizamos a autonomia, a colaboração e o crescimento contínuo.',
  '',
  'Nosso jeito de ser',
  'Inovamos com propósito',
  'Crescemos com responsabilidade',
  'Valorizamos a diversidade e quem transforma',
  '',
  'Valores',
  'Inovação, conexão, confiança e antecipação de futuro',
  '',
  'Responsabilidades e atribuições',
  'Desenvolver e manter aplicações Web e APIs REST',
  'Atuar no desenvolvimento backend utilizando Java/Spring Boot, Node.js ou Python',
  '',
  'Requisitos e qualificações',
  'Experiência prática no desenvolvimento de APIs REST',
  'Conhecimentos em OAuth2, JWT e segurança de APIs',
  'Experiência com Docker',
  '',
  'Diferencial',
  'Conhecimento em mensageria, como Kafka',
  '',
  'Informações adicionais',
  'Modelo de contratação CLT.',
  'Plano de Saúde subsidiado pela empresa.',
  'Vale Refeição ou Vale Alimentação.',
].join('\n');

describe('JobRequirementParser — conteúdo institucional', () => {
  const parsed = parser.parse({ title: 'Desenvolvedor Full Stack Pleno', description: MINSAIT });
  const texts = parsed.requirements.map((r) => r.text.toLowerCase());

  it('não classifica frases institucionais como requisitos comportamentais', () => {
    const behavioral = parsed.requirements.filter((r) => r.category === 'behavioral');
    expect(behavioral.map((r) => r.text.toLowerCase())).not.toContain('inovamos com propósito');
    expect(texts).not.toContain('crescemos com responsabilidade');
    expect(texts).not.toContain('inovação, conexão, confiança e antecipação de futuro');
    expect(texts.some((t) => t.includes('acreditamos na tecnologia'))).toBe(false);
  });

  it('não inclui benefícios nem condições de contratação', () => {
    expect(texts.some((t) => t.includes('plano de saúde'))).toBe(false);
    expect(texts.some((t) => t.includes('vale refeição'))).toBe(false);
    expect(texts.some((t) => t.includes('clt'))).toBe(false);
  });

  it('mantém responsabilidades, requisitos e diferenciais reais', () => {
    expect(parsed.requirements.some((r) => r.category === 'responsibility')).toBe(true);
    expect(parsed.requirements.some((r) => r.priority === 'required')).toBe(true);
    expect(parsed.requirements.some((r) => r.technologies.includes('Docker'))).toBe(true);
    expect(parsed.requirements.some((r) => r.technologies.includes('Kafka'))).toBe(true);
  });

  it('ignora linhas de introdução que terminam em ":" e não têm tecnologia', () => {
    const result = parser.parse({
      description: [
        'Requisitos',
        'Domínio de pelo menos uma das seguintes stacks backend:',
        'Java + Spring Boot',
        'Node.js',
      ].join('\n'),
    });
    const texts = result.requirements.map((r) => r.text.toLowerCase());
    expect(texts.some((t) => t.includes('domínio de pelo menos'))).toBe(false);
    expect(result.requirements.some((r) => r.technologies.includes('Java'))).toBe(true);
    expect(result.requirements.some((r) => r.technologies.includes('Node.js'))).toBe(true);
  });
});
