
export type DataSource = 'github' | 'linkedin' | 'candidate' | 'manual';

export interface NormalizedContact {
  email?: string;
  phone?: string;
  location?: string;
  website?: string;
}

export interface NormalizedLink {
  type: string;
  url: string;
  label?: string;
}

export interface NormalizedExperience {
  company: string;
  role: string;
  period?: string;
  startDate?: string;
  endDate?: string;
  current?: boolean;
  stack?: string[];
  highlights?: string[];
  results?: string[];
  source?: DataSource;
}

export interface NormalizedEducation {
  institution: string;
  degree?: string;
  field?: string;
  period?: string;
  source?: DataSource;
}

export interface NormalizedSkill {
  name: string;
  years?: number;
  category?: string;
  source?: DataSource;
}

export interface NormalizedProject {
  name: string;
  description?: string;
  url?: string;
  stack?: string[];
  highlights?: string[];
  source?: DataSource;
}

export interface NormalizedLanguage {
  name: string;
  /** e.g. "Nativo", "Fluente", "Intermediário". */
  level?: string;
}

export interface NormalizedProfile {
  name: string;
  /** Short professional title/headline, e.g. "Engenheiro de Software Backend". */
  headline?: string;
  /** Professional summary. May be rewritten/reorganized by the engine, never invented. */
  summary?: string;
  contact: NormalizedContact;
  experience: NormalizedExperience[];
  education: NormalizedEducation[];
  skills: NormalizedSkill[];
  projects: NormalizedProject[];
  links: NormalizedLink[];
  languages: NormalizedLanguage[];
}

/** The vacancy the resume is being tailored to (optional). */
export interface JobTarget {
  title?: string;
  description?: string;
  url?: string;
  /** Target language of the resume, e.g. "pt", "en". */
  language?: string;
  seniority?: string;
}
