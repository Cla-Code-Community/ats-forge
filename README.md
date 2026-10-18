# Gerador de Currículos ATS

> **Template** — Gere currículos compatíveis com sistemas ATS nos formatos **DOCX** e **Markdown** a partir de um único arquivo JSON.
> Desenvolvido com **TypeScript** e **Arquitetura Limpa (Clean Architecture)**.

## Dois modos de uso

O ATS Forge funciona de duas formas:

1. **CLI** (template original) — gera currículos a partir de `resume.json` + `config/`.
2. **Serviço HTTP (backend de currículos)** — recebe um **perfil normalizado** por HTTP
   e devolve o currículo em **DOCX**, **PDF** ou **Markdown**, com um **ATS Score**. É
   assim que a plataforma *Candidate* integra a geração de currículos.

### Serviço HTTP

```bash
npm install
npm run build

# Sobe o serviço (porta padrão 8089; configurável via PORT/ATS_FORGE_PORT)
npm start
# ou, em desenvolvimento:
npm run serve
```

Variáveis de ambiente:

| Variável            | Descrição                                                              |
| ------------------- | ---------------------------------------------------------------------- |
| `PORT`              | Porta do serviço (padrão `8089`).                                      |
| `ATS_FORGE_API_KEY` | Se definido, exige o header `x-api-key`. Vazio = autenticação off.     |

#### `POST /resumes/generate`

Corpo (JSON):

```jsonc
{
  "profile": {
    "name": "Ana Souza",
    "headline": "Engenheira de Software Backend",
    "summary": "...",                 // opcional; se ausente, é derivado das evidências
    "contact": { "email": "...", "phone": "...", "website": "..." },
    "experience": [ { "company": "...", "role": "...", "period": "...",
                      "stack": ["..."], "highlights": ["..."], "results": ["..."] } ],
    "education": [ { "institution": "...", "degree": "...", "field": "..." } ],
    "skills":    [ { "name": "TypeScript", "years": 5, "category": "Linguagens" } ],
    "projects":  [ { "name": "...", "description": "...", "stack": ["..."] } ],
    "links":     [ { "type": "github", "url": "..." } ],
    "languages": [ { "name": "Português", "level": "Nativo" } ]
  },
  "job":    { "title": "...", "description": "..." },   // opcional
  "format": "pdf"                                       // "docx" | "pdf" | "md"
}
```

Resposta: o arquivo binário/texto no corpo, com:

* `Content-Disposition: attachment; filename="..."`
* `X-Ats-Score: 0-100` — pontuação estimada de compatibilidade ATS.
* `X-Ats-Report: <base64 JSON>` — relatório completo (breakdown, matched/missing keywords, sugestões).

O motor **nunca inventa** empresas, cargos, datas, tecnologias ou resultados: ele apenas
organiza, resume e adapta palavras-chave a partir das evidências recebidas no perfil.

#### Análise explicável e fontes de evidência

O processamento é determinístico e local ao serviço: não usa IA generativa, embeddings,
modelos de machine learning ou serviços externos de inferência. O catálogo de competências
tem versão (`TECH_TAXONOMY_VERSION`) e aliases com limites de palavra; por exemplo,
`NodeJS`, `Node.js` e `Node JS` são normalizados para `Node.js`, enquanto `TS` só é
reconhecido como TypeScript quando o texto também indica contexto de linguagem.

O relatório de análise também inclui `jobDetails`, os `requirements` classificados
(`required`, `preferred`, `responsibility`, `education`, `certification`, `behavioral`
ou `ambiguous`), evidências por requisito e `jobFitScore`. Requisitos ambíguos são
marcados para revisão, em vez de entrarem silenciosamente como obrigatórios. O cálculo
da aderência textual usa peso 3 para obrigatórios e 1 para desejáveis; evidências de
experiência profissional valem 100%, de projeto 80% e menções de perfil 45%. Itens
informativos e em revisão não entram nessa pontuação. `confidence` mede apenas a
correspondência textual e não a probabilidade de domínio da competência.

