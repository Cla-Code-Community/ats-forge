import { z } from 'zod';

const dataSource = z.enum(['github', 'linkedin', 'candidate', 'manual']);

const contactSchema = z.object({
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(40).optional(),
  location: z.string().max(120).optional(),
  website: z.string().max(300).optional(),
});

const linkSchema = z.object({
  type: z.string().min(1).max(40),
  url: z.string().max(500),
  label: z.string().max(120).optional(),
});

const experienceSchema = z.object({
  company: z.string().min(1).max(200),
  role: z.string().min(1).max(200),
  period: z.string().max(100).optional(),
  startDate: z.string().max(40).optional(),
  endDate: z.string().max(40).optional(),
  current: z.boolean().optional(),
  stack: z.array(z.string().max(80)).max(60).optional(),
  highlights: z.array(z.string().max(1000)).max(40).optional(),
  results: z.array(z.string().max(1000)).max(40).optional(),
  source: dataSource.optional(),
});

const educationSchema = z.object({
  institution: z.string().min(1).max(200),
  degree: z.string().max(200).optional(),
  field: z.string().max(200).optional(),
  period: z.string().max(100).optional(),
  source: dataSource.optional(),
});

const skillSchema = z.object({
  name: z.string().min(1).max(80),
  years: z.number().min(0).max(70).optional(),
  category: z.string().max(80).optional(),
  source: dataSource.optional(),
});

const projectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  url: z.string().max(500).optional(),
  stack: z.array(z.string().max(80)).max(60).optional(),
  highlights: z.array(z.string().max(1000)).max(40).optional(),
  source: dataSource.optional(),
});

const languageSchema = z.object({
  name: z.string().min(1).max(80),
  level: z.string().max(80).optional(),
});

export const normalizedProfileSchema = z.object({
  name: z.string().min(1).max(200),
  headline: z.string().max(200).optional(),
  summary: z.string().max(4000).optional(),
  contact: contactSchema.default({}),
  experience: z.array(experienceSchema).max(60).default([]),
  education: z.array(educationSchema).max(40).default([]),
  skills: z.array(skillSchema).max(200).default([]),
  projects: z.array(projectSchema).max(60).default([]),
  links: z.array(linkSchema).max(40).default([]),
  languages: z.array(languageSchema).max(20).default([]),
});

export const jobTargetSchema = z.object({
  title: z.string().max(200).optional(),
  description: z.string().max(20000).optional(),
  url: z.string().max(500).optional(),
  language: z.string().max(10).optional(),
  seniority: z.string().max(60).optional(),
});

export const sourcesSchema = z.object({
  github: z.string().max(300).optional(),
  linkedin: z.string().max(300).optional(),
});

export const generateResumeSchema = z.object({
  profile: normalizedProfileSchema,
  job: jobTargetSchema.nullish(),
  sources: sourcesSchema.nullish(),
  format: z.enum(['docx', 'pdf', 'md']).default('docx'),
  filename: z.string().max(120).optional(),
});

export type GenerateResumeBody = z.infer<typeof generateResumeSchema>;
