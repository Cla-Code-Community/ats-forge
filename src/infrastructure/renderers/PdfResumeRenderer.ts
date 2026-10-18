import PDFDocument from 'pdfkit';
import { EnrichedExperience } from '../../domain/entities/EnrichedExperience';
import {
  IResumeRenderer,
  RenderPayload,
  RenderProject,
} from '../../domain/interfaces/IResumeRenderer';

/**
 * PDF renderer built for ATS parsing: a single column, real selectable text
 * (never an image), semantic section headers and simple bullet lists. No
 * tables, columns, icons or skill bars — exactly what ATS parsers read cleanly
 * (integration spec §12/§13).
 */

const FONT = 'Helvetica';
const FONT_BOLD = 'Helvetica-Bold';
const FONT_ITALIC = 'Helvetica-Oblique';
const COLOR_TEXT = '#1a1a1a';
const COLOR_MUTED = '#555555';
const COLOR_RULE = '#444444';
const COLOR_RESULT = '#1a6611';
const MARGIN = 56; // ~0.78in

export class PdfResumeRenderer implements IResumeRenderer {
  readonly extension = '.pdf';

  render(payload: RenderPayload): Promise<Buffer> {
    const { contact, title, profile, skills, experiencias } = payload;

    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
        info: {
          Title: `${title} – ${contact.nome}`,
          Author: contact.nome,
          Subject: title,
          Keywords: Object.values(skills).flat().join(', '),
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      try {
        this.drawHeader(doc, contact, title);
        this.drawSummary(doc, profile);
        if (experiencias.length > 0) this.drawExperience(doc, experiencias);
        this.drawProjects(doc, payload.projetos);
        this.drawSkills(doc, skills);
        this.drawEducation(doc, contact.formacao);
        this.drawLanguages(doc, contact.idiomas);
        doc.end();
      } catch (err) {
        reject(err as Error);
      }
    });
  }

  private sectionHeader(doc: PDFKit.PDFDocument, label: string): void {
    doc.moveDown(0.7);
    doc
      .font(FONT_BOLD)
      .fontSize(11)
      .fillColor(COLOR_TEXT)
      .text(label.toUpperCase());
    const y = doc.y + 2;
    doc
      .moveTo(doc.page.margins.left, y)
      .lineTo(doc.page.width - doc.page.margins.right, y)
      .lineWidth(0.75)
      .strokeColor(COLOR_RULE)
      .stroke();
    doc.moveDown(0.5);
  }

  private drawHeader(
    doc: PDFKit.PDFDocument,
    contact: RenderPayload['contact'],
    title: string,
  ): void {
    doc.font(FONT_BOLD).fontSize(20).fillColor(COLOR_TEXT).text(contact.nome.toUpperCase(), {
      align: 'center',
    });
    doc.font(FONT).fontSize(12).fillColor(COLOR_MUTED).text(title, { align: 'center' });
    doc.moveDown(0.3);

    const contactLine = [contact.email, contact.telefone].filter(Boolean).join('   |   ');
    const linksLine = [contact.linkedin, contact.github, contact.portfolio]
      .filter(Boolean)
      .join('   |   ');

    doc.font(FONT).fontSize(10).fillColor(COLOR_TEXT);
    if (contactLine) doc.text(contactLine, { align: 'center' });
    if (linksLine) doc.text(linksLine, { align: 'center' });
  }

  private drawSummary(doc: PDFKit.PDFDocument, profile: string): void {
    if (!profile.trim()) return;
    this.sectionHeader(doc, 'Resumo Profissional');
    doc.font(FONT).fontSize(10.5).fillColor(COLOR_TEXT).text(profile, { align: 'left' });
  }

  private drawExperience(doc: PDFKit.PDFDocument, experiencias: EnrichedExperience[]): void {
    if (experiencias.length === 0) return;
    this.sectionHeader(doc, 'Experiência Profissional');

    experiencias.forEach((exp, idx) => {
      if (idx > 0) doc.moveDown(0.5);

      doc
        .font(FONT_BOLD)
        .fontSize(10.5)
        .fillColor(COLOR_TEXT)
        .text(`${exp.empresa}${exp.cargo ? `  –  ${exp.cargo}` : ''}`);

      const meta = [exp.periodo, exp.stack ? `Stack: ${exp.stack}` : '']
        .filter(Boolean)
        .join('  |  ');
      if (meta) {
        doc.font(FONT_ITALIC).fontSize(9).fillColor(COLOR_MUTED).text(meta);
      }
      doc.moveDown(0.2);

      exp.atividades.forEach((a) => this.bullet(doc, a));

      if (exp.resultados.length > 0) {
        doc.moveDown(0.2);
        doc
          .font(FONT_BOLD)
          .fontSize(10)
          .fillColor(COLOR_TEXT)
          .text('Resultados:', { indent: 12 });
        exp.resultados.forEach((r) => this.bullet(doc, r, COLOR_RESULT));
      }
    });
  }

  private drawProjects(doc: PDFKit.PDFDocument, projetos: RenderProject[]): void {
    if (projetos.length === 0) return;
    this.sectionHeader(doc, 'Projetos');

    projetos.forEach((proj, idx) => {
      if (idx > 0) doc.moveDown(0.4);

      doc.font(FONT_BOLD).fontSize(10.5).fillColor(COLOR_TEXT).text(proj.name);
      if (proj.stack) {
        doc.font(FONT_ITALIC).fontSize(9).fillColor(COLOR_MUTED).text(`Stack: ${proj.stack}`);
      }
      doc.moveDown(0.1);
      if (proj.description) this.bullet(doc, proj.description);
      proj.highlights.forEach((h) => this.bullet(doc, h));
    });
  }

  private drawEducation(doc: PDFKit.PDFDocument, formacao: string[]): void {
    if (formacao.length === 0) return;
    this.sectionHeader(doc, 'Formação Acadêmica');
    formacao.forEach((f) => this.bullet(doc, f));
  }

  private drawSkills(doc: PDFKit.PDFDocument, skills: Record<string, string[]>): void {
    const entries = Object.entries(skills);
    if (entries.length === 0) return;
    this.sectionHeader(doc, 'Habilidades Técnicas');
    for (const [category, items] of entries) {
      doc.fontSize(10).fillColor(COLOR_TEXT);
      doc
        .font(FONT_BOLD)
        .text(`${category}: `, { continued: true })
        .font(FONT)
        .text(items.join('  |  '));
    }
  }

  private drawLanguages(doc: PDFKit.PDFDocument, idiomas: string[]): void {
    if (idiomas.length === 0) return;
    this.sectionHeader(doc, 'Idiomas');
    idiomas.forEach((i) => this.bullet(doc, i));
  }

  private bullet(
    doc: PDFKit.PDFDocument,
    text: string,
    color: string = COLOR_TEXT,
    marker = '•',
  ): void {
    doc
      .font(FONT)
      .fontSize(10)
      .fillColor(color)
      .text(`${marker}  ${text}`, { indent: 12, align: 'left' });
  }
}
