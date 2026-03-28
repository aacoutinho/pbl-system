# PBL System — Sistema de Avaliação Tutorial

Sistema web para gerenciamento e avaliação de sessões de **Aprendizado Baseado em Problemas** (PBL — *Problem-Based Learning*), voltado para ambientes acadêmicos que utilizam a metodologia de tutoriais em grupo.

---

## Visão Geral

O PBL System permite que professores criem e gerenciem sessões de tutorial, atribuam papéis aos alunos, coletem avaliações de pares durante a sessão e calculem automaticamente as notas de desempenho individuais. Alunos acessam o sistema via matrícula para avaliar seus colegas e interagir com o quadro digital de brainstorm.

### Fluxo Principal

```
Professor cria turma → Cadastra alunos → Cria sessão → Abre sessão
     ↓
Alunos acessam via matrícula → Avaliam pares → Professor fecha sessão
     ↓
Professor avalia o tutorial → Encerra sessão → Notas calculadas automaticamente
     ↓
Exportação de relatórios (PDF / CSV)
```

---

## Funcionalidades

### Para Professores

- Gerenciamento de **componentes curriculares** com controle de acesso por papel (coordenador / professor).
- Criação e gerenciamento de **turmas** por semestre.
- Cadastro individual e importação em lote de **alunos** via CSV.
- Criação de **sessões de tutorial** com atribuição de papéis (`COORDENADOR`, `MESA`, `QUADRO`, `PARTICIPANTE`).
- Controle do ciclo de vida da sessão: `Iniciada → Aberta → Fechada → Encerrada`.
- **Avaliação tutorial** com 5 critérios ponderados (Organização, Cooperação, Discussão, Progresso, Metas).
- **Marcação de faltas** retroativa com suporte a falta justificada.
- Consulta de resultados por sessão, por problema e consolidado por aluno.
- Exportação de relatórios em **PDF** e **CSV** (por sessão, por problema, consolidado, multi-turma).
- Envio de notas por **e-mail** aos alunos.
- Geração de **links de acesso direto** por token individual.
- Visualização e comentários no **quadro de brainstorm** da sessão.
- **Backup e restauração** completa do banco de dados em JSON.
- **Log de auditoria** de todas as ações do sistema.

### Para Alunos

- Acesso via **matrícula** com verificação por código OTP enviado ao e-mail.
- **Avaliação de pares** com 5 critérios ponderados e sliders de conceito (Nenhuma → Excelente).
- Visualização de **notas provisórias** recebidas após a avaliação.
- Edição do **quadro de brainstorm** (aluno com papel MESA).
- Acesso por **link direto** com token, sem necessidade de código OTP.

---

## Arquitetura

### Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| Frontend | React 19 + TypeScript + Tailwind CSS 4 + shadcn/ui |
| Roteamento | Wouter |
| API | tRPC 11 (tipagem end-to-end) + SuperJSON |
| Backend | Node.js + Express 4 |
| ORM | Drizzle ORM |
| Banco de dados | MySQL / TiDB |
| Armazenamento | S3 (fotos de alunos, anexos do brainstorm) |
| Autenticação | JWT em cookie HTTP-only (professores) + OTP por e-mail (alunos) |

### Estrutura de Diretórios

```
client/
  src/
    pages/          ← Páginas da aplicação
    components/     ← Componentes reutilizáveis (UI, layout)
    contexts/       ← Contextos React (ClassContext, ComponentContext)
    hooks/          ← Hooks customizados
    lib/            ← Utilitários (trpc, semesterUtils, resizeImage)
    App.tsx         ← Definição de rotas
drizzle/
  schema.ts         ← Definição das 25 tabelas do banco
  migrations/       ← Histórico de migrações
server/
  routers.ts        ← Todas as procedures tRPC
  db.ts             ← Funções de acesso ao banco e algoritmos de cálculo
  _core/            ← Infraestrutura (auth, e-mail, LLM, S3, env)
```

---

## Modelos de Dados

O sistema possui 25 tabelas. As principais são:

| Tabela | Descrição |
|---|---|
| `users` | Professores e administradores |
| `components` | Componentes curriculares (ex: TEC502) |
| `professor_components` | Vínculo professor-componente com papel e status |
| `classes` | Turmas por componente e semestre |
| `students` | Alunos identificados por matrícula única |
| `class_students` | Vínculo aluno-turma |
| `sessions` | Sessões de tutorial (PxSy) |
| `session_students` | Alunos presentes na sessão com papel e ausência |
| `evaluations` | Cabeçalho de avaliação de pares por aluno |
| `evaluation_items` | Notas individuais por critério e por par |
| `tutorial_evaluations` | Avaliação tutorial submetida pelo professor |
| `brainstorm_boards` | Quadro digital por sessão |
| `brainstorm_items` | Itens do quadro (ideias, fatos, questões, metas) |
| `session_access_tokens` | Tokens de acesso direto por aluno por sessão |
| `smtp_config` | Configuração de e-mail do administrador |
| `audit_logs` | Log de auditoria de todas as ações |

