import { AtsReport } from '../../domain/services/AtsAnalyzer';
import { mapProfileToRenderPayload } from '../../domain/services/ProfileMapper';
import { ResumeOptimizer } from '../../domain/services/ResumeOptimizer';
import { GitHubEnricher } from '../../infrastructure/enrichment/GitHubEnricher';
import { createRenderer } from '../../infrastructure/renderers/RendererFactory';
import { GenerateFromProfileInput } from '../dtos/GenerateFromProfileInput';

export interface GenerateResumeResult {
  /** Rendered document — Buffer for docx/pdf, string for markdown. */
  content: Buffer | string;
  filename: string;
  contentType: string;
  extension: string;
  atsReport: AtsReport;
  /** Non-fatal warnings (e.g. a GitHub import that failed). */
  warnings: string[];
}

/**
 * Orchestrates resume generation from a normalized profile, with no file I/O:
 * analyze the job → score → map profile to payload → render in the chosen
 * format. Returns the document in memory so an HTTP layer can stream it.
 */
export class GenerateResumeFromProfileUseCase {
  constructor(
    private readonly optimizer: ResumeOptimizer = new ResumeOptimizer(),
    private readonly enricher: GitHubEnricher = new GitHubEnricher(),
  ) {}

  async execute(input: GenerateFromProfileInput): Promise<GenerateResumeResult> {
    // 1) Enrich with public GitHub data (profile + repo READMEs) + LinkedIn link.
    const { profile, warnings } = await this.enricher.enrich(
      input.profile,
      input.sources ?? undefined,
    );

    // 2) Iteratively optimize toward the ATS pass threshold (evidence-based only).
    const { profile: optimized, report: atsReport } = this.optimizer.optimize(
      profile,
      input.job,
    );

    // 3) Map to the render payload and render in the requested format.
    const payload = mapProfileToRenderPayload(optimized, input.job, atsReport.matchedKeywords);

    const { renderer, contentType, extension } = createRenderer(input.format);
    const content = await renderer.render(payload);

    const baseName = sanitizeFilename(input.filename ?? optimized.name ?? 'curriculo');

    return {
      content,
      filename: `${baseName}${extension}`,
      contentType,
      extension,
      atsReport,
      warnings,
    };
  }
}

function sanitizeFilename(name: string): string {
  const cleaned = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || 'curriculo';
}
