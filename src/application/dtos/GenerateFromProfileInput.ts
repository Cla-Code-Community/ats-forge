import { JobTarget, NormalizedProfile } from '../../domain/entities/NormalizedProfile';
import { EnrichmentSources } from '../../infrastructure/enrichment/GitHubEnricher';

export type ResumeFormat = 'docx' | 'pdf' | 'md';

export interface GenerateFromProfileInput {
  profile: NormalizedProfile;
  job?: JobTarget | null;
  format: ResumeFormat;
  /** Public GitHub/LinkedIn links to enrich the profile from. */
  sources?: EnrichmentSources | null;
  /** Optional base filename (without extension). Defaults to the candidate name. */
  filename?: string;
}
