import { createServer } from './presentation/http/createServer';

const port = Number(process.env.PORT ?? process.env.ATS_FORGE_PORT ?? 8089);
const apiKey = process.env.ATS_FORGE_API_KEY?.trim() || undefined;

const app = createServer({ apiKey });

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`[ats-forge] serviço de currículos ouvindo em http://localhost:${port}`);
});
