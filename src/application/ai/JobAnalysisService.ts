import { JobTarget } from '../../domain/entities/NormalizedProfile';
import { AIProvider } from '../../domain/interfaces/IAIProvider';
import { focusJobDescription } from '../../domain/services/JobDescriptionFocus';
import { JobAnalysisAI, jobAnalysisAiSchema, jobAnalysisJsonSchema } from './aiSchemas';
import { RESUME_SYSTEM_PROMPT, buildJobAnalysisUserPrompt } from './prompts';

export class JobAnalysisService {
  constructor(
    private readonly provider: AIProvider,
    private readonly maxInputChars: number,
    private readonly temperature: number,
  ) {}

  async analyze(job: JobTarget | null | undefined, signal?: AbortSignal): Promise<JobAnalysisAI | null> {
    if (!job?.description?.trim() && !job?.title?.trim()) return null;

    const focused: JobTarget = { ...job, description: focusJobDescription(job.description) };

    const raw = await this.provider.generateJson({
      system: RESUME_SYSTEM_PROMPT,
      user: buildJobAnalysisUserPrompt(focused, this.maxInputChars),
      schema: jobAnalysisJsonSchema,
      schemaName: 'job_analysis',
      temperature: this.temperature,
      signal,
    });

    return jobAnalysisAiSchema.parse(raw);
  }
}