---

## Algoritmo de Cálculo de Notas

### Nota de Pares (`peerScore`)

Para cada aluno presente, calcula-se a média das pontuações recebidas dos colegas:

```
pontuação_por_avaliador = pontualidade × 1
                        + pesquisaMetas × 3
                        + dominio × 3
                        + participacao × 3
                        − desempenhoPapel × 1

peerScore = média(pontuação_por_avaliador) de todos os avaliadores válidos
```

Cada critério aceita os valores: `0.00`, `0.25`, `0.50`, `0.75` ou `1.00`. O `peerScore` varia de `-1.0` a `10.0`.

### Nota Tutorial (`tutorialGrade`)

```
tutorialGrade = organizacao × 1
              + cooperacao × 1
              + conteudo × 3
              + objetivo × 3
              + metas × 2
```

Varia de `0.0` a `10.0`.

### Nota de Desempenho (`desempenhoScore`)

Distribui a nota tutorial proporcionalmente entre os alunos presentes, com base no `peerScore` relativo de cada um:

```
proportion = peerScore_aluno / soma(peerScore de todos os presentes)
desempenhoScore = min(10.0, proportion × tutorialGrade × numPresentes)
```

Alunos ausentes recebem `desempenhoScore = 0`.

---

## Papéis dos Alunos

Cada sessão atribui papéis exclusivos a até três alunos:

| Papel | Descrição |
|---|---|
| `COORDENADOR` | Coordena a discussão do grupo |
| `MESA` | Gerencia o quadro de brainstorm digital |
| `QUADRO` | Responsável pelo quadro físico em sala |
| `PARTICIPANTE` | Demais alunos presentes |

O papel `MESA` é determinante para o acesso de edição ao quadro de brainstorm.

---

## Ciclo de Vida da Sessão

```
INICIADA → ABERTA → FECHADA → ENCERRADA
```

| Estado | Descrição |
|---|---|
| `initiated` | Sessão criada, sem código de acesso. Alunos não podem entrar. |
| `open` | Código gerado. Alunos podem se autenticar e avaliar pares. |
| `closed` | Avaliação pelos alunos encerrada. Professor pode avaliar o tutorial. Notas provisórias disponíveis. |
| `finished` | Professor submeteu a avaliação tutorial. Notas finais calculadas. |

---

## Autenticação

### Professores

Login por **e-mail e senha** com verificação por código OTP no cadastro. O JWT é armazenado em cookie HTTP-only. O primeiro usuário cadastrado torna-se automaticamente coordenador.

### Alunos

Autenticação sem conta permanente: o aluno informa a **matrícula**, recebe um código OTP no e-mail cadastrado e é autenticado com sessão de 3 horas (ou 24 horas com "lembrar-me"). No primeiro acesso, o aluno define seu e-mail e faz upload de foto.

### Hierarquia de Permissões

```
admin > coordinator > prof > user (pendente)
```

Além do papel global, o acesso a turmas e sessões é verificado pelo papel do professor **dentro do componente** (`coordinator` ou `prof`).

---

## Variáveis de Ambiente

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | String de conexão MySQL/TiDB |
| `JWT_SECRET` | Segredo para assinatura dos cookies JWT |
| `OWNER_OPEN_ID` | OpenID do primeiro usuário (torna-se coordenador) |
| `OWNER_NAME` | Nome do primeiro usuário |
| `BUILT_IN_FORGE_API_URL` | URL da API interna (LLM, storage, notificações) |
| `BUILT_IN_FORGE_API_KEY` | Chave da API interna (server-side) |
| `VITE_APP_ID` | ID da aplicação OAuth |
| `VITE_OAUTH_PORTAL_URL` | URL do portal de login OAuth |

---

## Instalação e Execução

```bash
# Instalar dependências
pnpm install

# Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com as credenciais do banco e demais variáveis

# Aplicar o schema ao banco de dados
pnpm db:push

# Iniciar em modo de desenvolvimento
pnpm dev

# Executar testes
pnpm test

# Build de produção
pnpm build
```

---

## Exportação de Relatórios

Todos os relatórios são gerados no **frontend** (client-side) sem dependências de servidor:

| Relatório | Formatos |
|---|---|
| Por sessão (notas de pares e desempenho) | PDF, CSV |
| Por problema (média das sessões) | PDF, CSV |
| Consolidado por aluno (todas as sessões) | PDF, CSV |
| Multi-turma (todas as turmas do componente) | PDF, CSV |

---

## Backup e Restauração

O administrador pode exportar o banco completo em JSON e restaurá-lo posteriormente. O arquivo de backup inclui metadados de versão do schema para detectar incompatibilidades antes da restauração.

---

## Licença

Este projeto foi desenvolvido para uso acadêmico interno. Consulte o responsável pelo repositório para informações sobre licenciamento e uso.
