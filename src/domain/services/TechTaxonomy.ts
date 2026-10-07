/**
 * Technology taxonomy: canonical names, alias normalization, category mapping
 * and extraction of known technologies from free text (READMEs, bios, job
 * descriptions). This powers keyword coverage, deduplication and skill grouping.
 *
 * It only RECOGNIZES technologies that actually appear in the provided text —
 * it never invents them (spec §3/§7/§18).
 */

export type TechCategory =
  | 'Linguagens'
  | 'Backend'
  | 'Frontend'
  | 'Bancos de Dados'
  | 'Infraestrutura & DevOps'
  | 'Cloud'
  | 'Testes'
  | 'Arquitetura & Práticas'
  | 'Ferramentas';

interface TechDef {
  canonical: string;
  category: TechCategory;
  aliases: string[]; // lowercase; may contain spaces/dots/#/+
}

const TECHS: TechDef[] = [
  // Languages
  { canonical: 'JavaScript', category: 'Linguagens', aliases: ['javascript', 'js'] },
  { canonical: 'TypeScript', category: 'Linguagens', aliases: ['typescript', 'ts'] },
  { canonical: 'Java', category: 'Linguagens', aliases: ['java'] },
  { canonical: 'Python', category: 'Linguagens', aliases: ['python', 'py'] },
  { canonical: 'Go', category: 'Linguagens', aliases: ['golang', 'go'] },
  { canonical: 'C#', category: 'Linguagens', aliases: ['c#', 'csharp', 'c-sharp'] },
  { canonical: 'C++', category: 'Linguagens', aliases: ['c++', 'cpp'] },
  { canonical: 'C', category: 'Linguagens', aliases: ['c'] },
  { canonical: 'PHP', category: 'Linguagens', aliases: ['php'] },
  { canonical: 'Ruby', category: 'Linguagens', aliases: ['ruby'] },
  { canonical: 'Rust', category: 'Linguagens', aliases: ['rust'] },
  { canonical: 'Kotlin', category: 'Linguagens', aliases: ['kotlin'] },
  { canonical: 'Swift', category: 'Linguagens', aliases: ['swift'] },
  { canonical: 'Dart', category: 'Linguagens', aliases: ['dart'] },
  { canonical: 'SQL', category: 'Linguagens', aliases: ['sql'] },
  { canonical: 'Shell', category: 'Linguagens', aliases: ['shell', 'bash', 'shell script'] },
  { canonical: 'HTML', category: 'Frontend', aliases: ['html', 'html5'] },
  { canonical: 'CSS', category: 'Frontend', aliases: ['css', 'css3'] },

  // Backend / frameworks
  { canonical: 'Node.js', category: 'Backend', aliases: ['node.js', 'nodejs', 'node'] },
  { canonical: 'Express.js', category: 'Backend', aliases: ['express.js', 'express', 'expressjs'] },
  { canonical: 'NestJS', category: 'Backend', aliases: ['nestjs', 'nest.js', 'nest'] },
  { canonical: 'Spring Boot', category: 'Backend', aliases: ['spring boot', 'springboot'] },
  { canonical: 'Spring', category: 'Backend', aliases: ['spring', 'spring framework'] },
  { canonical: 'Django', category: 'Backend', aliases: ['django'] },
  { canonical: 'Flask', category: 'Backend', aliases: ['flask'] },
  { canonical: 'FastAPI', category: 'Backend', aliases: ['fastapi'] },
  { canonical: '.NET', category: 'Backend', aliases: ['.net', 'dotnet', 'asp.net', 'aspnet'] },
  { canonical: 'Laravel', category: 'Backend', aliases: ['laravel'] },
  { canonical: 'Rails', category: 'Backend', aliases: ['rails', 'ruby on rails'] },
  { canonical: 'GraphQL', category: 'Backend', aliases: ['graphql'] },
  { canonical: 'MuleSoft', category: 'Backend', aliases: ['mulesoft', 'mule'] },

  // Frontend
  { canonical: 'React', category: 'Frontend', aliases: ['react', 'react.js', 'reactjs'] },
  { canonical: 'Next.js', category: 'Frontend', aliases: ['next.js', 'nextjs', 'next'] },
  { canonical: 'Vue.js', category: 'Frontend', aliases: ['vue.js', 'vuejs', 'vue'] },
  { canonical: 'Angular', category: 'Frontend', aliases: ['angular', 'angularjs'] },
  { canonical: 'Svelte', category: 'Frontend', aliases: ['svelte'] },
  { canonical: 'Tailwind CSS', category: 'Frontend', aliases: ['tailwind', 'tailwindcss', 'tailwind css'] },
  { canonical: 'Redux', category: 'Frontend', aliases: ['redux'] },
  { canonical: 'React Native', category: 'Frontend', aliases: ['react native', 'react-native'] },
  { canonical: 'Flutter', category: 'Frontend', aliases: ['flutter'] },

  // Databases
  { canonical: 'PostgreSQL', category: 'Bancos de Dados', aliases: ['postgresql', 'postgres', 'psql'] },
  { canonical: 'MySQL', category: 'Bancos de Dados', aliases: ['mysql'] },
  { canonical: 'MongoDB', category: 'Bancos de Dados', aliases: ['mongodb', 'mongo'] },
  { canonical: 'Redis', category: 'Bancos de Dados', aliases: ['redis', 'valkey'] },
  { canonical: 'SQLite', category: 'Bancos de Dados', aliases: ['sqlite'] },
  { canonical: 'SQL Server', category: 'Bancos de Dados', aliases: ['sql server', 'sqlserver', 'mssql'] },
  { canonical: 'Oracle', category: 'Bancos de Dados', aliases: ['oracle', 'oracle db'] },
  { canonical: 'Elasticsearch', category: 'Bancos de Dados', aliases: ['elasticsearch', 'elastic search'] },
  { canonical: 'DynamoDB', category: 'Bancos de Dados', aliases: ['dynamodb', 'dynamo'] },

  // Infra / DevOps
  { canonical: 'Docker', category: 'Infraestrutura & DevOps', aliases: ['docker'] },
  { canonical: 'Kubernetes', category: 'Infraestrutura & DevOps', aliases: ['kubernetes', 'k8s'] },
  { canonical: 'GitHub Actions', category: 'Infraestrutura & DevOps', aliases: ['github actions', 'gh actions'] },
  { canonical: 'GitLab CI', category: 'Infraestrutura & DevOps', aliases: ['gitlab ci', 'gitlab-ci'] },
  { canonical: 'Jenkins', category: 'Infraestrutura & DevOps', aliases: ['jenkins'] },
  { canonical: 'Terraform', category: 'Infraestrutura & DevOps', aliases: ['terraform'] },
  { canonical: 'CI/CD', category: 'Infraestrutura & DevOps', aliases: ['ci/cd', 'cicd', 'ci-cd'] },
  { canonical: 'Nginx', category: 'Infraestrutura & DevOps', aliases: ['nginx'] },
  { canonical: 'Linux', category: 'Infraestrutura & DevOps', aliases: ['linux'] },
  { canonical: 'Kafka', category: 'Infraestrutura & DevOps', aliases: ['kafka', 'apache kafka'] },
  { canonical: 'RabbitMQ', category: 'Infraestrutura & DevOps', aliases: ['rabbitmq'] },

  // Cloud
  { canonical: 'AWS', category: 'Cloud', aliases: ['aws', 'amazon web services'] },
  { canonical: 'Google Cloud', category: 'Cloud', aliases: ['gcp', 'google cloud', 'google cloud platform'] },
  { canonical: 'Azure', category: 'Cloud', aliases: ['azure', 'microsoft azure'] },
  { canonical: 'Vercel', category: 'Cloud', aliases: ['vercel'] },
  { canonical: 'Heroku', category: 'Cloud', aliases: ['heroku'] },

  // Testing
  { canonical: 'Jest', category: 'Testes', aliases: ['jest'] },
  { canonical: 'Vitest', category: 'Testes', aliases: ['vitest'] },
  { canonical: 'JUnit', category: 'Testes', aliases: ['junit'] },
  { canonical: 'Cypress', category: 'Testes', aliases: ['cypress'] },
  { canonical: 'Playwright', category: 'Testes', aliases: ['playwright'] },
  { canonical: 'Testing Library', category: 'Testes', aliases: ['testing library', 'testing-library'] },
  { canonical: 'Pytest', category: 'Testes', aliases: ['pytest'] },

  // Architecture / practices
  { canonical: 'REST API', category: 'Arquitetura & Práticas', aliases: ['rest api', 'rest apis', 'rest', 'restful'] },
  { canonical: 'Microservices', category: 'Arquitetura & Práticas', aliases: ['microservices', 'microservice', 'microsserviços', 'microsservicos'] },
  { canonical: 'Clean Architecture', category: 'Arquitetura & Práticas', aliases: ['clean architecture', 'arquitetura limpa'] },
  { canonical: 'DDD', category: 'Arquitetura & Práticas', aliases: ['ddd', 'domain driven design', 'domain-driven design'] },
  { canonical: 'TDD', category: 'Arquitetura & Práticas', aliases: ['tdd', 'test driven development'] },
  { canonical: 'SOLID', category: 'Arquitetura & Práticas', aliases: ['solid'] },
  { canonical: 'Agile', category: 'Arquitetura & Práticas', aliases: ['agile', 'scrum', 'kanban', 'ágil'] },
  { canonical: 'gRPC', category: 'Arquitetura & Práticas', aliases: ['grpc'] },
  { canonical: 'WebSockets', category: 'Arquitetura & Práticas', aliases: ['websocket', 'websockets'] },

  // Tools
  { canonical: 'Git', category: 'Ferramentas', aliases: ['git'] },
  { canonical: 'Prisma', category: 'Ferramentas', aliases: ['prisma'] },
  { canonical: 'Drizzle ORM', category: 'Ferramentas', aliases: ['drizzle', 'drizzle orm'] },
  { canonical: 'TypeORM', category: 'Ferramentas', aliases: ['typeorm'] },
  { canonical: 'Swagger', category: 'Ferramentas', aliases: ['swagger', 'openapi'] },
];

