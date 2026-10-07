import { IResumeRenderer } from '../../domain/interfaces/IResumeRenderer';
import { ResumeFormat } from '../../application/dtos/GenerateFromProfileInput';
import { DocxResumeRenderer } from './DocxResumeRenderer';
import { MarkdownResumeRenderer } from './MarkdownResumeRenderer';
import { PdfResumeRenderer } from './PdfResumeRenderer';

export interface RendererInfo {
  renderer: IResumeRenderer;
  contentType: string;
  extension: string;
}

const CONTENT_TYPES: Record<ResumeFormat, string> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pdf: 'application/pdf',
  md: 'text/markdown; charset=utf-8',
};

export function createRenderer(format: ResumeFormat): RendererInfo {
  switch (format) {
    case 'pdf':
      return { renderer: new PdfResumeRenderer(), contentType: CONTENT_TYPES.pdf, extension: '.pdf' };
    case 'md':
      return {
        renderer: new MarkdownResumeRenderer(),
        contentType: CONTENT_TYPES.md,
        extension: '.md',
      };
    case 'docx':
    default:
      return {
        renderer: new DocxResumeRenderer(),
        contentType: CONTENT_TYPES.docx,
        extension: '.docx',
      };
  }
}