Tecnologias lidas de badges e trechos de código no README do GitHub são removidas
antes da análise. Competências listadas no perfil permanecem identificadas como
menções; READMEs e stacks de repositórios permanecem identificados como projetos —
nunca são promovidos a experiência profissional. A falha ou ausência de README continua
sendo tolerada.

#### Experiência profissional pelo README de perfil do GitHub

O **README do perfil** (o repositório especial `usuario/usuario`, que aparece na página
do perfil) é tratado como conteúdo autodeclarado do candidato. Se ele tiver uma seção de
experiência profissional nesse padrão, o serviço a importa como experiência real
(`source: "github"`), sem inventar nada. READMEs de repositórios comuns continuam sendo
projetos.

Padrão reconhecido (Markdown):

```markdown
## Experiência Profissional

### Engenheiro de Software — Acme Corp (2022 - Atual)
- Desenvolvi APIs REST em Node.js e TypeScript
- Reduzi a latência em 30%

### Desenvolvedor Júnior @ Empresa X (2020 - 2022)
- Manutenção de serviços backend
```

Regras do padrão:

- O título da seção deve conter uma palavra-chave de experiência: `Experiência`,
  `Experiência Profissional`, `Histórico Profissional`, `Professional Experience`,
  `Work Experience`, `Experience` ou `Carreira`.
- Cada experiência é um subtítulo (`###`/`####`) **ou** uma linha em negrito (`**...**`).
- O título de cada experiência precisa de um separador entre **cargo** e **empresa**:
  `—`, `–`, `-`, `@`, `|` ou as palavras `at`/`em`/`na`/`no`. Formato: `Cargo <sep> Empresa`.
- O período pode vir entre parênteses no título (`(2022 - Atual)`) ou em uma linha logo
  abaixo. Aceita anos `AAAA` e `Atual`/`Presente`/`Present`/`Current`/`Hoje`.
- Os bullets (`-`, `*`, `•`) abaixo do título viram as realizações da experiência.
- Experiências já informadas pelo candidato têm prioridade; entradas do README que
  coincidem em cargo+empresa não são duplicadas. Entradas sem o separador cargo/empresa
  são ignoradas.

---

## Recursos

* Gera currículos nos formatos `.docx`, `.pdf` e `.md` para diferentes objetivos profissionais.
* Extrai palavras-chave de uma descrição de vaga e as incorpora ao currículo.
* Todos os seus dados pessoais ficam centralizados em um único arquivo `resume.json` (ignorado pelo Git — nunca é enviado ao repositório).
* Toda a configuração dos perfis profissionais fica em arquivos JSON dentro da pasta `config/`, sem necessidade de alterar código TypeScript.
* Arquitetura baseada em **Clean Architecture**: Domínio → Aplicação → Infraestrutura → Apresentação.

---

## Início Rápido

```bash
# 1. Clone o repositório ou utilize este template
git clone https://github.com/your-user/ats-cv-generator.git
cd ats-cv-generator

# 2. Instale as dependências
npm install

# 3. Crie seu arquivo de currículo
cp resume.example.json resume.json
# ✏️ Edite o arquivo resume.json com seus dados reais

# 4. Gere todos os currículos (DOCX)
npm run generate -- --all

# 5. Os arquivos gerados estarão na pasta ./output/
```

---

## Personalização

### 1. Seus dados pessoais → `resume.json`

Copie `resume.example.json` para `resume.json` e preencha todos os campos.

O arquivo `resume.json` é ignorado pelo Git, garantindo que seus dados pessoais nunca sejam enviados ao repositório.

### 2. Perfis profissionais → `config/focuses.json`

Cada chave representa um perfil profissional. Você pode adicionar, renomear ou remover perfis conforme desejar.

