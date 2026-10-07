import { Request, Response } from 'express';
import { ZodError } from 'zod';
import { GenerateResumeFromProfileUseCase } from '../../application/use-cases/GenerateResumeFromProfileUseCase';
import { generateResumeSchema } from './validation';

const useCase = new GenerateResumeFromProfileUseCase();

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

  const result = await useCase.analyze({
    profile: body.profile,
    job: body.job ?? null,
    sources: body.sources ?? null,
    about: body.about ?? null,
    format: body.format,
    filename: body.filename,
  });

  res.status(200).json(result);
}
