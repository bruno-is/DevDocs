# CONTENT_GAPS

Lacunas de conteúdo identificadas na migração. **Nada aqui foi inventado** — são
tópicos ausentes ou incompletos no projeto legado, sinalizados como TODO conforme
a Fase 5 pediu.

## Cobertura atual

- **Git** — 9 guias de rotina: consulta diária, branches/remotos,
  stash/troca de contexto, worktree, fetch/pull/merge/rebase, conflitos,
  desfazer/recuperar, histórico/commits e tags/releases. O slug
  `git-github-terminal` e seus seis IDs de seção foram preservados.
- **PHP** — 19 guias (núcleo premium concluído: fundamentos, OOP, arrays,
  strings, JSON, HTTP, PDO, sessões, arquivos, CLI, testes, recursos modernos e
  capstone de API).
- **Go** — 15 guias (paridade com PHP: banco de dados com `database/sql`
  (`go-banco-dados.yaml`) e capstone de API com `net/http` (`go-api-json.yaml`);
  os 13 guias originais ganharam fecho reflexivo padronizado — `Decisão Rápida`
  com `reference-card` + `context-block`).

A contagem global da migração não representa o inventário atual: a coleção
também contém JavaScript, Arquitetura e UI, que não faziam parte daquela
contagem. A landing de cada tecnologia calcula guias e seções
diretamente da coleção, evitando usar contagens históricas como inventário.
O conteúdo legado foi migrado com fidelidade verificada por round-trip +
contagens no `scripts/migrate-content.mjs`; todo o conteúdo (migrado e novo)
segue o padrão editorial de `CONTENT_STANDARD.md`.

## Lacunas (TODO — não preencher com conteúdo inventado)

### 🟢 Sistemas — formação entregue

Uma orientação e doze módulos em `sistemas-*.yaml` cobrem fundamentos/capacidade,
storage e planos, transações, modelagem, replicação/consenso, mensageria, CDC,
ciclo de vida, cloud native, confiabilidade, laboratórios e projeto integrador.
Exercícios incluem respostas e critérios; fontes oficiais acompanham os módulos.
Os experimentos locais têm status de validação explícito em
`labs/sistemas/README.md`: execução Docker/Kubernetes requer ambiente com
daemon e cluster disponíveis. Não há equivalência com certificação acadêmica.

Fora do recorte: implementação completa de consenso, operação multi-region real,
benchmark comparativo entre produtos, treinamento de ML e administração exaustiva
de cada fornecedor. Esses assuntos não são anunciados como laboratórios executados.

### 🟢 Git — rotina de equipe coberta

- Nove guias, com 44 seções e 104 entries curtas, organizados por problema.
- Receitas de task, pausa/retomada, atualização de branch, conflitos repetidos,
  reescrita publicada e recuperação com reflog.
- Fora deste recorte: submodules, Git LFS, bisect, hooks, assinatura de commits,
  remoção de segredos de todo o histórico e reversão/cherry-pick de merge com
  escolha de mainline. Acrescentar somente quando surgir demanda concreta.

### 🔴 Vue — ausente

O prompt do rebuild listava Vue como "já documentado", mas **não existe nenhum
conteúdo Vue** no repositório legado. A arquitetura já está pronta para receber
(basta adicionar `src/content/docs/vue-*.yaml` com `tech: vue`); a home passa a
exibir a seção Vue automaticamente quando houver ≥1 doc. Nenhuma página Vue é
mostrada por ora.

### 🟢 PHP — núcleo premium concluído

As lacunas principais de PHP foram cobertas nesta rodada:

- Fundamentos da linguagem (`php-fundamentos.yaml`).
- Testes com PHPUnit (`php-testes.yaml`).
- CLI (`php-cli.yaml`).
- PHP 8+ moderno: enums, `readonly`, attributes e tipos (`php-recursos-modernos.yaml`).
- Capstone de API JSON (`php-api-json.yaml`).
- `include`/`require` manual dentro de `php-composer-autoload.yaml`.

Backlog opcional futuro: páginas dedicadas de performance e segurança se houver
necessidade real, sem perseguir exaustividade artificial.

### 🟢 Go — paridade com PHP concluída

- Banco de dados com `database/sql` (`go-banco-dados.yaml`).
- Capstone de API JSON com `net/http` (`go-api-json.yaml`).
- Fecho reflexivo (`Decisão Rápida`) em todos os 15 guias.

### 🟡 Go — backlog (não iniciado)

- Generics (sintaxe e quando simplifica vs. interface).
- `regexp` (Go não tinha equivalente ao `PHP: Expressões regulares`).
- Tooling: `go vet`, `staticcheck`, `golangci-lint`.
- Polimento de tags/sinônimos de busca (Fase 4 do plano Go, parcialmente aberta).

## Como adicionar uma nova doc

1. Criar `src/content/docs/<tech>-<tema>.yaml` seguindo o schema de
   `src/content.config.ts` (campos `tech` e `order` obrigatórios).
2. `npm run check` valida contra o Zod; `npm run dev` renderiza.
3. A home e a landing da tecnologia se atualizam sozinhas (agrupamento por `tech`).
