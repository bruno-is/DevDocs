# DevDocs

Biblioteca pessoal de documentações técnicas — escura, fosca e sem ruído, feita
para consulta rápida no dia a dia. Reconstruída com **Astro + Vue** (a versão
antiga em HTML estático `file://` foi substituída).

Publicada em **GitHub Pages**: <https://bruno-is.github.io/DevDocs/>

## Stack

Astro 7 (SSG) · Vue 3 (ilhas) · Tailwind v4 · Content Collections (YAML + Zod) ·
Shiki · GSAP/ScrollTrigger · Pagefind (busca) · astro-icon · Fontsource
(self-hosted). Detalhes e desvios em [`TECH_DECISIONS.md`](./TECH_DECISIONS.md).

## Scripts

```bash
npm run dev       # servidor de desenvolvimento
npm run build     # astro check + astro build + pagefind (índice de busca)
npm run preview   # serve o build em dist/ (necessário para testar a busca)
npm run check     # type-check (astro check)
npm test          # grafo curricular, IDs, exercícios e referências cruzadas
npm run check:links # links e âncoras do dist/ após o build
npm run format    # prettier
```

> A busca (Pagefind) só existe após o `build`. Em `dev` a palette avisa isso.
> Requer **Node 22.12+**.

## Arquitetura

```
src/
  content/docs/*.yaml   # conteúdo: 1 doc por arquivo (schema em content.config.ts)
  content.config.ts     # schema Zod da coleção (fonte única do tipo do conteúdo)
  components/
    docs/               # Entry, CodeBlock, Callout, blocos, SectionNav, pager…
    home/               # Hero, DocCard
    shared/             # Navbar, Footer
    search/             # CommandPalette.vue (Cmd+K, sobre o índice Pagefind)
  layouts/              # BaseLayout, SiteLayout (home/tech), DocLayout (leitura)
  pages/                # /, /[tech]/, /[tech]/[doc]/, 404
  scripts/              # doc-reader (troca de seção), discovery (reveals)
  styles/               # tokens.css (design tokens), globals.css
  lib/                  # paths (base do GH Pages), docs (acesso ao conteúdo), format
```

### Navegação

Home (tecnologias) → `/[tech]/` (guias da tech) → `/[tech]/[doc]/` (intro + menu
de seções). A troca de seção é client-side (sem recarregar, sem rolar por tudo),
com deep-link por hash; a busca leva direto à seção certa.

## Adicionar uma documentação

1. Criar `src/content/docs/<tech>-<tema>.yaml` conforme o schema de
   `src/content.config.ts` (campos `tech` e `order` obrigatórios).
2. `npm run check` valida contra o Zod; `npm run dev` renderiza.
3. A home e a landing da tecnologia se atualizam sozinhas.

Lacunas de conteúdo conhecidas: [`CONTENT_GAPS.md`](./CONTENT_GAPS.md).

## Formação em sistemas de dados

[`/sistemas/`](https://bruno-is.github.io/DevDocs/sistemas/) oferece a formação
**Engenharia de Dados & Sistemas Distribuídos**, sem substituir a biblioteca.
São uma orientação e doze módulos: fundamentos/capacidade, bancos internos,
transações, modelagem, replicação, mensageria, CDC, ciclo de vida, cloud native,
confiabilidade, laboratórios e projeto integrador.

Conteúdo e metadados vivem em `src/content/docs/sistemas-*.yaml`. O campo
opcional `learning` declara módulo, nível, objetivos, pré-requisitos e tipo de
unidade. O `order` da doc é a única ordem do mapa e da navegação sequencial.
O build rejeita pré-requisitos inválidos, ciclos e ordens ambíguas. Novos blocos
`diagram`, `exercise` e `sources` usam HTML estático acessível; respostas abrem
com `<details>`, sem dependência de diagramação em runtime.

O progresso é uma autoavaliação armazenada em `localStorage`, com fallback de
sessão. Não há backend, conta, certificado ou avaliação automática de domínio.
Os modos `narrative` e `panels` e a busca Pagefind continuam disponíveis.

Arquivos reproduzíveis e instruções: [`labs/sistemas/README.md`](./labs/sistemas/README.md).
O `prebuild` gera automaticamente `public/labs/sistemas.zip`, sem incluir dados
locais ou caches. Somente o ZIP é publicado; os arquivos de trabalho ficam fora
de `public/`. O ambiente Python stdlib exercita outbox/inbox por polling;
o Compose separado fornece PostgreSQL/Debezium/Kafka para CDC real. O README
dos laboratórios diferencia configuração validada de execução efetivamente testada.

## Histórico

`codex/` e `README_DOCS.md` são referência **histórica** do projeto
antigo (HTML `file://`). O conteúdo foi migrado com fidelidade verificada por
`scripts/migrate-content.mjs` (289 entries · 107 callouts · 306 blocos de código).
