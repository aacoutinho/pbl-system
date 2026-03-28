# Especificação Técnica — Sistema de Avaliação Tutorial

**Versão:** 1.0  
**Data:** Março de 2026  
**Finalidade:** Documento de referência completo para reimplementação do sistema em qualquer linguagem ou framework.

---

## Sumário

1. [Visão Geral do Sistema](#1-visão-geral-do-sistema)
2. [Arquitetura Técnica](#2-arquitetura-técnica)
3. [Modelos de Dados](#3-modelos-de-dados)
4. [Autenticação e Controle de Acesso](#4-autenticação-e-controle-de-acesso)
5. [Regras de Negócio e Algoritmos](#5-regras-de-negócio-e-algoritmos)
6. [Fluxos de Interface — Área do Professor](#6-fluxos-de-interface--área-do-professor)
7. [Fluxos de Interface — Área do Aluno](#7-fluxos-de-interface--área-do-aluno)
8. [Módulo de Relatórios e Exportações](#8-módulo-de-relatórios-e-exportações)
9. [Módulo de Brainstorm (Quadro Digital)](#9-módulo-de-brainstorm-quadro-digital)
10. [Módulo de E-mail e Notificações](#10-módulo-de-e-mail-e-notificações)
11. [Módulo de Backup e Restauração](#11-módulo-de-backup-e-restauração)
12. [Módulo Administrativo](#12-módulo-administrativo)
13. [Contextos Globais e Persistência de Filtros](#13-contextos-globais-e-persistência-de-filtros)

---

## 1. Visão Geral do Sistema

O **Sistema de Avaliação Tutorial** é uma aplicação web voltada para a gestão e avaliação de sessões de aprendizado baseado em problemas (PBL — *Problem-Based Learning*), também denominadas "tutoriais". O sistema atende dois perfis principais de usuário: **professores** (que criam e gerenciam sessões, avaliam tutoriais e consultam resultados) e **alunos** (que se autenticam via matrícula, avaliam seus pares durante a sessão e acessam o quadro digital de brainstorm).

O fluxo central do sistema é:

1. O professor cria uma **turma** vinculada a um **componente curricular** e a um semestre.
2. Alunos são cadastrados na turma (manualmente ou via importação CSV).
3. O professor cria uma **sessão** para a turma, atribuindo papéis aos alunos presentes.
4. A sessão é **aberta** (geração de código de acesso), permitindo que os alunos se autentiquem e avaliem seus pares.
5. O professor **fecha** a sessão (encerra a avaliação pelos alunos) e depois **encerra** (submete a avaliação tutorial do grupo).
6. O sistema calcula as **notas de desempenho** combinando avaliação de pares e avaliação tutorial do professor.
7. Resultados são consultados e exportados em PDF ou CSV.

---

## 2. Arquitetura Técnica

### 2.1 Stack de Referência (Implementação Atual)

| Camada | Tecnologia |
|---|---|
| Frontend | React 19 + TypeScript + Tailwind CSS 4 + shadcn/ui |
| Roteamento frontend | Wouter |
| Comunicação cliente-servidor | tRPC 11 (tipagem end-to-end) |
| Serialização | SuperJSON (preserva tipos `Date`, `Map`, etc.) |
| Backend | Node.js + Express 4 |
| ORM | Drizzle ORM |
| Banco de dados | MySQL / TiDB (compatível com MySQL) |
| Armazenamento de arquivos | S3 (fotos de alunos, anexos do brainstorm) |
| Autenticação de professores | E-mail + senha com JWT em cookie HTTP-only |
| Autenticação de alunos | Matrícula + código OTP por e-mail (sem conta permanente) |

### 2.2 Estrutura de Diretórios

```
client/src/
  pages/          ← Páginas da aplicação (uma por rota)
  components/     ← Componentes reutilizáveis
  contexts/       ← Contextos React (ClassContext, ComponentContext, ThemeContext)
  hooks/          ← Hooks customizados
  lib/            ← Utilitários (trpc.ts, semesterUtils.ts, resizeImage.ts)
  App.tsx         ← Definição de rotas
server/
  routers.ts      ← Todas as procedures tRPC
  db.ts           ← Funções de acesso ao banco
  _core/          ← Infraestrutura (auth, email, LLM, S3, env)
drizzle/
  schema.ts       ← Definição das tabelas
  migrations/     ← Arquivos de migração
```

### 2.3 Rotas da Aplicação

| Rota | Componente | Acesso |
|---|---|---|
| `/` | Home (Dashboard) | Professor autenticado |
| `/components` | ComponentsPage | Professor aprovado |
| `/classes` | ClassesPage | Professor aprovado |
| `/students` | StudentsPage | Professor aprovado |
| `/sessions` | SessionsPage | Professor aprovado |
| `/tutorial-eval` | TutorialEvalPage | Professor aprovado |
| `/results` | ResultsPage | Professor aprovado |
| `/export-students` | ExportStudentsPage | Professor aprovado |
| `/professors` | ProfessorsPage | Admin |
| `/smtp-config` | SmtpConfigPage | Admin |
| `/profile` | ProfilePage | Professor autenticado |
| `/audit-log` | AuditLogPage | Admin |
| `/notifications` | NotificationsPage | Professor aprovado |
| `/contact` | ContactPage | Professor aprovado |
| `/backup` | BackupPage | Admin |
| `/restauracao` | RestorePage | Admin |
| `/brainstorm/:sessionId` | BrainstormViewPage | Professor aprovado |
| `/admin/aluno/:studentId` | AdminStudentProfilePage | Professor aprovado |
| `/acesso` | StudentAccessPage | Público (aluno) |
| `/avaliacao` | DirectEvalPage | Público (aluno, acesso por token) |

---

## 3. Modelos de Dados

### 3.1 Tabela `users` — Professores/Administradores

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | INT PK AUTO | Identificador interno |
| `openId` | VARCHAR(64) UNIQUE | Identificador OAuth ou gerado no registro por e-mail |
| `name` | TEXT | Nome completo |
| `email` | VARCHAR(320) | E-mail de login |
| `loginMethod` | VARCHAR(64) | `"email"` ou `"oauth"` |
| `role` | ENUM | `user` \| `admin` \| `coordinator` \| `prof` |
| `approvalStatus` | ENUM | `pending` \| `approved` \| `rejected` |
| `passwordHash` | VARCHAR(255) | Hash bcrypt (login por e-mail) |
| `lastSignedIn` | TIMESTAMP | Último acesso |
| `createdAt` | TIMESTAMP | Data de criação |
| `updatedAt` | TIMESTAMP | Atualização automática |

**Regras de papel:**
- `user`: recém-cadastrado, aguardando aprovação.
- `prof`: professor aprovado, acessa componentes que lhe foram atribuídos.
- `coordinator`: coordenador de um ou mais componentes, aprova professores e gerencia turmas.
- `admin`: acesso total ao sistema, único que pode gerenciar SMTP, backup e usuários.

O primeiro usuário cadastrado recebe automaticamente o papel `coordinator` se seu `openId` coincidir com `OWNER_OPEN_ID`.

### 3.2 Tabela `components` — Componentes Curriculares

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | INT PK AUTO | Identificador |
| `code` | VARCHAR(32) UNIQUE | Código do componente (ex: `TEC502`) |
| `name` | VARCHAR(255) | Nome completo (ex: `Concorrência e Conectividade`) |
| `type` | ENUM | `T` (Teórico) \| `TP` (Teórico-Prático) |
| `createdAt` | TIMESTAMP | Data de criação |

### 3.3 Tabela `professor_components` — Vínculo Professor-Componente

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | INT PK AUTO | Identificador |
| `userId` | INT | Referência a `users.id` |
| `componentId` | INT | Referência a `components.id` |
| `componentRole` | ENUM | `coordinator` \| `prof` |
| `status` | ENUM | `pending` \| `approved` |
| `authorizedAt` | TIMESTAMP | Data de aprovação |
| `authorizedByUserId` | INT | Quem aprovou |

Restrição: par `(userId, componentId)` único.

### 3.4 Tabela `classes` — Turmas

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | INT PK AUTO | Identificador |
| `classCode` | VARCHAR(32) | Código da turma (ex: `TP01`) |
| `componentId` | INT | Referência a `components.id` |
| `semester` | VARCHAR(16) | Formato `ANO.SEMESTRE` (ex: `2026.1`) |
| `professorUserId` | INT | Professor responsável |
| `createdAt` | TIMESTAMP | Data de criação |

### 3.5 Tabela `students` — Alunos

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | INT PK AUTO | Identificador |
| `name` | VARCHAR(255) | Nome completo |
| `enrollment` | VARCHAR(32) UNIQUE | Matrícula (chave de autenticação do aluno) |
| `email` | VARCHAR(320) | E-mail (definido pelo aluno na primeira avaliação) |
| `photoUrl` | VARCHAR(512) | URL da foto no S3 |
| `createdAt` | TIMESTAMP | Data de criação |

A matrícula é **globalmente única**. O mesmo aluno pode estar em múltiplas turmas. Se uma matrícula já existe com dados diferentes, o sistema alerta o professor e oferece importar os dados existentes.

### 3.6 Tabela `class_students` — Vínculo Aluno-Turma

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | INT PK AUTO | Identificador |
| `studentId` | INT | Referência a `students.id` |
| `classId` | INT | Referência a `classes.id` |
| `addedAt` | TIMESTAMP | Data de inclusão na turma |

Restrição: par `(studentId, classId)` único.

### 3.7 Tabela `sessions` — Sessões de Tutorial

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | INT PK AUTO | Identificador |
| `classId` | INT | Referência a `classes.id` |
| `problemNumber` | INT | Número do problema (ex: `1`, `2`) |
| `sessionNumber` | INT | Número da sessão dentro do problema (ex: `1`, `2`) |
| `problemTitle` | VARCHAR(255) | Título do problema (opcional, compartilhado entre sessões do mesmo problema) |
| `label` | VARCHAR(100) | Rótulo exibido (ex: `P1S1`) |
| `accessCode` | VARCHAR(8) UNIQUE | Código de 8 caracteres para acesso dos alunos (gerado ao abrir) |
| `status` | ENUM | `initiated` \| `open` \| `closed` \| `finished` |
| `createdAt` | TIMESTAMP | Data de criação |
| `closedAt` | TIMESTAMP | Data de fechamento |

**Ciclo de vida dos estados:**

```
initiated → open → closed → finished
```

- **`initiated`**: sessão criada, sem código gerado. Alunos não podem acessar.
- **`open`**: código gerado, alunos podem se autenticar e avaliar pares.
- **`closed`**: avaliação pelos alunos encerrada. Professor pode avaliar o tutorial. Notas parciais (provisórias) já são calculadas.
- **`finished`**: professor submeteu a avaliação tutorial. Notas finais calculadas e disponíveis.

### 3.8 Tabela `session_students` — Alunos na Sessão

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | INT PK AUTO | Identificador |
| `sessionId` | INT | Referência a `sessions.id` |
| `studentId` | INT | Referência a `students.id` |
| `role` | ENUM | `COORDENADOR` \| `MESA` \| `QUADRO` \| `PARTICIPANTE` |
| `absent` | BOOLEAN | Se o aluno foi marcado como ausente |
| `justifiedAbsent` | BOOLEAN | Se a falta foi justificada pelo professor |

Restrição: par `(sessionId, studentId)` único.

**Importante:** Esta tabela é preenchida apenas com os alunos **presentes** na criação da sessão. Alunos ausentes na criação não têm registro. O sistema usa `getSessionStudentsWithFallback` para fazer merge com todos os alunos da turma ao exibir o diálogo de "Marcar Falta" em sessões encerradas.

### 3.9 Tabela `evaluations` — Cabeçalho de Avaliação de Pares

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | INT PK AUTO | Identificador |
| `sessionId` | INT | Referência a `sessions.id` |
| `evaluatorStudentId` | INT | Aluno que avaliou |
| `submittedAt` | TIMESTAMP | Momento da submissão |
| `autoFilled` | BOOLEAN | Se foi preenchida automaticamente (notas máximas) |

Restrição: par `(sessionId, evaluatorStudentId)` único.

### 3.10 Tabela `evaluation_items` — Notas Individuais por Par

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | INT PK AUTO | Identificador |
| `evaluationId` | INT | Referência a `evaluations.id` |
| `evaluatedStudentId` | INT | Aluno avaliado |
| `role` | ENUM | Papel do avaliado na sessão |
| `absent` | BOOLEAN | Se o avaliado foi marcado como ausente pelo avaliador |
| `pontualidade` | DECIMAL(4,2) | Nota de pontualidade (0.00 a 1.00) |
| `pesquisaMetas` | DECIMAL(4,2) | Nota de pesquisa/metas (0.00 a 1.00) |
| `dominio` | DECIMAL(4,2) | Nota de domínio do assunto (0.00 a 1.00) |
| `participacao` | DECIMAL(4,2) | Nota de participação (0.00 a 1.00) |
| `desempenhoPapel` | DECIMAL(4,2) | Nota de desempenho no papel (0.00 a 1.00, penalidade) |

### 3.11 Tabela `tutorial_evaluations` — Avaliação Tutorial pelo Professor

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | INT PK AUTO | Identificador |
| `sessionId` | INT UNIQUE | Referência a `sessions.id` |
| `professorUserId` | INT | Professor que avaliou |
| `organizacao` | DECIMAL(4,2) | Organização (peso 1, 0.00 a 1.00) |
| `cooperacao` | DECIMAL(4,2) | Cooperação (peso 1, 0.00 a 1.00) |
| `conteudo` | DECIMAL(4,2) | Discussão/Conteúdo (peso 3, 0.00 a 1.00) |
| `objetivo` | DECIMAL(4,2) | Progresso/Objetivo (peso 3, 0.00 a 1.00) |
| `metas` | DECIMAL(4,2) | Metas (peso 2, 0.00 a 1.00) |
| `submittedAt` | TIMESTAMP | Data de submissão |

### 3.12 Tabela `tutorial_eval_drafts` — Rascunho de Avaliação Tutorial

Mesma estrutura de `tutorial_evaluations`, mas com `savedAt` em vez de `submittedAt`. Permite que o professor salve progresso antes de submeter definitivamente.

### 3.13 Tabela `class_eval_permissions` — Permissões de Avaliação

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | INT PK AUTO | Identificador |
| `classId` | INT | Turma cujas sessões podem ser avaliadas |
| `authorizedUserId` | INT | Professor autorizado |
| `grantedByUserId` | INT | Quem concedeu a permissão |
| `grantedAt` | TIMESTAMP | Data da concessão |

### 3.14 Tabela `smtp_config` — Configuração de E-mail

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | INT PK AUTO | Identificador |
| `userId` | INT UNIQUE | Apenas o admin pode ter |
| `host` | VARCHAR(255) | Servidor SMTP |
| `port` | INT | Porta (padrão: 587) |
| `secure` | BOOLEAN | TLS direto (porta 465) |
| `username` | VARCHAR(320) | Usuário SMTP |
| `password` | VARCHAR(512) | Senha SMTP |
| `fromEmail` | VARCHAR(320) | E-mail remetente |
| `fromName` | VARCHAR(255) | Nome remetente (padrão: `Avaliação Tutorial`) |
| `configured` | BOOLEAN | Se a configuração foi salva |

### 3.15 Tabela `notifications` — Notificações Internas

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | INT PK AUTO | Identificador |
| `userId` | INT | Destinatário |
| `title` | VARCHAR(255) | Título |
| `content` | TEXT | Conteúdo |
| `read` | BOOLEAN | Se foi lida |
| `createdAt` | TIMESTAMP | Data de criação |

### 3.16 Tabela `audit_logs` — Logs de Auditoria

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | INT PK AUTO | Identificador |
| `userId` | INT | Usuário que executou a ação |
| `action` | VARCHAR(128) | Código da ação (ex: `session.create`) |
| `details` | JSON | Dados adicionais da ação |
| `createdAt` | TIMESTAMP | Data e hora |

### 3.17 Tabela `professor_student_notes` — Notas do Professor por Aluno

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | INT PK AUTO | Identificador |
| `sessionId` | INT | Sessão |
| `professorUserId` | INT | Professor |
| `studentId` | INT | Aluno avaliado |
| `positivePoints` | INT | Contagem de pontos positivos |
| `negativePoints` | INT | Contagem de pontos negativos |
| `positiveTexts` | JSON | Array de textos positivos |
| `negativeTexts` | JSON | Array de textos negativos |

### 3.18 Tabela `session_access_tokens` — Tokens de Acesso Direto

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | INT PK AUTO | Identificador |
| `sessionId` | INT | Sessão |
| `studentId` | INT | Aluno |
| `token` | VARCHAR(64) UNIQUE | Token único para acesso direto via link |
| `createdAt` | TIMESTAMP | Data de criação |

Restrição: par `(sessionId, studentId)` único.

### 3.19 Tabela `contact_tickets` — Chamados de Suporte

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | INT PK AUTO | Identificador |
| `userId` | INT | Professor que abriu o chamado |
| `type` | ENUM | `bug` \| `feature` |
| `subject` | VARCHAR(255) | Assunto |
| `message` | TEXT | Descrição |
| `status` | ENUM | `open` \| `resolved` |
| `resolvedAt` | TIMESTAMP | Data de resolução |
| `createdAt` | TIMESTAMP | Data de criação |

### 3.20 Tabelas do Brainstorm

**`brainstorm_boards`** — Um quadro por sessão, editado pelo aluno com papel MESA.

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | INT PK AUTO | Identificador |
| `sessionId` | INT UNIQUE | Sessão associada |
| `mesaStudentId` | INT | Aluno MESA que edita |
| `tutorComments` | TEXT | Comentários do professor/tutor |
| `createdAt` / `updatedAt` | TIMESTAMP | Datas |

**`brainstorm_items`** — Itens do quadro, organizados em seções.

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | INT PK AUTO | Identificador |
| `boardId` | INT | Referência ao quadro |
| `section` | ENUM | `ideias` \| `fatos` \| `questoes` \| `metas` |
| `content` | TEXT | Texto do item |
| `status` | VARCHAR(32) | Estado do item (varia por seção — ver §9) |
| `attachmentUrl` | VARCHAR(1024) | URL de anexo principal |
| `attachmentType` | ENUM | `link` \| `image` \| `video` \| `photo` \| `document` |
| `sortOrder` | INT | Ordem dentro da seção |

**`brainstorm_item_attachments`** — Múltiplos anexos por item.

**`brainstorm_board_send_history`** — Histórico de envios do quadro por e-mail.

---

## 4. Autenticação e Controle de Acesso

### 4.1 Autenticação de Professores

O sistema suporta dois métodos de login para professores:

**Login por e-mail/senha:**
1. O professor acessa a tela de login e informa e-mail e senha.
2. O servidor verifica o hash bcrypt e, se correto, emite um JWT assinado armazenado em cookie HTTP-only.
3. Cada requisição ao backend verifica o cookie e injeta `ctx.user` no contexto tRPC.

**Registro:**
1. Professor informa e-mail e solicita código de verificação (6 dígitos, válido por 15 minutos).
2. Se SMTP não configurado e for o primeiro usuário, o código é dispensado.
3. Após verificação, professor informa nome e senha (mínimo 6 caracteres).
4. Conta criada com `role: "user"` e `approvalStatus: "pending"`.
5. Admin aprova a conta, elevando para `role: "prof"` ou `coordinator`.

**Recuperação de senha:**
1. Professor solicita reset por e-mail.
2. Código de 6 dígitos enviado, válido por 15 minutos.
3. Após verificação, professor define nova senha.

### 4.2 Autenticação de Alunos

Alunos não possuem contas permanentes. O acesso é feito via matrícula:

**Fluxo de primeiro acesso:**
1. Aluno informa matrícula em `/acesso`.
2. Sistema verifica se matrícula existe. Se não, retorna erro.
3. Se aluno não tem e-mail cadastrado, vai para `setupProfile`: informa e-mail e faz upload de foto.
4. Código de verificação enviado ao e-mail informado (6 dígitos, 15 minutos).
5. Após verificação, aluno é autenticado e vai para o dashboard.

**Fluxo de acesso subsequente:**
1. Aluno informa matrícula.
2. Sistema envia código OTP ao e-mail cadastrado.
3. Aluno informa código e é autenticado.
4. Sessão armazenada em `localStorage` com TTL de 3 horas (ou 24 horas com "lembrar-me").

**Acesso por token direto:**
- O professor pode gerar tokens individuais por aluno por sessão.
- O link `/avaliacao?token=XYZ` autentica o aluno diretamente sem precisar de código OTP.
- Tokens são armazenados em `session_access_tokens`.

### 4.3 Hierarquia de Permissões (Professores)

As procedures tRPC são protegidas por middleware em cascata:

| Nível | Middleware | Quem tem acesso |
|---|---|---|
| Público | `publicProcedure` | Qualquer requisição |
| Autenticado | `protectedProcedure` | Qualquer usuário logado |
| Aprovado | `approvedProcedure` | `approvalStatus === "approved"` |
| Professor | `professorProcedure` | `role` em `["prof", "coordinator", "admin"]` |
| Coordenador ou Admin | `coordinatorOrAdminProcedure` | `role` em `["coordinator", "admin"]` |
| Admin | `adminProcedure` | `role === "admin"` |

**Acesso a componentes:** Além do papel global, o acesso a turmas e sessões é verificado pelo papel do professor **dentro do componente** (`professor_components.componentRole`):
- `coordinator` do componente: gerencia qualquer turma do componente.
- `prof` do componente: gerencia apenas turmas que criou.
- `admin` global: acesso irrestrito.

**Acesso a avaliação tutorial:** O professor pode avaliar sessões de uma turma se:
- É o criador da turma (`professorUserId`), ou
- É coordenador do componente da turma, ou
- Recebeu permissão explícita via `class_eval_permissions`, ou
- É admin.

---

## 5. Regras de Negócio e Algoritmos

### 5.1 Criação de Sessão

Ao criar uma sessão, o professor define:
- **Número do problema** (`problemNumber`): inteiro ≥ 1.
- **Título do problema** (`problemTitle`): opcional, compartilhado entre todas as sessões do mesmo problema na turma.
- **Alunos presentes**: selecionados da lista da turma. Alunos não selecionados são marcados como ausentes.
- **Papéis**: cada aluno recebe um papel — `COORDENADOR`, `MESA`, `QUADRO` ou `PARTICIPANTE`. Apenas um aluno pode ter cada um dos papéis especiais.

**Numeração automática:**
- O sistema calcula `nextProblemNumber` e `nextSessionNumber` com base nas sessões existentes.
- Se o professor criar uma nova sessão para um problema já existente, `sessionNumber` é incrementado.
- Se criar para um novo problema, `sessionNumber` começa em 1.
- Após exclusão da última sessão de uma sequência, a próxima sessão criada recebe o mesmo número da excluída.

**Label:** gerado automaticamente como `P{problemNumber}S{sessionNumber}` (ex: `P1S2`).

**Propagação de título:** ao definir ou alterar o título de um problema, o sistema atualiza o `problemTitle` em todas as sessões do mesmo problema na turma.

### 5.2 Abertura de Sessão

Ao abrir uma sessão (`initiated → open`):
1. Gerado código de acesso alfanumérico de 8 caracteres (único no banco).
2. Tokens individuais gerados para cada aluno presente (para envio de links diretos por e-mail).
3. Opcionalmente, e-mails enviados a todos os alunos com o link de acesso direto.

### 5.3 Fechamento de Sessão

Ao fechar uma sessão (`open → closed`):
1. Alunos presentes que não submeteram avaliação recebem avaliação automática com **notas máximas** (`Excelente` em todos os critérios, `desempenhoPapel = 0`). Essas avaliações são marcadas com `autoFilled = true`.
2. `closedAt` é registrado.
3. Notas provisórias passam a ser calculadas (usando `calculateSessionResultsWithDefaults`).

### 5.4 Encerramento de Sessão

Ao encerrar uma sessão (`closed → finished`):
1. O professor deve ter submetido a avaliação tutorial (ou ela é submetida automaticamente com notas máximas se não houver submissão).
2. Status muda para `finished`.
3. Notas finais são calculadas.

### 5.5 Algoritmo de Cálculo de Notas de Pares (`calculateSessionResults`)

**Entrada:** `sessionId`

**Passo 1 — Coleta de dados:**
- Buscar todos os registros de `session_students` para a sessão.
- Identificar alunos presentes e ausentes.
- Buscar todas as avaliações (`evaluations`) e itens (`evaluation_items`) da sessão.

**Passo 2 — Avaliadores ausentes:**
- Para cada aluno presente que **não submeteu** avaliação (`missingEvaluators`), criar itens virtuais com notas máximas para todos os seus pares presentes. Isso evita que a ausência de um avaliador prejudique os avaliados.

**Passo 3 — Filtrar avaliações de ausentes:**
- Itens de avaliadores marcados como ausentes são descartados.

**Passo 4 — Determinação de papéis:**
- Para cada aluno avaliado, contar quantas vezes cada papel foi atribuído pelos avaliadores.
- Atribuir os papéis exclusivos (`COORDENADOR`, `MESA`, `QUADRO`) ao aluno com maior contagem para aquele papel, sem repetição.
- Alunos sem papel exclusivo recebem `PARTICIPANTE`.

**Passo 5 — Cálculo da pontuação por aluno:**

Para cada aluno presente, calcular a média das notas recebidas dos pares:

```
score_por_avaliador = pontualidade × 1
                    + pesquisaMetas × 3
                    + dominio × 3
                    + participacao × 3
                    - desempenhoPapel × 1

totalScore = média(score_por_avaliador) de todos os avaliadores válidos
```

Valores possíveis para cada critério: `0.00`, `0.25`, `0.50`, `0.75`, `1.00`.

Portanto, `score_por_avaliador` varia de `-1.0` (todos mínimos, penalidade máxima) a `10.0` (todos máximos, penalidade zero).

**Casos especiais:**
- Aluno ausente: `totalScore = 0`, `role = "FALTOU"`.
- Aluno sem avaliadores (turma com 1 aluno): `totalScore = 10.0`.

**Resultado:** lista de `SessionResult` com `studentId`, `studentName`, `role`, `totalScore`, `validEvaluations`, `absent`, `excluded`.

### 5.6 Algoritmo de Notas Provisórias (`calculateSessionResultsWithDefaults`)

Usado para sessões no estado `closed` (antes do encerramento). Idêntico a `calculateSessionResults`, exceto que alunos sem avaliação recebem itens virtuais com notas máximas (em vez de apenas os avaliadores ausentes).

### 5.7 Algoritmo de Nota de Desempenho (`calculateDesempenhoScores`)

**Entrada:** `sessionId`, `provisional` (boolean)

**Passo 1:** Calcular `peerResults` via `calculateSessionResults` (ou `WithDefaults` se provisional).

**Passo 2:** Buscar `tutorialEvaluation` para a sessão.

**Se não há avaliação tutorial e não é provisional:** retornar `desempenhoScore = 0` para todos.

**Se não há avaliação tutorial e é provisional:** usar `tutorialGrade = 10.0` (máximo provisório).

**Se há avaliação tutorial:**

```
tutorialGrade = calculateTutorialGrade(tutorialEval)
```

**Passo 3 — Distribuição proporcional:**

```
presentStudents = alunos com totalScore > 0 e não ausentes
numPresent = count(presentStudents)
totalPoints = tutorialGrade × numPresent
sumPeerScores = soma(totalScore de presentStudents)

Para cada aluno presente:
  proportion = totalScore / sumPeerScores
  desempenhoScore = min(10.0, round(proportion × totalPoints, 1))

Para alunos ausentes ou totalScore = 0:
  desempenhoScore = 0
```

O `desempenhoScore` é limitado a `10.0`.

### 5.8 Algoritmo de Nota Tutorial (`calculateTutorialGrade`)

```
tutorialGrade = organizacao × 1
              + cooperacao × 1
              + conteudo × 3
              + objetivo × 3
              + metas × 2
```

Cada critério varia de `0.00` a `1.00`, portanto `tutorialGrade` varia de `0.0` a `10.0`.

### 5.9 Algoritmo de Resultados por Problema (`calculateProblemResults`)

Agrega os resultados de todas as sessões de um mesmo problema:

```
Para cada aluno da turma:
  sessionScores = []
  Para cada sessão do problema (ordenadas por sessionNumber):
    se aluno não está nos resultados e não está na turma: null (excluído)
    se aluno não está nos resultados mas está na turma: 0 (ausente)
    se aluno está excluído: null
    senão: totalScore da sessão

  validScores = sessionScores filtrados (excluindo null)
  average = soma(validScores) / totalSessions  ← divisor é o TOTAL de sessões, não apenas as válidas
```

**Importante:** sessões excluídas contam como `0` no denominador da média, não são ignoradas.

### 5.10 Relatório Consolidado por Aluno (`getStudentConsolidatedReport`)

Para cada aluno da turma, agrega todas as sessões de todas as sessões da turma:

```
Para cada sessão da turma:
  desempenhoScores = calculateDesempenhoScores(sessionId, isProvisional)
  isProvisional = (status === "closed")

Para cada aluno:
  sessions = lista de {sessionId, label, peerScore, desempenhoScore, role, absent, excluded}
  presentSessions = sessões onde !absent && !excluded
  avgPeerScore = soma(peerScore de presentSessions) / totalSessions
  mediaDesempenho = min(10.0, soma(desempenhoScore de presentSessions) / totalSessions)
```

### 5.11 Reavaliação de Papel Mesa

Após o encerramento de uma sessão, apenas o aluno com papel **MESA** pode ser reavaliado. Qualquer aluno que esteve presente (independentemente de ter submetido avaliação) pode reavaliar o papel Mesa. A reavaliação atualiza apenas o campo `desempenhoPapel` da avaliação existente ou cria uma nova avaliação se não houver.

### 5.12 Marcação de Falta Retroativa

Após o fechamento de uma sessão, o professor pode marcar alunos como ausentes:
- O sistema usa `getSessionStudentsWithFallback`: busca registros em `session_students` e faz merge com todos os alunos da turma. Alunos sem registro aparecem com `absent: false` (presentes por padrão).
- Ao marcar falta, o registro em `session_students` é atualizado ou criado com `absent: true`.
- O professor pode também marcar a falta como **justificada** (`justifiedAbsent: true`), sem necessidade de documentos.

---

## 6. Fluxos de Interface — Área do Professor

### 6.1 Layout Geral

Todas as páginas da área do professor usam um layout de **painel lateral** (`DashboardLayout`) com:
- Barra lateral esquerda com navegação por ícones e rótulos.
- Cabeçalho com seletores globais de **componente** e **turma** (persistidos em contexto React e `localStorage`).
- Área de conteúdo principal à direita.

**Persistência de filtros:** as seleções de componente, turma e semestre são armazenadas em `localStorage` e sincronizadas via `ClassContext` e `ComponentContext`. Ao navegar entre páginas, os filtros são mantidos.

### 6.2 Página Inicial (Dashboard — `/`)

Exibe um resumo do estado atual:
- Cards com contagem de turmas, sessões abertas, sessões fechadas e alunos.
- Lista de sessões abertas com link para avaliação.
- Atalhos para as principais ações.

### 6.3 Componentes (`/components`)

Gerenciamento de componentes curriculares. Apenas coordenadores e admins podem criar componentes. Professores podem solicitar entrada em componentes existentes.

**Fluxo de solicitação:**
1. Professor clica em "Solicitar entrada" em um componente.
2. Coordenador do componente recebe notificação e aprova ou rejeita.
3. Após aprovação, professor acessa turmas e sessões do componente.

**Promoção/rebaixamento:** coordenador pode promover professores a coordenador ou rebaixar coordenadores a professor dentro do componente.

### 6.4 Turmas (`/classes`)

Gerenciamento de turmas. O seletor de componente e semestre filtra a lista.

**Criação de turma:**
- Campos: código da turma (ex: `TP01`), componente, semestre (dois campos: ano + número do semestre), professor responsável.
- Semestre no formato `ANO.SEMESTRE` (ex: `2026.1`).

**Ações disponíveis:** editar, excluir turma, gerenciar permissões de avaliação (autorizar outros professores a avaliar sessões da turma).

### 6.5 Alunos (`/students`)

Gerenciamento de alunos de uma turma. O seletor de turma filtra a lista.

**Adição manual:**
- Campos: nome, matrícula, e-mail (opcional).
- Se matrícula já existe com dados diferentes, o sistema alerta e oferece importar dados existentes.

**Importação CSV:**
- Formato esperado: `nome;matrícula;email` (separador `;`).
- Conflitos de matrícula com dados divergentes são reportados ao professor.

**Transferência de alunos:** alunos podem ser transferidos entre turmas do mesmo componente.

**Exportação:** lista de alunos exportável em CSV ou PDF com foto (para uso em sala).

### 6.6 Sessões (`/sessions`)

Página central de gerenciamento de sessões. Filtros por status (`Todas`, `Iniciada`, `Aberta`, `Fechada`, `Encerrada`).

**Criação de sessão (diálogo):**
- Número do problema (preenchido automaticamente).
- Título do problema (preenchido automaticamente se já existe para o problema).
- Lista de alunos da turma com checkboxes para presença e seletor de papel.
- Papéis especiais (`COORDENADOR`, `MESA`, `QUADRO`) são exclusivos (apenas um por sessão).
- Pré-visualização do formulário de avaliação antes de criar.

**Card de sessão:** exibe label, status, data de realização (usando `closedAt` se disponível, senão `createdAt`), número de alunos e ações disponíveis conforme o status.

**Ações por status:**

| Status | Ações disponíveis |
|---|---|
| `initiated` | Abrir sessão, Editar atribuições, Excluir |
| `open` | Fechar sessão, Ver código, Reenviar e-mails |
| `closed` | Encerrar sessão, Marcar falta, Editar atribuições |
| `finished` | Marcar falta, Ver resultados |

**Marcar falta (diálogo):** exibe todos os alunos da turma (via merge com `session_students`). Professor pode marcar ausência e indicar se é justificada.

**Resumo de papéis:** exibe quantas vezes cada aluno desempenhou cada papel em todas as sessões da turma.

### 6.7 Avaliar Tutorial (`/tutorial-eval`)

Página para o professor submeter a avaliação tutorial de uma sessão.

**Seleção de sessão:** lista todas as sessões criadas (não apenas as encerradas). Sessões já avaliadas são marcadas com ícone de verificação.

**Formulário de avaliação (5 critérios):**

| Critério | Peso | Gênero |
|---|---|---|
| Organização | 1 | Feminino |
| Cooperação | 1 | Feminino |
| Discussão (Conteúdo) | 3 | Feminino |
| Progresso (Objetivo) | 3 | Masculino |
| Metas | 2 | Feminino |

Cada critério usa um **slider** com 5 posições: `Nenhuma/Nenhum` (0), `Fraca/Fraco` (0.25), `Razoável` (0.5), `Boa/Bom` (0.75), `Excelente` (1.0). O padrão inicial é `Excelente` (1.0).

**Notas por aluno:** o professor pode adicionar pontos positivos e negativos textuais para cada aluno presente.

**Rascunho:** o professor pode salvar rascunho antes de submeter. O rascunho é carregado automaticamente ao abrir a página.

**Submissão:** ao submeter, a sessão muda para `finished` se estava `closed`. Se a sessão já estava `finished`, apenas a avaliação é atualizada.

**Permissões:** o professor só vê sessões de turmas às quais tem acesso (criador, coordenador do componente, ou autorizado via `class_eval_permissions`).

### 6.8 Resultados (`/results`)

Página de consulta de resultados com três abas:

**Aba "Por Sessão":**
- Seletor de sessão com badge de data.
- Tabela de notas de pares: todos os alunos (presentes e ausentes). Ausentes exibem `F` em vez de nota.
- Tabela de notas de desempenho: `peerScore`, `desempenhoScore`, papel, status.
- Exportação em PDF e CSV.

**Aba "Por Problema":**
- Seletor de problema.
- Tabela com colunas por sessão e média do problema.
- Exportação em PDF e CSV.

**Aba "Consolidado por Aluno":**
- Tabela com todas as sessões e médias gerais.
- Exportação em PDF e CSV.

**Exportações multi-turma:** disponíveis para coordenadores e admins, agregando dados de todas as turmas de um componente/semestre.

### 6.9 Professores (`/professors`) — Admin

Gerenciamento de usuários professores:
- Lista de professores pendentes de aprovação.
- Aprovação/rejeição de cadastros.
- Exclusão de professores.
- Visualização de componentes de cada professor.

### 6.10 Configuração SMTP (`/smtp-config`) — Admin

Formulário para configurar o servidor de e-mail:
- Host, porta, TLS, usuário, senha, e-mail remetente, nome remetente.
- Botão de teste de conexão.

### 6.11 Perfil (`/profile`)

- Alteração de nome.
- Alteração de e-mail (com verificação por código).
- Alteração de senha.

### 6.12 Log de Auditoria (`/audit-log`) — Admin

Tabela com todas as ações registradas no sistema, com filtros por usuário, ação e período.

### 6.13 Notificações (`/notifications`)

Lista de notificações recebidas (novas solicitações de entrada em componentes, aprovações, etc.). Marcação como lida individual ou em massa.

### 6.14 Contato (`/contact`)

Formulário para envio de chamados de suporte (bug ou solicitação de funcionalidade). Admin visualiza e resolve os chamados.

### 6.15 Backup (`/backup`) — Admin

Exportação do banco de dados completo em JSON. O arquivo inclui:
- Metadados: `exportedAt`, `schemaVersion`, `tableCount`, `totalRows`.
- Dados de todas as 25 tabelas.

### 6.16 Restauração (`/restauracao`) — Admin

Importação de arquivo JSON de backup:
- Preview do arquivo antes de importar: data de exportação, versão do schema, contagem de tabelas e linhas.
- Aviso se a versão do schema do backup difere da versão atual.
- Confirmação com texto digitado pelo usuário.
- Após importação: exibição de avisos por tabela (erros não críticos).

### 6.17 Perfil de Aluno (`/admin/aluno/:studentId`)

Página de visualização do perfil completo de um aluno:
- Foto, nome, matrícula, e-mail.
- Histórico de avaliações em todas as sessões.
- Notas recebidas por sessão.

### 6.18 Visualização do Brainstorm (`/brainstorm/:sessionId`)

Visualização somente leitura do quadro de brainstorm de uma sessão pelo professor. O professor pode adicionar comentários no quadro.

---

## 7. Fluxos de Interface — Área do Aluno

### 7.1 Página de Acesso (`/acesso`)

Página pública, sem layout de painel. Fluxo de estados:

```
login → setupProfile → verifySetupEmail → dashboard
login → verifyCode → dashboard
dashboard → evaluate → done → dashboard
dashboard → editProfile → dashboard
dashboard → brainstorm → dashboard
```

**Estado `login`:**
- Campo de matrícula.
- Checkbox "Lembrar-me" (TTL de 24h vs 3h).
- Ao submeter: verifica matrícula, determina próximo estado.

**Estado `setupProfile`** (primeiro acesso):
- Campo de e-mail.
- Upload de foto (câmera ou arquivo). A foto é redimensionada para quadrado antes do upload.
- Ao submeter: envia código de verificação ao e-mail.

**Estado `verifySetupEmail`:**
- Campo para código de 6 dígitos.
- Reenvio de código disponível.
- Ao verificar: cria perfil e autentica.

**Estado `verifyCode`** (acessos subsequentes):
- Campo para código de 6 dígitos enviado ao e-mail mascarado.
- Reenvio disponível.

**Estado `dashboard`:**
- Exibe nome, foto e matrícula do aluno.
- Lista de turmas do aluno.
- Lista de sessões abertas disponíveis para avaliação.
- Histórico de avaliações anteriores com notas recebidas.
- Botão para editar perfil.
- Botão para acessar brainstorm (se sessão aberta com papel MESA).

**Estado `evaluate`:**
- Exibe lista de colegas presentes na sessão (exceto o próprio aluno).
- Para cada colega: formulário com 5 critérios (sliders).
- Critério `desempenhoPapel` exibido apenas para alunos com papel especial (`COORDENADOR`, `MESA`, `QUADRO`).
- Exibição em tempo real da pontuação calculada para cada colega.
- Ao submeter: avaliação registrada, aluno vai para estado `done`.

**Estado `done`:**
- Confirmação de envio.
- Exibe notas provisórias recebidas (se disponíveis).
- Botão para voltar ao dashboard.

**Estado `brainstorm`:**
- Exibe o quadro de brainstorm da sessão.
- Aluno MESA pode editar; outros alunos têm acesso somente leitura.

**Estado `editProfile`:**
- Alteração de e-mail (com verificação por código).
- Substituição de foto.

### 7.2 Critérios de Avaliação de Pares (Interface)

Cada critério usa um **slider** com 5 posições nomeadas. O layout é:
- Rótulo do critério com peso (ex: `Pesquisa / Metas — Peso 3`).
- Barra deslizante com 5 pontos marcados.
- Nome do conceito nas extremidades e no ponto selecionado.
- Tooltip com descrição detalhada de cada conceito.
- Pontuação calculada exibida em tempo real.

**Conceitos e valores:**

| Conceito | Valor |
|---|---|
| Nenhuma/Nenhum | 0.00 |
| Fraca/Fraco | 0.25 |
| Razoável | 0.50 |
| Boa/Bom | 0.75 |
| Excelente | 1.00 |

O gênero dos conceitos varia por critério: `dominio` e `participacao` usam masculino; os demais usam feminino.

**Desempenho no Papel** é exibido apenas para alunos com papel especial e tem peso **negativo** (`-1`). O tooltip explica que é uma penalidade para comportamentos esperados.

### 7.3 Página de Avaliação Direta (`/avaliacao`)

Acesso via link com token (`?token=XYZ`). Autentica o aluno diretamente e exibe o formulário de avaliação da sessão correspondente ao token. Mesma interface do estado `evaluate` em `/acesso`.

---

## 8. Módulo de Relatórios e Exportações

### 8.1 Formatos Disponíveis

Todos os relatórios são gerados **no frontend** (client-side) usando a biblioteca `jsPDF` para PDF e geração manual de CSV.

### 8.2 Relatório PDF por Sessão

**Conteúdo:**
- Cabeçalho: componente, turma, semestre, label da sessão, data da sessão (formato `DD/MM/AAAA`).
- Tabela de notas de pares: colunas `Nome`, `Matrícula`, `Papel`, `Pontuação`, `Avaliações`.
- Tabela de notas de desempenho: colunas `Nome`, `Matrícula`, `Papel`, `Nota Par`, `Nota Desempenho`.
- Rodapé com data de geração.

### 8.3 Relatório CSV por Sessão

- Linha de cabeçalho com metadados (componente, turma, semestre, sessão, data).
- Linhas de dados: `Nome;Matrícula;Papel;Nota Par;Nota Desempenho`.

### 8.4 Relatório PDF por Problema

**Conteúdo:**
- Cabeçalho com componente, turma, semestre, número e título do problema.
- Colunas: `Nome`, `Matrícula`, e uma coluna por sessão com data entre parênteses (ex: `P1S1 (15/03/2026)`), mais coluna `Média`.
- Alunos excluídos exibem `E`; ausentes exibem `F`.

### 8.5 Relatório CSV por Problema

- Cabeçalho com metadados.
- Colunas: `Nome;Matrícula;S1 (DD/MM/AAAA);S2 (DD/MM/AAAA);...;Média`.

### 8.6 Relatório PDF Consolidado por Aluno

- Uma tabela por turma com todas as sessões.
- Colunas: `Nome`, `Matrícula`, e uma coluna por sessão com data, mais `Média Par` e `Média Desempenho`.
- Sessões provisórias (status `closed`) marcadas com asterisco.

### 8.7 Relatórios Multi-Turma

Disponíveis para coordenadores e admins. Agregam dados de todas as turmas de um componente/semestre em um único documento.

### 8.8 Envio de Notas por E-mail

O professor pode enviar as notas de uma sessão por e-mail a todos os alunos. O e-mail contém:
- Nota de pares recebida.
- Nota de desempenho.
- Papel desempenhado.
- Link para o quadro de brainstorm.

---

## 9. Módulo de Brainstorm (Quadro Digital)

### 9.1 Estrutura do Quadro

O quadro é dividido em 4 seções, cada uma com seus estados possíveis:

| Seção | Estados dos Itens |
|---|---|
| **Ideias** | `analise`, `aceita`, `descartada` |
| **Fatos** | `verificar`, `confirmado`, `inexato` |
| **Questões** | `duvida`, `investigacao`, `respondida` |
| **Metas** | `planejada`, `em_andamento`, `concluida` |

### 9.2 Permissões de Edição

- O aluno com papel **MESA** pode editar o quadro enquanto a sessão não está `finished`.
- Outros alunos têm acesso somente leitura.
- O professor pode adicionar comentários no campo `tutorComments`.

### 9.3 Anexos

Cada item pode ter múltiplos anexos dos tipos: `link`, `image`, `video`, `photo`, `document`. Fotos são enviadas ao S3.

### 9.4 Compartilhamento

O quadro pode ser compartilhado com sessões do mesmo componente. O histórico de envios por e-mail é registrado em `brainstorm_board_send_history`.

---

## 10. Módulo de E-mail e Notificações

### 10.1 Configuração SMTP

O sistema usa um servidor SMTP configurado pelo admin. A configuração é armazenada em `smtp_config`. Sem SMTP configurado, funcionalidades de e-mail ficam indisponíveis (exceto para o primeiro usuário no cadastro).

### 10.2 E-mails Enviados pelo Sistema

| Evento | Destinatário | Conteúdo |
|---|---|---|
| Verificação de e-mail (cadastro professor) | Professor | Código de 6 dígitos, válido 15 min |
| Recuperação de senha | Professor | Código de 6 dígitos, válido 15 min |
| Verificação de e-mail (aluno) | Aluno | Código de 6 dígitos, válido 15 min |
| Abertura de sessão | Alunos da sessão | Link de acesso direto com token |
| Notas de sessão | Alunos da sessão | Notas de pares e desempenho |
| Quadro de brainstorm | Alunos da sessão | Link para o quadro |

### 10.3 Notificações Internas

Notificações são criadas automaticamente para:
- Nova solicitação de entrada em componente (destinatário: coordenador do componente).
- Aprovação/rejeição de solicitação (destinatário: professor solicitante).
- Novo cadastro de professor (destinatário: admin e coordenadores).

---

## 11. Módulo de Backup e Restauração

### 11.1 Exportação

O admin pode exportar o banco completo em JSON. O arquivo contém:

```json
{
  "exportedAt": "2026-03-28T00:00:00.000Z",
  "schemaVersion": 42,
  "tableCount": 25,
  "totalRows": 1500,
  "tables": {
    "users": [...],
    "components": [...],
    ...
  }
}
```

A `schemaVersion` é o número de migrations aplicadas ao banco.

### 11.2 Importação

O processo de restauração:
1. Limpar todas as tabelas na ordem inversa das dependências (para evitar violações de FK).
2. Reinserir os dados de cada tabela na ordem correta.
3. Normalizar timestamps: strings ISO são convertidas para objetos `Date`.
4. Erros em tabelas individuais são coletados como `warnings` e não abortam a importação.
5. Após importação, exibir resumo: tabelas importadas, linhas importadas, avisos.

**Ordem de limpeza (inversa das dependências):**
`brainstorm_board_send_history` → `brainstorm_item_attachments` → `brainstorm_items` → `brainstorm_boards` → `session_access_tokens` → `professor_student_notes` → `contact_tickets` → `notifications` → `audit_logs` → `email_verification_codes` → `password_reset_codes` → `smtp_config` → `class_eval_permissions` → `tutorial_eval_drafts` → `tutorial_evaluations` → `evaluation_items` → `evaluations` → `session_students` → `sessions` → `class_students` → `classes` → `students` → `professor_components` → `components` → `users`

---

## 12. Módulo Administrativo

### 12.1 Painel do Admin

O admin tem acesso a todas as funcionalidades do sistema, além de:
- Aprovação/rejeição de professores.
- Adição e remoção de componentes.
- Configuração SMTP.
- Backup e restauração.
- Log de auditoria completo.
- Resolução de chamados de suporte.

### 12.2 Auditoria

Todas as ações relevantes são registradas em `audit_logs` com:
- `userId`: quem executou.
- `action`: código da ação (ex: `session.create`, `student.import`, `backup.export`).
- `details`: JSON com contexto adicional (ex: IDs afetados, contagens).

---

## 13. Contextos Globais e Persistência de Filtros

### 13.1 ClassContext

Mantém o estado global de:
- `selectedComponentId`: componente selecionado.
- `selectedClassId`: turma selecionada.
- `selectedSemester`: semestre selecionado.

Persistido em `localStorage`. Sincronizado entre todas as páginas via contexto React.

### 13.2 ComponentContext

Mantém:
- `selectedComponentId`: componente selecionado no seletor de componente.

Compartilhado com `ClassContext` para manter consistência.

### 13.3 Comportamento de Persistência

Ao mudar o filtro de semestre e/ou turma em qualquer página, a seleção é automaticamente refletida em todas as outras páginas do sistema. Isso evita que o professor precise reselecionar a turma ao navegar entre Sessões, Alunos e Resultados.

---

*Documento gerado automaticamente a partir do código-fonte do sistema. Versão do schema: 42 migrations. Última atualização: março de 2026.*
