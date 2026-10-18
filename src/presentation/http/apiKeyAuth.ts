import { NextFunction, Request, Response } from 'express';

/**
 * Service-to-service auth. The candidate backend (the only caller) must send the
 * shared secret in the `x-api-key` header. If no key is configured the guard is
 * disabled (useful for local development / tests), and a warning is logged once.
 */
export function apiKeyAuth(expectedKey: string | undefined) {
  let warned = false;
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!expectedKey) {
      if (!warned) {
        // eslint-disable-next-line no-console
        console.warn('[ats-forge] ATS_FORGE_API_KEY não definido — autenticação desabilitada.');
        warned = true;
      }
      next();
      return;
    }

    const provided = req.header('x-api-key');
    if (!provided || provided !== expectedKey) {
      res.status(401).json({ code: 'UNAUTHORIZED', message: 'API key inválida ou ausente.' });
      return;
    }
    next();
  };
}
