import { NormalizedProfile } from '../src/domain/entities/NormalizedProfile';

export function fullProfile(): NormalizedProfile {
  return {
    name: 'Ana Souza',
    headline: 'Engenheira de Software Backend',
    summary: 'Engenheira de software com foco em APIs escaláveis.',
    contact: {
      email: 'ana@example.com',
      phone: '+55 11 90000-0000',
      location: 'São Paulo, BR',
      website: 'ana.dev',
    },
    experience: [
      {
        company: 'Acme Corp',
        role: 'Engenheira de Software',
        period: '2022 – Atual',
        stack: ['TypeScript', 'Node.js', 'PostgreSQL'],
        highlights: [
          'Desenvolvimento de APIs REST com Node.js e TypeScript',
          'Implementação de pipelines CI/CD',
        ],
        results: ['Redução de 30% no tempo de resposta'],
        source: 'candidate',
      },
    ],
    education: [
      {
        institution: 'USP',
        degree: 'Bacharelado',
        field: 'Ciência da Computação',
        period: '2016 – 2020',
      },
    ],
    skills: [
      { name: 'TypeScript', category: 'Linguagens', years: 5 },
      { name: 'Node.js', category: 'Backend' },
      { name: 'React', category: 'Frontend' },
    ],
    projects: [],
    links: [
      { type: 'github', url: 'github.com/ana' },
      { type: 'linkedin', url: 'linkedin.com/in/ana' },
    ],
    languages: [{ name: 'Português', level: 'Nativo' }],
  };
}

export function minimalProfile(): NormalizedProfile {
  return {
    name: 'João Lima',
    contact: {},
    experience: [],
    education: [],
    skills: [],
    projects: [],
    links: [],
    languages: [],
  };
}

export function richProfile(): NormalizedProfile {
  return {
    name: 'Bene Tesla',
    headline: 'Engenheiro de Software',
    summary: '',
    contact: {
      email: 'bene@example.com',
      phone: '+55 11 90000-0000',
      location: 'São Paulo, BR',
      website: 'bene.dev',
    },
    experience: [
      {
        company: 'Acme Corp',
        role: 'Engenheiro de Software',
        period: '2022 – Atual',
        stack: ['TypeScript', 'Node.js', 'PostgreSQL', 'Docker'],
        highlights: [
          'Desenvolvimento de APIs REST com Node.js e TypeScript',
          'Implementação de cache com Redis e otimização de queries',
          'Automação de CI/CD com GitHub Actions',
        ],
        results: ['Reduziu o tempo de resposta das APIs em 30%'],
        source: 'linkedin',
      },
    ],
    education: [{ institution: 'USP', degree: 'Bacharelado', field: 'Ciência da Computação' }],
    skills: [
      { name: 'TypeScript', category: 'Linguagens' },
      { name: 'JavaScript', category: 'Linguagens' },
      { name: 'Java', category: 'Linguagens' },
      { name: 'Node.js', category: 'Backend' },
      { name: 'NestJS', category: 'Backend' },
      { name: 'Spring Boot', category: 'Backend' },
      { name: 'React', category: 'Frontend' },
      { name: 'PostgreSQL', category: 'Bancos de Dados' },
      { name: 'Redis', category: 'Bancos de Dados' },
      { name: 'Docker', category: 'Infraestrutura & DevOps' },
      { name: 'AWS', category: 'Cloud' },
    ],
    projects: [
      {
        name: 'api-gateway',
        description: 'Gateway de APIs em Node.js',
        stack: ['Node.js', 'TypeScript', 'Docker'],
        highlights: ['Implementou rate limiting e autenticação JWT.', '120 stars'],
        source: 'github',
      },
      {
        name: 'data-pipeline',
        description: 'Pipeline de dados com microservices',
        stack: ['Java', 'Spring Boot', 'Kafka'],
        highlights: ['Projetou microservices com Clean Architecture.'],
        source: 'github',
      },
      {
        name: 'web-dashboard',
        description: 'Dashboard em React',
        stack: ['React', 'TypeScript'],
        highlights: ['Desenvolveu componentes reutilizáveis e testes com Jest.'],
        source: 'github',
      },
    ],
    links: [
      { type: 'github', url: 'https://github.com/bene' },
      { type: 'linkedin', url: 'https://www.linkedin.com/in/bene-tesla' },
    ],
    languages: [
      { name: 'Português', level: 'Nativo' },
      { name: 'Inglês', level: 'Avançado' },
    ],
  };
}

export function projectsOnlyProfile(): NormalizedProfile {
  return {
    name: 'Maria Dev',
    headline: 'Desenvolvedora',
    contact: { email: 'maria@example.com' },
    experience: [],
    education: [],
    skills: [{ name: 'Python' }],
    projects: [
      {
        name: 'Open Source CLI',
        description: 'Ferramenta CLI em Python',
        stack: ['Python'],
        highlights: ['200 stars no GitHub'],
        source: 'github',
      },
    ],
    links: [],
    languages: [],
  };
}
