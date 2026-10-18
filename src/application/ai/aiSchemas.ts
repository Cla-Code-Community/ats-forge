import { z } from 'zod';
import { JsonSchema } from '../../domain/interfaces/IAIProvider';

export const jobAnalysisAiSchema = z.object({
  role: z.string(),
  seniority: z.string().nullable(),
  responsibilities: z.array(z.string()),
  requiredSkills: z.array(z.string()),
  preferredSkills: z.array(z.string()),
  keywords: z.array(z.string()),
  technicalContext: z.string(),
});

export type JobAnalysisAI = z.infer<typeof jobAnalysisAiSchema>;

export const jobAnalysisJsonSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    role: { type: 'string', description: 'Cargo/título pretendido pela vaga.' },
    seniority: { type: ['string', 'null'], description: 'Senioridade (Júnior/Pleno/Sênior/etc.) ou null.' },
    responsibilities: { type: 'array', items: { type: 'string' }, description: 'Principais responsabilidades.' },
    requiredSkills: { type: 'array', items: { type: 'string' }, description: 'Requisitos OBRIGATÓRIOS.' },
    preferredSkills: { type: 'array', items: { type: 'string' }, description: 'Requisitos DESEJÁVEIS.' },
    keywords: { type: 'array', items: { type: 'string' }, description: 'Palavras-chave relevantes.' },
    technicalContext: { type: 'string', description: 'Contexto técnico resumido da posição.' },
  },
  required: ['role', 'seniority', 'responsibilities', 'requiredSkills', 'preferredSkills', 'keywords', 'technicalContext'],
};

const sectionRewriteSchema = z.object({
  index: z.number().int().min(0),
  highlights: z.array(z.string()),
});

export const enhancedContentAiSchema = z.object({
  summary: z.string(),
  experiences: z.array(sectionRewriteSchema),
  projects: z.array(sectionRewriteSchema),
});

export type EnhancedContentAI = z.infer<typeof enhancedContentAiSchema>;
export type SectionRewrite = z.infer<typeof sectionRewriteSchema>;

const sectionRewriteJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    index: { type: 'integer', description: 'Índice (0-based) do item na lista original enviada.' },
    highlights: { type: 'array', items: { type: 'string' }, description: 'Bullets reescritos para o MESMO item.' },
  },
  required: ['index', 'highlights'],
};

export const enhancedContentJsonSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: { type: 'string', description: 'Resumo profissional direcionado à vaga (2-4 linhas).' },
    experiences: { type: 'array', items: sectionRewriteJsonSchema },
    projects: { type: 'array', items: sectionRewriteJsonSchema },
  },
  required: ['summary', 'experiences', 'projects'],
};
