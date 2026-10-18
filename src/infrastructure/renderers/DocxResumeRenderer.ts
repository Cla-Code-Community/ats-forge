import {
    AlignmentType,
    BorderStyle,
    Document,
    LineRuleType,
    Packer,
    Paragraph,
    TextRun,
} from 'docx';
import { EnrichedExperience } from '../../domain/entities/EnrichedExperience';
import {
  IResumeRenderer,
  RenderPayload,
  RenderProject,
} from '../../domain/interfaces/IResumeRenderer';

// ── Typography constants (values in half-points) ─────────────────────────────
const FONT = 'Arial';
const SZ_NOME = 36;    // 18 pt
const SZ_TITULO = 24;  // 12 pt
const SZ_SECAO = 22;   // 11 pt
const SZ_CORPO = 22;   // 11 pt
const SZ_DETALHE = 20; // 10 pt
const SPACELINE = { line: 276, lineRule: LineRuleType.AUTO }; // 1.15×
const MARGIN_TWIPS = 1440; // 1 inch

// ── Paragraph helpers ─────────────────────────────────────────────────────────
function tx(text: string, styles: Record<string, unknown> = {}): TextRun {
  return new TextRun({ text, font: FONT, ...styles });
}

function para(runs: TextRun | TextRun[], opts: Record<string, unknown> = {}): Paragraph {
  return new Paragraph({ children: Array.isArray(runs) ? runs : [runs], ...opts });
}

function sectionHeader(label: string): Paragraph {
  return new Paragraph({
    children: [tx(label.toUpperCase(), { bold: true, size: SZ_SECAO })],
    spacing: { before: 280, after: 80, ...SPACELINE },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '444444', space: 4 } },
  });
}

function body(text: string, extra: Record<string, unknown> = {}): Paragraph {
  return para(tx(text, { size: SZ_CORPO, ...extra }), {
    spacing: { after: 60, ...SPACELINE },
  });
}

function bulletItem(text: string): Paragraph {
  return new Paragraph({
    children: [tx(`\u2022  ${text}`, { size: SZ_CORPO })],
    indent: { left: 360 },
    spacing: { after: 40, ...SPACELINE },
  });
}

function gap(before = 0): Paragraph {
  return new Paragraph({ children: [], spacing: { before, after: 0 } });
}

// ── Section builders ──────────────────────────────────────────────────────────
function contactBlock(contact: RenderPayload['contact'], title: string): Paragraph[] {
  const center = { alignment: AlignmentType.CENTER };
  return [
    para(tx(contact.nome.toUpperCase(), { bold: true, size: SZ_NOME }), { ...center, spacing: { after: 60 } }),
    para(tx(title, { size: SZ_TITULO, color: '333333' }), { ...center, spacing: { after: 100 } }),
    para(tx(`${contact.email}   |   ${contact.telefone}`, { size: SZ_CORPO }), { ...center, spacing: { after: 40 } }),
    para(tx(`${contact.linkedin}   |   ${contact.github}`, { size: SZ_CORPO }), { ...center, spacing: { after: 40 } }),
    para(tx(`Portfólio: ${contact.portfolio}`, { size: SZ_CORPO }), { ...center, spacing: { after: 220 } }),
  ];
}

function summaryBlock(profile: string): Paragraph[] {
  return [sectionHeader('Resumo Profissional'), body(profile)];
}

