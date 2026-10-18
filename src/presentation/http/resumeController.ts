import { Request, Response } from 'express';
import { ZodError } from 'zod';
import { GenerateResumeFromProfileUseCase } from '../../application/use-cases/GenerateResumeFromProfileUseCase';
import { RenderPayload } from '../../domain/interfaces/IResumeRenderer';
import { createResumeAIService } from '../../infrastructure/ai/createResumeAIService';
import { createRenderer } from '../../infrastructure/renderers/RendererFactory';
import { generateResumeSchema, renderResumeSchema } from './validation';

const useCase = new GenerateResumeFromProfileUseCase(
  undefined,
  undefined,
  undefined,
  undefined,
  createResumeAIService(),
);

/**
 * POST /resumes/generate
 *
 * Receives a normalized profile + optional job, returns the rendered resume as a
 * binary/text body. The ATS analysis travels in response headers so the caller
 * can surface the score without parsing the document:
 *   - X-Ats-Score:   final 0-100 score
 *   - X-Ats-Report:  base64-encoded JSON of the full AtsReport
 */
export async function generateResumeHandler(req: Request, res: Response): Promise<void> {
  let body;
  try {
    body = generateResumeSchema.parse(req.body);
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Perfil normalizado inválido.',
        details: err.flatten().fieldErrors,
      });
      return;
    }
    throw err;
  }

  const result = await useCase.execute({
    profile: body.profile,
    job: body.job ?? null,
    sources: body.sources ?? null,
    about: body.about ?? null,
    format: body.format,
    filename: body.filename,
  });

  const reportJson = JSON.stringify({
    ...result.atsReport,
    warnings: result.warnings,
    sourcesUsed: result.sourcesUsed,
  });
  res.setHeader('Content-Type', result.contentType);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${result.filename}"`,
  );
  res.setHeader('X-Ats-Score', String(result.atsReport.score));
  res.setHeader('X-Ats-Report', Buffer.from(reportJson, 'utf-8').toString('base64'));
  res.setHeader(
    'Access-Control-Expose-Headers',
    'X-Ats-Score, X-Ats-Report, Content-Disposition',
  );

  if (Buffer.isBuffer(result.content)) {
    res.status(200).send(result.content);
  } else {
    res.status(200).send(Buffer.from(result.content, 'utf-8'));
  }
}

/**
 * POST /resumes/analyze
 *
 * Same inputs as /generate, but returns a JSON preview (structured, sanitized,
 * ATS-safe resume) plus the ATS report and the sources used — for on-screen
 * preview without downloading a file.
 */
export async function analyzeResumeHandler(req: Request, res: Response): Promise<void> {
  let body;
  try {
    body = generateResumeSchema.parse(req.body);
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Perfil normalizado inválido.',
        details: err.flatten().fieldErrors,
      });
      return;
    }
    throw err;
  }

  const startedAt = Date.now();
  console.log(
    `[ats-forge] analyze recebido: skills=${body.profile.skills.length} jobChars=${body.job?.description?.length ?? 0} aboutChars=${body.about?.length ?? 0} github=${body.sources?.github ?? '-'}`,
  );
  const result = await useCase.analyze({
    profile: body.profile,
    job: body.job ?? null,
    sources: body.sources ?? null,
    about: body.about ?? null,
    format: body.format,
    filename: body.filename,
  });
  console.log(
    `[ats-forge] analyze concluído em ${Date.now() - startedAt}ms warnings=${result.warnings.length}`,
  );

  res.status(200).json(result);
}

/**
 * POST /resumes/render
 *
 * Renders an ALREADY-BUILT resume (the preview content produced by /analyze) to a
 * file. No AI, no enrichment, no scoring — just formatting. This is what the
 * download uses, so it is fast and deterministic (it saves exactly what the user
 * previewed).
 */
export async function renderResumeHandler(req: Request, res: Response): Promise<void> {
  let body;
  try {
    body = renderResumeSchema.parse(req.body);
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Conteúdo de currículo inválido.',
        details: err.flatten().fieldErrors,
      });
      return;
    }
    throw err;
  }

  const { resume } = body;
  const payload: RenderPayload = {
    contact: {
      nome: resume.name,
      email: resume.contact.email,
      telefone: resume.contact.phone,
      portfolio: resume.contact.portfolio,
      linkedin: resume.links.linkedin,
      github: resume.links.github,
      formacao: resume.education,
      idiomas: resume.languages,
    },
    focus: '',
    title: resume.title,
    profile: resume.summary,
    skills: resume.skills,
    experiencias: resume.experience,
    projetos: resume.projects,
    extraKeywords: [],
  };

  const { renderer, contentType, extension } = createRenderer(body.format);
  const content = await renderer.render(payload);
  const baseName = sanitizeFilename(body.filename ?? resume.name ?? 'curriculo');

  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${baseName}${extension}"`);
  if (body.atsScore !== null && body.atsScore !== undefined) {
    res.setHeader('X-Ats-Score', String(body.atsScore));
  }
  res.setHeader('Access-Control-Expose-Headers', 'X-Ats-Score, Content-Disposition');
  res.status(200).send(Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf-8'));
}

function sanitizeFilename(name: string): string {
  const cleaned = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || 'curriculo';
}
