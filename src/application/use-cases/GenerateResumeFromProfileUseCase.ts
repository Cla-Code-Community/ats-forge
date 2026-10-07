import { NormalizedProfile } from '../../domain/entities/NormalizedProfile';
import { AtsReport } from '../../domain/services/AtsAnalyzer';
import { mapProfileToRenderPayload } from '../../domain/services/ProfileMapper';
import { ResumeOptimizer } from '../../domain/services/ResumeOptimizer';
import { ResumeTailor } from '../../domain/services/ResumeTailor';
import { SummaryWriter } from '../../domain/services/SummaryWriter';
import { RenderPayload } from '../../domain/interfaces/IResumeRenderer';
import { GitHubEnricher } from '../../infrastructure/enrichment/GitHubEnricher';
import { createRenderer } from '../../infrastructure/renderers/RendererFactory';
import { GenerateFromProfileInput } from '../dtos/GenerateFromProfileInput';

export interface GenerateResumeResult {
  content: Buffer | string;
  filename: string;
  contentType: string;
  extension: string;
  atsReport: AtsReport;
  warnings: string[];
  sourcesUsed: string[];
}

/** Structured, sanitized resume for on-screen preview (ATS-safe, single column). */
export interface ResumePreview {
  name: string;
  title: string;
  summary: string;
  contact: { email: string; phone: string; portfolio: string };
  links: { linkedin: string; github: string };
  skills: Record<string, string[]>;
  experience: RenderPayload['experiencias'];
  projects: RenderPayload['projetos'];
  education: string[];
  languages: string[];
}

export interface AnalyzeResult {
  resume: ResumePreview;
  atsReport: AtsReport;
  warnings: string[];
  sourcesUsed: string[];
  job: { title: string | null; hasDescription: boolean };
}

interface PreparedResume {
  profile: NormalizedProfile;
  atsReport: AtsReport;
  warnings: string[];
  sourcesUsed: string[];
}

/**
 * Orchestrates resume generation from a normalized profile, with no file I/O in
 * the preparation stage: enrich (GitHub/LinkedIn) → optimize (ATS) → tailor to
 * the job. `execute` renders a file; `analyze` returns a structured preview.
 */
export class GenerateResumeFromProfileUseCase {
  constructor(
    private readonly optimizer: ResumeOptimizer = new ResumeOptimizer(),
    private readonly tailor: ResumeTailor = new ResumeTailor(),
    private readonly enricher: GitHubEnricher = new GitHubEnricher(),
    private readonly summaryWriter: SummaryWriter = new SummaryWriter(),
  ) {}

  private async prepare(input: GenerateFromProfileInput): Promise<PreparedResume> {
    const { profile, warnings, sourcesUsed } = await this.enricher.enrich(
      input.profile,
      input.sources ?? undefined,
    );

    // When the candidate provides an "about" (e.g. their LinkedIn "Sobre"), write
    // a short, job-tailored summary from it. Otherwise keep what we have and let
    // the optimizer generate one from evidence.
    const withSummary =
      input.about && input.about.trim()
        ? { ...profile, summary: this.summaryWriter.write(profile, input.job, input.about) }
        : profile;

    const { profile: optimized, report: atsReport } = this.optimizer.optimize(
      withSummary,
      input.job,
    );
    const tailored = this.tailor.tailor(optimized, input.job);
    return { profile: tailored, atsReport, warnings, sourcesUsed };
  }

  async execute(input: GenerateFromProfileInput): Promise<GenerateResumeResult> {
    const { profile, atsReport, warnings, sourcesUsed } = await this.prepare(input);

    const payload = mapProfileToRenderPayload(profile, input.job, atsReport.matchedKeywords);
    const { renderer, contentType, extension } = createRenderer(input.format);
    const content = await renderer.render(payload);
    // Filename = candidate name + job title (spec: "nome do usuário + nome da vaga").
    const defaultName = [profile.name, input.job?.title].filter((p) => p && p.trim()).join(' ');
    const baseName = sanitizeFilename(input.filename ?? (defaultName || 'curriculo'));

    return {
      content,
      filename: `${baseName}${extension}`,
      contentType,
      extension,
      atsReport,
      warnings,
      sourcesUsed,
    };
  }

  async analyze(input: GenerateFromProfileInput): Promise<AnalyzeResult> {
    const { profile, atsReport, warnings, sourcesUsed } = await this.prepare(input);
    const p = mapProfileToRenderPayload(profile, input.job, atsReport.matchedKeywords);

    return {
      resume: {
        name: p.contact.nome,
        title: p.title,
        summary: p.profile,
        contact: { email: p.contact.email, phone: p.contact.telefone, portfolio: p.contact.portfolio },
        links: { linkedin: p.contact.linkedin, github: p.contact.github },
        skills: p.skills,
        experience: p.experiencias,
        projects: p.projetos,
        education: p.contact.formacao,
        languages: p.contact.idiomas,
      },
      atsReport,
      warnings,
      sourcesUsed,
      job: {
        title: input.job?.title?.trim() || null,
        hasDescription: Boolean(input.job?.description?.trim()),
      },
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