function experienceBlock(experiencias: EnrichedExperience[]): Paragraph[] {
  const children: Paragraph[] = [sectionHeader('Experiência Profissional')];

  experiencias.forEach((exp, idx) => {
    if (idx > 0) children.push(gap(160));

    children.push(new Paragraph({
      children: [
        tx(exp.empresa, { bold: true, size: SZ_CORPO }),
        tx(`  \u2013  ${exp.cargo}`, { bold: true, size: SZ_CORPO }),
      ],
      spacing: { before: 80, after: 40, ...SPACELINE },
    }));

    children.push(new Paragraph({
      children: [
        tx(`${exp.periodo}  |  Stack: `, { italics: true, size: SZ_DETALHE, color: '555555' }),
        tx(exp.stack, { size: SZ_DETALHE, color: '555555' }),
      ],
      spacing: { after: 80, ...SPACELINE },
    }));

    exp.atividades.forEach((a) => children.push(bulletItem(a)));

    if (exp.resultados.length > 0) {
      children.push(new Paragraph({
        children: [tx('Resultados Relevantes:', { bold: true, size: SZ_CORPO })],
        spacing: { before: 80, after: 40, ...SPACELINE },
        indent: { left: 360 },
      }));
      exp.resultados.forEach((r) =>
        children.push(new Paragraph({
          children: [tx(`\u2713  ${r}`, { size: SZ_CORPO, color: '1a6611' })],
          indent: { left: 360 },
          spacing: { after: 40, ...SPACELINE },
        })),
      );
    }
  });

  return children;
}

function projectsBlock(projetos: RenderProject[]): Paragraph[] {
  if (projetos.length === 0) return [];
  const children: Paragraph[] = [sectionHeader('Projetos')];

  projetos.forEach((proj, idx) => {
    if (idx > 0) children.push(gap(120));

    children.push(new Paragraph({
      children: [tx(proj.name, { bold: true, size: SZ_CORPO })],
      spacing: { before: 60, after: 20, ...SPACELINE },
    }));

    if (proj.stack) {
      children.push(new Paragraph({
        children: [tx(`Stack: ${proj.stack}`, { italics: true, size: SZ_DETALHE, color: '555555' })],
        spacing: { after: 40, ...SPACELINE },
      }));
    }
    if (proj.description) children.push(bulletItem(proj.description));
    proj.highlights.forEach((h) => children.push(bulletItem(h)));
  });

  return children;
}

function educationBlock(formacao: string[]): Paragraph[] {
  return [sectionHeader('Formação Acadêmica'), ...formacao.map(bulletItem)];
}

function skillsBlock(skills: Record<string, string[]>): Paragraph[] {
  const children: Paragraph[] = [sectionHeader('Habilidades Técnicas')];
  for (const [category, items] of Object.entries(skills)) {
    children.push(new Paragraph({
      children: [
        tx(`${category}: `, { bold: true, size: SZ_CORPO }),
        tx(items.join('  |  '), { size: SZ_CORPO }),
      ],
      spacing: { after: 60, ...SPACELINE },
    }));
  }
  return children;
}

function languagesBlock(idiomas: string[]): Paragraph[] {
  return [sectionHeader('Idiomas'), ...idiomas.map(bulletItem)];
}

// ── Renderer ──────────────────────────────────────────────────────────────────
export class DocxResumeRenderer implements IResumeRenderer {
  readonly extension = '.docx';

  async render(payload: RenderPayload): Promise<Buffer> {
    const { contact, title, profile, skills, experiencias, projetos } = payload;

    const children = [
      ...contactBlock(contact, title),
      ...(profile ? summaryBlock(profile) : []),
      ...(experiencias.length > 0 ? experienceBlock(experiencias) : []),
      ...projectsBlock(projetos),
      ...skillsBlock(skills),
      ...(contact.formacao.length > 0 ? educationBlock(contact.formacao) : []),
      ...(contact.idiomas.length > 0 ? languagesBlock(contact.idiomas) : []),
    ];

    const doc = new Document({
      creator: contact.nome,
      title: `${title} – ${contact.nome}`,
      description: `Resume of ${contact.nome} – ${title}`,
      subject: title,
      keywords: Object.values(skills).flat().join(', '),
      styles: {
        default: {
          document: {
            run: { font: FONT, size: SZ_CORPO },
            paragraph: { spacing: SPACELINE },
          },
        },
      },
      sections: [{
        properties: {
          page: {
            margin: {
              top: MARGIN_TWIPS,
              right: MARGIN_TWIPS,
              bottom: MARGIN_TWIPS,
              left: MARGIN_TWIPS,
            },
          },
        },
        children,
      }],
    });

    return Packer.toBuffer(doc);
  }
}
