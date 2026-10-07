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