// Build lookup maps.
const ALIAS_TO_CANONICAL = new Map<string, string>();
const CANONICAL_TO_CATEGORY = new Map<string, TechCategory>();
for (const def of TECHS) {
  CANONICAL_TO_CATEGORY.set(def.canonical, def.category);
  ALIAS_TO_CANONICAL.set(def.canonical.toLowerCase(), def.canonical);
  for (const alias of def.aliases) ALIAS_TO_CANONICAL.set(alias, def.canonical);
}

// Aliases sorted by length desc so multi-word terms match before their parts
// ("spring boot" before "spring", "react native" before "react").
const SORTED_ALIASES = [...ALIAS_TO_CANONICAL.keys()].sort((a, b) => b.length - a.length);

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Normalizes a single technology token to its canonical name (or trims it). */
export function normalizeTech(raw: string): string {
  const key = raw.trim().toLowerCase();
  return ALIAS_TO_CANONICAL.get(key) ?? raw.trim();
}

/** Canonical category for a (canonical or alias) tech name. */
export function categoryOf(tech: string): TechCategory | undefined {
  const canonical = normalizeTech(tech);
  return CANONICAL_TO_CATEGORY.get(canonical);
}

/**
 * Extracts the set of known technologies mentioned in free text, returned as
 * canonical names (deduplicated). Longer aliases are matched first and the
 * matched span is blanked out, so compound terms ("Spring Boot") win over their
 * parts ("Spring"). Boundaries use look-behind/ahead so adjacent tokens still
 * match.
 */
export function extractTechnologies(text: string): string[] {
  if (!text) return [];
  let haystack = text.toLowerCase();
  const seen = new Set<string>();
  const found: string[] = [];

  for (const alias of SORTED_ALIASES) {
    const canonical = ALIAS_TO_CANONICAL.get(alias)!;
    const pattern = new RegExp(
      `(?<![a-z0-9+#])${escapeRegExp(alias)}(?![a-z0-9+#])`,
      'gi',
    );
    let matched = false;
    haystack = haystack.replace(pattern, (m) => {
      matched = true;
      return ' '.repeat(m.length); // blank the span so sub-aliases can't re-match
    });
    if (matched && !seen.has(canonical)) {
      seen.add(canonical);
      found.push(canonical);
    }
  }

  return found;
}

/** Normalizes + dedupes a list of tech names to canonical form. */
export function normalizeTechList(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    const canonical = normalizeTech(item);
    const key = canonical.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(canonical);
    }
  }
  return out;
}
