/** Public programmatic API of ATS Forge (resume-generation engine). */

export * from './domain/entities/NormalizedProfile';
export { AtsAnalyzer } from './domain/services/AtsAnalyzer';
export type {
  AtsReport,
  AtsScoreBreakdown,
  AtsStatus,
  JobAnalysis,
} from './domain/services/AtsAnalyzer';
export { ResumeOptimizer } from './domain/services/ResumeOptimizer';
export type { OptimizationResult } from './domain/services/ResumeOptimizer';
export { ResumeTailor } from './domain/services/ResumeTailor';
export { SummaryWriter } from './domain/services/SummaryWriter';
export { sanitizeText, humanizeName } from './domain/services/TextSanitizer';
export {
  categoryOf,
  extractTechnologies,
  normalizeTech,
  normalizeTechList,
} from './domain/services/TechTaxonomy';
export type { TechCategory } from './domain/services/TechTaxonomy';
export { extractKeywordsFromText } from './domain/services/KeywordExtractor';
export { focusJobDescription } from './domain/services/JobDescriptionFocus';
export { parseReadmeExperiences } from './domain/services/GithubReadmeExperienceParser';
export { mapProfileToRenderPayload } from './domain/services/ProfileMapper';

export { GenerateResumeFromProfileUseCase } from './application/use-cases/GenerateResumeFromProfileUseCase';
export type {
  GenerateResumeResult,
  AnalyzeResult,
  ResumePreview,
} from './application/use-cases/GenerateResumeFromProfileUseCase';
export type {
  GenerateFromProfileInput,
  ResumeFormat,
} from './application/dtos/GenerateFromProfileInput';

export { GitHubEnricher, parseGitHubUsername } from './infrastructure/enrichment/GitHubEnricher';
export type { EnrichmentSources, EnrichmentResult } from './infrastructure/enrichment/GitHubEnricher';
export { createRenderer } from './infrastructure/renderers/RendererFactory';
export { createServer } from './presentation/http/createServer';
export type { ServerOptions } from './presentation/http/createServer';

export type {
  AIProvider,
  AICompletionRequest,
  AIErrorKind,
  JsonSchema,
} from './domain/interfaces/IAIProvider';
export { AIProviderError } from './domain/interfaces/IAIProvider';
export { ResumeAIService } from './application/ai/ResumeAIService';
export type { ResumeEnhancementResult } from './application/ai/ResumeAIService';
export { JobAnalysisService } from './application/ai/JobAnalysisService';
export { ResumeContentValidator } from './application/ai/ResumeContentValidator';
export { loadAIConfig, AI_DEFAULTS } from './infrastructure/ai/aiConfig';
export type { AIConfig, AIProviderName } from './infrastructure/ai/aiConfig';
export { AIProviderFactory, FallbackAIProvider } from './infrastructure/ai/AIProviderFactory';
export { OpenAIProvider } from './infrastructure/ai/OpenAIProvider';
export { GeminiProvider } from './infrastructure/ai/GeminiProvider';
export {
  createResumeAIService,
  buildResumeAIService,
} from './infrastructure/ai/createResumeAIService';
export { setAiLogSink } from './infrastructure/ai/aiLogger';
