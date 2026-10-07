import { IResumeRenderer, RenderPayload } from '../../domain/interfaces/IResumeRenderer';

export class MarkdownResumeRenderer implements IResumeRenderer {
  readonly extension = '.md';

  async render(payload: RenderPayload): Promise<string> {
    const { contact, title, profile, skills, experiencias, projetos, extraKeywords } = payload;

    const keywordsSection =
      extraKeywords.length > 0
        ? `\n> **Palavras-chave da vaga:** ${extraKeywords.slice(0, 12).join(', ')}\n`
        : '';

    const contactLine = [contact.email, contact.telefone].filter(Boolean).join(' | ');
    const linksLine = [contact.linkedin, contact.github, contact.portfolio]
      .filter(Boolean)
      .join(' | ');

    const experienceSection =
      experiencias.length > 0
        ? `\n---\n\n## EXPERIÊNCIA PROFISSIONAL\n\n${experiencias
            .map((exp) => {
              const activities = exp.atividades.map((a) => `- ${a}`).join('\n');
              const results =
                exp.resultados.length > 0
                  ? `\n**Resultados:**\n${exp.resultados.map((r) => `- ${r}`).join('\n')}`
                  : '';
              const meta = [exp.periodo, exp.stack ? `Stack: ${exp.stack}` : '']
                .filter(Boolean)
                .join(' | ');
              return [`**${exp.empresa} – ${exp.cargo}**`, meta, '', activities, results]
                .join('\n')
                .trimEnd();
            })
            .join('\n\n')}\n`
        : '';

    const projectsSection =
      projetos.length > 0
        ? `\n---\n\n## PROJETOS\n\n${projetos
            .map((p) => {
              const meta = p.stack ? `Stack: ${p.stack}` : '';
              const bullets = [p.description, ...p.highlights]
                .filter(Boolean)
                .map((b) => `- ${b}`)
                .join('\n');
              return [`**${p.name}**`, meta, '', bullets].filter(Boolean).join('\n').trimEnd();
            })
            .join('\n\n')}\n`
        : '';

    const skillsSection = Object.entries(skills)
      .map(([cat, items]) => `**${cat}:** ${items.join(', ')}`)
      .join('\n');

    const educationSection =
      contact.formacao.length > 0
        ? `\n---\n\n## FORMAÇÃO ACADÊMICA\n\n${contact.formacao.map((f) => `- ${f}`).join('\n')}\n`
        : '';

    const languagesSection =
      contact.idiomas.length > 0
        ? `\n---\n\n## IDIOMAS\n\n${contact.idiomas.map((i) => `- ${i}`).join('\n')}\n`
        : '';

    const summarySection = profile
      ? `\n---\n\n## RESUMO PROFISSIONAL\n\n${profile}\n`
      : '';

    return `# ${contact.nome}
## ${title}

${contactLine}
${linksLine}
${keywordsSection}${summarySection}${experienceSection}${projectsSection}
---

## HABILIDADES TÉCNICAS

${skillsSection}
${educationSection}${languagesSection}`;
  }
}