```jsonc
{
  "node_react": {
    "filename": "Curriculo_Node_React.docx",
    "title": "Engenheiro Full Stack Node.js"
  }
}
```

### 3. Resumos profissionais → `config/profiles.json`

Defina um resumo profissional para cada perfil. O texto pode ser escrito em primeira ou terceira pessoa.

```jsonc
{
  "node_react": "Engenheiro de Software especializado em..."
}
```

### 4. Competências → `config/skills.json`

As habilidades são organizadas por categoria e exibidas na ordem definida no arquivo.

```jsonc
{
  "node_react": {
    "Linguagens": ["TypeScript", "JavaScript"],
    "Backend": ["Node.js", "Express.js"]
  }
}
```

### 5. Regras de impacto → `config/impact-rules.json`

Relaciona empresas (com o mesmo nome utilizado em `resume.json`) a métricas baseadas em palavras-chave.

Quando uma atividade profissional contém alguma das palavras-chave definidas, o resultado correspondente é automaticamente acrescentado à descrição.

```jsonc
{
  "Acme Corp": [
    {
      "keywords": ["api", "rest"],
      "result": "Redução de 30% no tempo de resposta dos serviços"
    }
  ]
}
```

---

## Utilização pela Linha de Comando (CLI)

```bash
# Gerar todos os perfis (DOCX)
npm run generate -- --all

# Gerar apenas um perfil
npm run generate -- --focus=node_react

# Gerar currículo personalizado a partir de uma descrição de vaga
npm run generate -- --focus=node_react --job=descricao-da-vaga.txt

# Gerar todos os currículos em Markdown
npm run generate -- --all --markdown

# Gerar todos os perfis utilizando uma descrição de vaga
npm run generate -- --all --job=descricao-da-vaga.txt
```

### Opções disponíveis

| Opção             | Descrição                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------- |
| `--all`           | Gera todos os perfis configurados                                                           |
| `--focus=<id>`    | Gera apenas um perfil específico                                                            |
| `--job=<arquivo>` | Caminho para um arquivo `.txt` contendo a descrição da vaga para extração de palavras-chave |
| `--markdown`      | Gera arquivos `.md` em vez de `.docx`                                                       |

---

## Estrutura do Projeto

```text
ats-cv-generator/
├── src/
│   ├── domain/                     # Regras de negócio (sem dependências externas)
│   │   ├── entities/
│   │   ├── interfaces/
│   │   └── services/
│   ├── application/                # Casos de uso
│   ├── infrastructure/             # Adaptadores externos
│   ├── presentation/               # Interface de linha de comando (CLI)
│   └── main.ts                     # Ponto de entrada
├── config/                         # Arquivos de configuração
│   ├── focuses.json
│   ├── profiles.json
│   ├── skills.json
│   └── impact-rules.json
├── resume.example.json             # Modelo de currículo
├── resume.json                     # Seus dados (ignorado pelo Git)
├── output/                         # Currículos gerados (ignorado pelo Git)
├── tsconfig.json
└── package.json
```

---

## Arquitetura

```text
        Argumentos CLI
              │
    ┌─────────▼──────────┐
    │ Apresentação (CLI) │
    └─────────┬──────────┘
              │
    ┌─────────▼──────────┐
    │     Aplicação      │
    └─────────┬──────────┘
              │
    ┌─────────▼──────────┐
    │      Domínio       │
    └─────────┬──────────┘
              │
    ┌─────────▼──────────┐
    │   Infraestrutura   │
    └────────────────────┘
```

A camada de **Domínio** possui **zero dependências externas**. Ela não depende de bibliotecas como `fs`, `docx` ou `path`, tornando as regras de negócio independentes e facilmente testáveis.

---

## Compilação

```bash
# Compila o projeto para a pasta dist/
npm run build

# Executa a versão compilada
npm run generate:compiled -- --all
```

---

## Licença

Este projeto está licenciado sob a **Licença MIT**.
