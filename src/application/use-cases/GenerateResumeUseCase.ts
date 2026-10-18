import { IConfigRepository } from '../../domain/interfaces/IConfigRepository';
import { IKeywordExtractor } from '../../domain/interfaces/IKeywordExtractor';
import { IOutputRepository } from '../../domain/interfaces/IOutputRepository';
import { IResumeRenderer, RenderPayload } from '../../domain/interfaces/IResumeRenderer';
import { IResumeRepository } from '../../domain/interfaces/IResumeRepository';
import { ImpactEnricher } from '../../domain/services/ImpactEnricher';
import { GenerateResumeInput } from '../dtos/GenerateResumeInput';

export class GenerateResumeUseCase {
  constructor(
    private readonly resumeRepo: IResumeRepository,
    private readonly configRepo: IConfigRepository,
    private readonly renderer: IResumeRenderer,
    private readonly keywordExtractor: IKeywordExtractor,
    private readonly outputRepo: IOutputRepository,
  ) {}

  async execute(input: GenerateResumeInput): Promise<void> {
    const resume = this.resumeRepo.load();
    const config = this.configRepo.load();
    const extraKeywords = this.keywordExtractor.extract(input.jobDescriptionPath);
    const enricher = new ImpactEnricher(config.impactRules);

    const targets = input.all
      ? Object.keys(config.focuses)
      : [input.focus!];

    this.outputRepo.ensureDir();

    if (extraKeywords.length > 0) {
      console.log(`\n[info] ${extraKeywords.length} palavras-chave extraídas da descrição da vaga:`);
      console.log(
        `       ${extraKeywords.slice(0, 10).join(', ')}${extraKeywords.length > 10 ? '...' : ''}`,
      );
    }

    console.log(`\nGerando ${targets.length} currículo(s)...\n`);

    let errors = 0;

    for (const focus of targets) {
      const focusConfig = config.focuses[focus];
      if (!focusConfig) {
        console.error(`  ✘  Foco desconhecido: "${focus}"`);
        errors++;
        continue;
      }

      const profile = this.buildProfile(config.profiles[focus] ?? '', extraKeywords);
      const skills = this.buildSkills(config.skills[focus] ?? {}, extraKeywords);

      const experiencias = resume.experiencias.map((exp) => {
        const usedResults = new Set<string>();
        return {
          empresa: exp.empresa,
          cargo: exp.cargo,
          periodo: exp.periodo,
          stack: exp.stack,
          atividades: exp.atividades.map((a) => enricher.enrich(a, exp.empresa, usedResults)),
          resultados: exp.resultados ?? [],
        };
      });

      const payload: RenderPayload = {
        contact: {
          nome: resume.nome,
          email: resume.email,
          telefone: resume.telefone,
          linkedin: resume.linkedin,
          github: resume.github,
          portfolio: resume.portfolio,
          formacao: resume.formacao,
          idiomas: resume.idiomas,
        },
        focus,
        title: focusConfig.title,
        profile,
        skills,
        experiencias,
        projetos: [],
        extraKeywords,
      };

      // Swap extension to match renderer format (.docx → .md for markdown)
      const baseName = focusConfig.filename.replace(/\.[^.]+$/, '');
      const filename = `${baseName}${this.renderer.extension}`;

      try {
        const output = await this.renderer.render(payload);
        this.outputRepo.save(output, filename);
        console.log(`  ✔  ${filename}`);
      } catch (err) {
        console.error(`  ✘  ${filename}: ${(err as Error).message}`);
        errors++;
      }
    }

    if (errors > 0) {
      console.error(`\n${errors} erro(s) ocorreram durante a geração.`);
      process.exit(1);
    }
  }

  private buildProfile(base: string, extraKeywords: string[]): string {
    if (extraKeywords.length === 0) return base;

    const baseLower = base.toLowerCase();
    const novel = extraKeywords
      .filter((k) => !baseLower.includes(k.toLowerCase()))
      .slice(0, 4);

    return novel.length > 0
      ? `${base} Familiaridade adicional com: ${novel.join(', ')}.`
      : base;
  }

  private buildSkills(
    groups: Record<string, string[]>,
    extraKeywords: string[],
  ): Record<string, string[]> {
    const extraLower = extraKeywords.map((k) => k.toLowerCase());
    const result: Record<string, string[]> = {};

    for (const [category, items] of Object.entries(groups)) {
      const itemsLower = items.map((i) => i.toLowerCase());
      const extras = extraLower
        .filter((k) => !itemsLower.includes(k))
        .slice(0, 2)
        .map((k) => extraKeywords.find((e) => e.toLowerCase() === k) ?? k);
      result[category] = [...extras, ...items];
    }

    return result;
  }
}
