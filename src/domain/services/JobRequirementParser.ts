import type { JobTarget } from '../entities/NormalizedProfile';
import { extractTechnologies } from './TechTaxonomy';

export type RequirementCategory =
  | 'required'
  | 'preferred'
  | 'responsibility'
  | 'education'
  | 'certification'
  | 'behavioral'
  | 'ambiguous';

export interface ParsedJobRequirement {
  text: string;
  category: RequirementCategory;
  priority: 'required' | 'preferred' | 'informational' | 'review';
  technologies: string[];
  reviewRequired: boolean;
}

export interface ParsedJobDescription {
  title: string | null;
  company: string | null;
  requirements: ParsedJobRequirement[];
}

type Section =
  | 'required'
  | 'preferred'
  | 'responsibility'
  | 'education'
  | 'certification'
  | 'ignored'
  | null;

const SECTION_HEADINGS: Array<{ section: Exclude<Section, null>; pattern: RegExp }> = [
  {
    section: 'required',
    pattern: /^(requisitos?(?: obrigatorios?| necessarios?| e qualificacoes?| tecnicos?)?|qualificacoes?(?: minimas?)?|o que esperamos(?: de voce)?|o que voce precisa|conhecimentos obrigatorios?|(?:e )?essencial(?: ter)?|must have|requirements?)$/,
  },
  {
    section: 'preferred',
    pattern: /^(requisitos? desejaveis?|(?:e )?desejaveis?|diferenci(?:al|ais)|sera um diferencial|nice to have|preferred qualifications?)$/,
  },
  {
    section: 'responsibility',
    pattern: /^(responsabilidades?(?: e atribuicoes?)?|atividades(?: do cargo)?|seu dia a dia|o que voce vai fazer|what you.ll do|responsibilities?)$/,
  },
  {
    section: 'education',
    pattern: /^(formacao(?: academica)?|escolaridade|educacao|education|academic background)$/,
  },
  {
    section: 'certification',
    pattern: /^(certificacoes?|certificados?|certifications?)$/,
  },
  {
    section: 'ignored',
    pattern: /^(beneficios?|o que oferecemos|sobre (?:a empresa|nos)|quem somos|about us|our benefits|cultura(?: e valores)?|valores|nossos valores|nosso jeito de ser|informacoes adicionais|diversidade(?: e inclusao)?|trabalhe (?:conosco|na .+|no .+)|venha ser .+)$/,
  },
];

const REQUIREMENT_INTENT =
  /\b(requisitos?|necess[aá]rio|necess[aá]ria|obrigat[oó]rio|obrigat[oó]ria|essencial|esperamos|buscamos|procuramos|desej[aá]vel|diferencial|experi[eê]ncia com|conhecimento(?:s)? em|dom[ií]nio de|must have|nice to have|should have)\b/i;
const EDUCATION_TERMS = /\b(formad[oa]|forma[cç][aã]o|gradua[cç][aã]o|graduad[oa]|bacharelado|licenciatura|ensino superior|superior (?:completo|em)|tecn[oó]logo|p[oó]s-gradua[cç][aã]o|mestrado|doutorado|degree|bachelor|master)\b/i;
const CERTIFICATION_TERMS = /\b(certifica[cç][aã]o|certificado|certification|certified)\b/i;
const BEHAVIORAL_TERMS =
  /\b(comunica[cç][aã]o|trabalho em equipe|colabora[cç][aã]o|lideran[cç]a|proatividade|organiza[cç][aã]o|adaptabilidade|resolu[cç][aã]o de problemas|soft skills|communication|teamwork|leadership)\b/i;
const BENEFIT_TERMS =
  /\b(plano de sa[uú]de|vale[- ]?refei[cç][aã]o|vale[- ]?alimenta[cç][aã]o|f[eé]rias|day off|sal[aá]rio|remunera[cç][aã]o|b[oô]nus|benef[ií]cios|gympass|wellhub)\b/i;
const ACTION_TERMS =
  /\b(desenvolver|implementar|criar|manter|construir|projetar|liderar|automatizar|integrar|respons[aá]vel por|develop|implement|build|maintain|design|lead)\b/i;

