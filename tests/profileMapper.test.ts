import { describe, expect, it } from 'vitest';
import { mapProfileToRenderPayload } from '../src/domain/services/ProfileMapper';
import { fullProfile, minimalProfile, projectsOnlyProfile } from './fixtures';

describe('mapProfileToRenderPayload', () => {
  it('mapeia contatos, links e formação corretamente', () => {
    const payload = mapProfileToRenderPayload(fullProfile(), { title: 'Backend' }, []);

    expect(payload.contact.nome).toBe('Ana Souza');
    expect(payload.contact.github).toBe('github.com/ana');
    expect(payload.contact.linkedin).toBe('linkedin.com/in/ana');
    expect(payload.title).toBe('Backend');
    expect(payload.contact.formacao[0]).toContain('USP');
  });

  it('agrupa skills por categoria', () => {
    const payload = mapProfileToRenderPayload(fullProfile(), null, []);
    expect(payload.skills['Linguagens']).toContain('TypeScript');
    expect(payload.skills['Backend']).toContain('Node.js');
  });

  it('gera resumo a partir de evidências quando summary está ausente', () => {
    const payload = mapProfileToRenderPayload(projectsOnlyProfile(), null, []);
    expect(payload.profile).toContain('Desenvolvedora');
  });

  it('coloca projetos na seção de projetos (separada da experiência)', () => {
    const payload = mapProfileToRenderPayload(projectsOnlyProfile(), null, []);
    expect(payload.experiencias).toEqual([]);
    expect(payload.projetos.length).toBe(1);
    expect(payload.projetos[0].name).toBe('Open Source CLI');
    expect(payload.projetos[0].description).toBe('Ferramenta CLI em Python');
  });

  it('não quebra com perfil mínimo', () => {
    const payload = mapProfileToRenderPayload(minimalProfile(), null, []);
    expect(payload.contact.nome).toBe('João Lima');
    expect(payload.experiencias).toEqual([]);
    expect(payload.projetos).toEqual([]);
    expect(payload.title).toBe('Profissional');
  });

  it('remove emoji e entidades HTML do resumo', () => {
    const dirty = {
      ...fullProfile(),
      summary: 'Engenheiro 👋🚀 de software &nbsp; backend 🧑‍💻',
    };
    const payload = mapProfileToRenderPayload(dirty, null, []);
    expect(payload.profile).not.toMatch(/[\u{1F000}-\u{1FFFF}]/u);
    expect(payload.profile).not.toContain('&nbsp;');
    expect(payload.profile).toContain('Engenheiro');
  });
});
