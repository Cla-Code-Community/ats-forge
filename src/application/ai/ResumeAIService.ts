import { JobTarget, NormalizedProfile } from '../../domain/entities/NormalizedProfile';
import { AIProvider, AIProviderError } from '../../domain/interfaces/IAIProvider';
import { AtsAnalyzer } from '../../domain/services/AtsAnalyzer';
import { focusJobDescription } from '../../domain/services/JobDescriptionFocus';
import { ResumeContentValidator } from './ResumeContentValidator';
import {
  EnhancedContentAI,
  JobAnalysisAI,
  enhancedContentAiSchema,
  enhancedContentJsonSchema,
} from './aiSchemas';
import {
  RESUME_SYSTEM_PROMPT,
  buildContentUserPrompt,
  projectProfileForPrompt,
} from './prompts';

export interface ResumeEnhancementResult {
  profile: NormalizedProfile;
  warnings: string[];
  applied: boolean;
}

export interface ResumeAIServiceOptions {
  maxInputChars: number;
  temperature: number;
  /** Hard upper bound for the whole AI step; on timeout it degrades to deterministic. */
  deadlineMs?: number;
}

function withDeadline<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new AIProviderError('timeout', 'Deadline da geração por IA excedido.', 'ai', false)),
      ms,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export class ResumeAIService {
  constructor(
    private readonly provider: AIProvider,
    private readonly options: ResumeAIServiceOptions,
    private readonly validator: ResumeContentValidator = new ResumeContentValidator(),
    private readonly analyzer: AtsAnalyzer = new AtsAnalyzer(),
  ) {}

  get providerName(): string {
    return this.provider.name;
  }

  async enhance(
    profile: NormalizedProfile,
    job: JobTarget | null | undefined,
    about?: string | null,
    signal?: AbortSignal,
  ): Promise<ResumeEnhancementResult> {
    const warnings: string[] = [];
    const analysis = this.buildJobAnalysis(job);

    let content: EnhancedContentAI;
    try {
      const projection = projectProfileForPrompt(profile, about, this.options.maxInputChars);
      const call = this.provider.generateJson({
        system: RESUME_SYSTEM_PROMPT,
        user: buildContentUserPrompt(projection, analysis, this.options.maxInputChars),
        schema: enhancedContentJsonSchema,
        schemaName: 'resume_content',
        temperature: this.options.temperature,
        signal,
      });
      const raw = this.options.deadlineMs
        ? await withDeadline(call, this.options.deadlineMs)
        : await call;
      content = enhancedContentAiSchema.parse(raw);
    } catch (err) {
      warnings.push(`Geração de conteúdo por IA indisponível (${describe(err)}); mantido o conteúdo determinístico.`);
      return { profile, warnings, applied: false };
    }

    const result = this.validator.reconcile(profile, content, about);
    warnings.push(...result.warnings);
    const applied = result.acceptedSummary || result.rewrittenExperiences > 0 || result.rewrittenProjects > 0;

    return { profile: result.profile, warnings, applied };
  }

  private buildJobAnalysis(job: JobTarget | null | undefined): JobAnalysisAI | null {
    if (!job?.description?.trim() && !job?.title?.trim()) return null;

    const focused: JobTarget = { ...job, description: focusJobDescription(job.description) };
    const analysis = this.analyzer.analyzeJob(focused);
    const requirements = analysis.jobDetails.requirements;

    const techByPriority = (priority: 'required' | 'preferred'): string[] =>
      unique(
        requirements
          .filter((requirement) => requirement.priority === priority)
          .flatMap((requirement) => requirement.technologies),
      );

    const required = techByPriority('required');
    const preferred = techByPriority('preferred');
    const responsibilities = unique(
      requirements
        .filter((requirement) => requirement.category === 'responsibility')
        .map((requirement) => requirement.text.trim())
        .filter(Boolean),
    ).slice(0, 10);

    return {
      role: (job?.title ?? analysis.title ?? '').trim(),
      seniority: analysis.seniority,
      responsibilities,
      requiredSkills: (required.length > 0 ? required : analysis.hardSkills).slice(0, 20),
      preferredSkills: preferred.slice(0, 20),
      keywords: analysis.keywords.slice(0, 30),
      technicalContext: '',
    };
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function describe(err: unknown): string {
  if (err instanceof AIProviderError) return err.kind;
  if (err && typeof err === 'object' && 'name' in err) return String((err as { name: unknown }).name);
  return 'erro';
}
