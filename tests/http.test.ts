import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createServer } from '../src/presentation/http/createServer';
import { fullProfile } from './fixtures';

describe('HTTP /resumes/generate', () => {
  it('GET /health retorna ok', async () => {
    const app = createServer();
    const res = await request(app).get('/health').expect(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.service).toBe('ats-forge');
  });

  it('gera DOCX e expõe o ATS score nos headers', async () => {
    const app = createServer();
    const res = await request(app)
      .post('/resumes/generate')
      .send({ profile: fullProfile(), job: { description: 'Node.js' }, format: 'docx' })
      .expect(200);

    expect(res.headers['content-type']).toContain('wordprocessingml');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(Number(res.headers['x-ats-score'])).toBeGreaterThanOrEqual(0);
    expect(res.headers['x-ats-report']).toBeDefined();
  });

  it('gera PDF com assinatura válida', async () => {
    const app = createServer();
    const res = await request(app)
      .post('/resumes/generate')
      .send({ profile: fullProfile(), format: 'pdf' })
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);

    expect((res.body as Buffer).subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('retorna 400 para perfil inválido', async () => {
    const app = createServer();
    const res = await request(app)
      .post('/resumes/generate')
      .send({ profile: { contact: {} }, format: 'docx' })
      .expect(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('POST /resumes/analyze retorna preview + ats + sourcesUsed', async () => {
    const app = createServer();
    const res = await request(app)
      .post('/resumes/analyze')
      .send({ profile: fullProfile(), job: { title: 'Backend', description: 'node.js typescript' }, format: 'pdf' })
      .expect(200);

    expect(res.body.resume).toBeDefined();
    expect(res.body.resume.name).toBe('Ana Souza');
    expect(res.body.resume.skills).toBeTypeOf('object');
    expect(res.body.atsReport.score).toBeGreaterThanOrEqual(0);
    expect(res.body.sourcesUsed).toContain('candidate');
    expect(res.body.job).toEqual({ title: 'Backend', hasDescription: true });
  });

  it('POST /resumes/analyze valida o corpo (400)', async () => {
    const app = createServer();
    const res = await request(app)
      .post('/resumes/analyze')
      .send({ profile: { contact: {} } })
      .expect(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('exige API key quando configurada', async () => {
    const app = createServer({ apiKey: 'segredo' });

    await request(app)
      .post('/resumes/generate')
      .send({ profile: fullProfile(), format: 'docx' })
      .expect(401);

    await request(app)
      .post('/resumes/generate')
      .set('x-api-key', 'segredo')
      .send({ profile: fullProfile(), format: 'docx' })
      .expect(200);
  });
});
