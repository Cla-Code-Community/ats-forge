import { describe, expect, it } from 'vitest';
import { NormalizedProfile } from '../src/domain/entities/NormalizedProfile';
import { SummaryWriter } from '../src/domain/services/SummaryWriter';

const writer = new SummaryWriter();

function profile(): NormalizedProfile {
  return {
    name: 'Bene',
    headline: 'Engenheiro de Software Backend',
    contact: {},
    experience: [],
    education: [],
    skills: [
      { name: 'Java' },
      { name: 'Spring Boot' },
      { name: 'Node.js' },
      { name: 'MuleSoft' },
      { name: 'React' },
    ],
    projects: [],
    links: [],
    languages: [],
  };
}

describe('SummaryWriter', () => {
  const job = { title: 'Backend Java', description: 'Java, Spring Boot, MuleSoft e REST API' };

  it('gera um resumo curto baseado no "Sobre" do LinkedIn + vaga', () => {
    const about =
      'Sou engenheiro de software com paixão por sistemas distribuídos e integrações corporativas de larga escala. Busco sempre qualidade e observabilidade.';
    const summary = writer.write(profile(), job, about);

    expect(summary.length).toBeLessThanOrEqual(320);
    expect(summary).toContain('Engenheiro de Software Backend');
    // prioriza techs reais que a vaga pede
    expect(summary).toMatch(/Java/);
    expect(summary).toMatch(/MuleSoft/);
    // inclui a essência do "sobre"
    expect(summary).toMatch(/sistemas distribuídos|integrações/i);
    // não inclui tech irrelevante à vaga em primeiro plano
    expect(summary.startsWith('Engenheiro')).toBe(true);
  });

  it('remove emoji/ruído do about', () => {
    const summary = writer.write(profile(), job, 'Dev 🚀🔥 focado em entregas &nbsp; de valor.');
    expect(summary).not.toMatch(/[\u{1F000}-\u{1FFFF}]/u);
    expect(summary).not.toContain('&nbsp;');
  });

  it('lidera com o "Sobre" forte do candidato + targeting à vaga, sem cortar no meio', () => {
    const about =
      'Engenheiro de Software com atuação full stack, especializado em backend e integrações corporativas de alta escala. Minha missão é construir sistemas confiáveis e observáveis.';
    const summary = writer.write(
      profile(),
      { title: 'Desenvolvedor FullStack Pleno', description: 'Java, Spring Boot, MuleSoft e REST API' },
      about,
    );
    expect(summary).toContain('Engenheiro de Software com atuação full stack');
    expect(summary).toContain('Direcionado à vaga de Desenvolvedor FullStack Pleno');
    expect(summary).toMatch(/Java|MuleSoft/);
    expect(summary).not.toMatch(/\.\.\.$/);
    expect(summary).not.toMatch(/Júnior/i);
  });

  it('usa o cargo-alvo da vaga quando o headline é só senioridade', () => {
    const base = { ...profile(), headline: 'Pleno' };
    const summary = writer.write(base, { title: 'Desenvolvedor FullStack Pleno', description: 'Java, Node.js' }, 'Sou dev.');
    expect(summary.startsWith('Desenvolvedor FullStack Pleno')).toBe(true);
    expect(summary).not.toMatch(/^Pleno com/);
  });

  it('funciona sem about (usa papel + techs relevantes)', () => {
    const summary = writer.write(profile(), job, null);
    expect(summary).toContain('Engenheiro de Software Backend');
    expect(summary).toMatch(/Java/);
  });

  it('sem vaga, usa as principais skills do candidato', () => {
    const summary = writer.write(profile(), null, 'Desenvolvedor focado em backend.');
    expect(summary).toMatch(/Java|Spring Boot|Node\.js/);
  });

  it('trunca about muito longo', () => {
    const long = 'Frase inicial relevante. ' + 'palavra '.repeat(200);
    const summary = writer.write(profile(), job, long);
    expect(summary.length).toBeLessThanOrEqual(320);
  });
});