function comparisonText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[`*_~]/g, '')
    .replace(/[^\p{L}\p{N}+#/. -]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function headingSection(line: string): Section | undefined {
  const text = comparisonText(line.replace(/^#{1,6}\s*/, '').replace(/:$/, ''));
  if (!text || text.length > 100) return undefined;
  return SECTION_HEADINGS.find(({ pattern }) => pattern.test(text))?.section;
}

function cleanLine(line: string): string {
  return line
    .replace(/^\s*(?:[-*+•▪]|\d+[.)])\s*/, '')
    .replace(/^\s*\|/, '')
    .replace(/\|\s*$/, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitTableCells(line: string): string[] {
  if (!line.includes('|')) return [line];
  return line.split('|').map((cell) => cell.trim()).filter(Boolean);
}

function classify(
  text: string,
  section: Section,
  technologies: string[],
): RequirementCategory | null {
  if (BENEFIT_TERMS.test(text)) return null;
  if (section === 'ignored') return null;
  if (section === 'education' || EDUCATION_TERMS.test(text)) return 'education';
  if (section === 'certification' || CERTIFICATION_TERMS.test(text)) return 'certification';
  const requirementSection =
    section === 'required' || section === 'preferred' || section === 'responsibility';
  if (BEHAVIORAL_TERMS.test(text) && (requirementSection || REQUIREMENT_INTENT.test(text))) {
    return 'behavioral';
  }
  if (section === 'required') return 'required';
  if (section === 'preferred') return 'preferred';
  if (section === 'responsibility') return 'responsibility';
  if (/\b(desej[aá]vel|diferencial|nice to have|preferred)\b/i.test(text)) {
    return 'preferred';
  }
  if (
    /\b(obrigat[oó]rio|obrigat[oó]ria|necess[aá]rio|necess[aá]ria|essencial|must have|required)\b/i.test(text)
  ) {
    return 'required';
  }
  if (technologies.length > 0 && (REQUIREMENT_INTENT.test(text) || section === null)) {
    return section === null && !REQUIREMENT_INTENT.test(text) ? 'ambiguous' : 'required';
  }
  if (REQUIREMENT_INTENT.test(text)) return 'ambiguous';
  if (ACTION_TERMS.test(text) && section === null) return null;
  return null;
}

function priorityFor(
  text: string,
  section: Section,
  category: RequirementCategory,
): ParsedJobRequirement['priority'] {
  if (category === 'responsibility') return 'informational';
  if (category === 'ambiguous') return 'review';
  if (/\b(desej[aá]vel|diferencial|nice to have|preferred)\b/i.test(text)) {
    return 'preferred';
  }
  if (category === 'required' || section === 'required') return 'required';
  if (
    (category === 'education' && section === 'education') ||
    (category === 'certification' && section === 'certification') ||
    /\b(obrigat[oó]rio|obrigat[oó]ria|necess[aá]rio|necess[aá]ria|essencial|required|must have)\b/i.test(
      text,
    )
  ) {
    return 'required';
  }
  if (section === 'preferred') return 'preferred';
  return 'review';
}

function inferCompany(text: string): string | null {
  const match = /(?:empresa|company)\s*:\s*([^\r\n|]{2,100})/i.exec(text);
  return match?.[1]?.trim() || null;
}

function inferTitle(job: JobTarget | null | undefined, lines: string[]): string | null {
  const supplied = job?.title?.trim();
  if (supplied) return supplied;
  const rolePattern =
    /\b(desenvolvedor|desenvolvedora|developer|engenheiro|engenheira|engineer|analista|analyst|especialista|specialist|arquiteto|arquiteta|architect|designer|gerente|manager|coordenador|coordenadora|lead|estagi[aá]rio|estagi[aá]ria|intern|product owner|scrum master|back[- ]?end|front[- ]?end|full[- ]?stack)\b/i;
  for (const line of lines.map(cleanLine)) {
    if (line.length < 3 || line.length > 100 || headingSection(line)) continue;
    const explicit = /^(?:vaga|cargo|t[ií]tulo|position|job title)\s*[:\-]\s*(.+)$/i.exec(line);
    const candidate = explicit?.[1]?.trim() ?? line;
    if (
      !explicit &&
      /\b(com|em|utilizando|usando|experi[eê]ncia|conhecimentos?|respons[aá]vel|desenvolver|implementar|manter)\b/i.test(
        candidate,
      )
    ) {
      continue;
    }
    if (rolePattern.test(candidate)) return candidate;
  }
  return null;
}

export class JobRequirementParser {
  parse(job: JobTarget | null | undefined): ParsedJobDescription {
    const description = job?.description ?? '';
    const lines = description.split(/\r?\n/);
    const title = inferTitle(job, lines);
    const requirements: ParsedJobRequirement[] = [];
    let section: Section = null;
    let ignoreCodeBlock = false;
    const seen = new Set<string>();

    for (const rawLine of lines) {
      if (/^\s*```/.test(rawLine)) {
        ignoreCodeBlock = !ignoreCodeBlock;
        continue;
      }
      if (ignoreCodeBlock) continue;

      const detectedSection = headingSection(rawLine);
      if (detectedSection !== undefined) {
        section = detectedSection;
        continue;
      }

      const line = cleanLine(rawLine);
      if (!line || /^[-|:\s]+$/.test(line)) continue;
      if (title && comparisonText(line) === comparisonText(title)) continue;

      const cells = splitTableCells(line);
      const rowSection = cells.length > 1 ? headingSection(cells[0]) : undefined;
      for (const [cellIndex, text] of cells.entries()) {
        if (rowSection && cellIndex === 0) continue;
        if (!text || text.length > 500) continue;
        const technologies = extractTechnologies(text);
        // Linhas de introdução ("Domínio de pelo menos uma das seguintes stacks:")
        // terminam em ":" e não têm tecnologia: são cabeçalhos dos itens seguintes,
        // não requisitos pontuáveis.
        if (/:\s*$/.test(text) && technologies.length === 0) continue;
        const effectiveSection = rowSection ?? section;
        const category = classify(text, effectiveSection, technologies);
        if (!category) continue;
        const priority = priorityFor(text, effectiveSection, category);

        const key = `${category}:${comparisonText(text)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        requirements.push({
          text,
          category,
          priority,
          technologies,
          reviewRequired: priority === 'review',
        });
      }
    }

    return {
      title,
      company: inferCompany(description),
      requirements,
    };
  }
}
