import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import { apiKeyAuth } from './apiKeyAuth';
import { analyzeResumeHandler, generateResumeHandler } from './resumeController';

export interface ServerOptions {
  apiKey?: string;
  /** Allowed origin(s) for CORS. Defaults to reflecting the request origin. */
  corsOrigin?: string | string[] | boolean;
  /** Max JSON body size. Job descriptions can be long. */
  jsonLimit?: string;
}

/**
 * Builds the ATS Forge HTTP app (resume-generation microservice). Kept as a
 * factory with no side effects so it can be imported directly by tests.
 */
export function createServer(options: ServerOptions = {}) {
  const app = express();

  app.disable('x-powered-by');
  app.use(cors({ origin: options.corsOrigin ?? true }));
  app.use(express.json({ limit: options.jsonLimit ?? '1mb' }));

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ ok: true, service: 'ats-forge', ts: new Date().toISOString() });
  });

  app.post('/resumes/generate', apiKeyAuth(options.apiKey), (req, res, next) => {
    generateResumeHandler(req, res).catch(next);
  });

  app.post('/resumes/analyze', apiKeyAuth(options.apiKey), (req, res, next) => {
    analyzeResumeHandler(req, res).catch(next);
  });

  // Fallback 404
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Rota não encontrada.' });
  });

  // Centralized error handler
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    // eslint-disable-next-line no-console
    console.error('[ats-forge] erro não tratado:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Erro ao gerar currículo.' });
  });

  return app;
}
