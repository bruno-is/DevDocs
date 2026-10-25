# TECH_DECISIONS

Decisões de stack do rebuild do DevDocs e o porquê de cada uma. Versões
confirmadas no npm em julho/2026 antes de instalar (o ecossistema muda rápido).

## Stack final (versões instaladas)

| Camada              | Escolha                                      | Versão           | Nota                                                                                          |
| ------------------- | -------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------- |
| Framework           | **Astro**                                    | `^7.0.6`         | Estável mais recente — **não** a v5 do plano original (ver desvio 1). SSG, islands.           |
| UI interativa       | **Vue 3** + `@astrojs/vue`                   | `3.5` / `^7.0.1` | Preferência do usuário.                                                                       |
| Conteúdo            | **Content Collections** (Content Layer API)  | —                | `glob()` loader sobre YAML, schema Zod. Config em `src/content.config.ts`.                    |
| Estilo              | **Tailwind CSS v4**                          | `^4.3.2`         | Config CSS-first (`@theme`) via `@tailwindcss/vite`.                                          |
| Realce de código    | **Shiki** (nativo do Astro)                  | —                | Componente `<Code>` em build-time, tema `github-dark-default` fundido à superfície.           |
| Transição de página | **`<ClientRouter />`** (`astro:transitions`) | —                | Nome atual (renomeado de `<ViewTransitions />`).                                              |
| Scroll reveal       | **GSAP + ScrollTrigger**                     | `^3.15.0`        | Zona de descoberta.                                                                           |
| Busca               | **Pagefind**                                 | `^1.5.2`         | Índice estático no build; roda em `npm run build`.                                            |
| Ícones              | **Iconify** via `astro-icon`                 | `^1.1.5`         | Sets `lucide` + `simple-icons`, tree-shaken.                                                  |
| Fontes              | **Fontsource** (self-hosted)                 | `5.x`            | Space Grotesk (display), Onest (corpo), JetBrains Mono (código). Todas OFL, offline, sem CDN. |
| Qualidade           | TypeScript strict, Prettier, `astro check`   | TS `^6`          | —                                                                                             |

## Hospedagem

GitHub Pages (`bruno-is/DevDocs`): `site: https://bruno-is.github.io`, `base: /DevDocs`.
Deploy por GitHub Actions (`.github/workflows/deploy.yml`), com Pagefind rodando
dentro do build. Links internos sempre via helpers em `src/lib/paths.ts`
(`withBase`, `docUrl`, `techUrl`) — o Astro não prefixa `base` automaticamente.

## Desvios do plano inicial (documentados, como pedido)

1. **Astro 7, não 5.** A tabela do plano dizia "Astro (estável mais recente)";
   na prática a estável é a **v7**. APIs verificadas na doc oficial antes de usar
   (config de collections em `src/content.config.ts`, `glob` de `astro/loaders`,
   `<ClientRouter />`).

2. **Conteúdo como coleção de dados YAML tipada — não MDX em prosa.** O conteúdo
   legado já era **estruturado** (`sections → entries → callouts/contentBlocks`),
   não prosa. Migrar para MDX achataria a semântica. Optou-se por YAML validado
   por Zod (decisão confirmada com o usuário). Migração automática e verificável
   em `scripts/migrate-content.mjs` (round-trip + contagens).

3. **Lenis (smooth scroll) removido.** Conflita com o **deep-link por hash das
   seções**, que é central na navegação das docs (sequestra a posição de scroll,
   atrapalha restauração e âncoras). Mantivemos GSAP+ScrollTrigger para as
   revelações; o scroll é nativo. Ganho de robustez > o polimento do smooth-scroll
   para uma ferramenta de leitura.

4. **Command palette custom (Vue) em vez do Dialog do shadcn-vue/Reka UI.**
   `reka-ui` está instalado, mas a palette Cmd+K é bastante específica (Pagefind,
   sub-results, navegação por teclado). Um componente Vue próprio, acessível
   (role=dialog, aria-modal, foco, Escape, setas), evita depender de detalhes de
   API que mudam e entrega exatamente o comportamento desejado.

5. **`motion-v` instalado mas ainda não usado.** As microinterações atuais são
   cobertas por CSS/transições e GSAP. Fica disponível para quando houver uma
   microinteração declarativa que justifique.

## Zonas de animação

- **Descoberta** (home, landings): revelações fade+translate no scroll (GSAP),
  `[data-reveal]`. Rede de segurança garante que nenhum conteúdo fique invisível.
- **Leitura** (docs): scroll nativo, sem storytelling; só a troca de seção
  (instantânea) e a barra de progresso.
- `prefers-reduced-motion: reduce` desliga tudo globalmente (CSS) e nos scripts.

## Progressive enhancement

A troca de seção esconde as inativas **via classe** (`.reader-js` gate), não via
`hidden`, para não afetar a indexação estática do Pagefind e manter tudo legível
sem JS.

## Formação em sistemas de dados (outubro/2026)

- **Mesma coleção, extensão aditiva.** As unidades de estudo usam `tech: sistemas`
  e `learning` opcional. Slugs, schema básico e URLs dos guias anteriores são
  preservados. Uma landing estática específica substitui somente a landing
  genérica dessa nova tecnologia. Sua orientação editorial também vem de YAML.
- **Uma ordem.** `order` e `learning.prerequisites` alimentam mapa, links anteriores/
  próximos e validação do grafo. O build recusa referências ausentes, dependências
  futuras/cíclicas e ordens duplicadas. Não existe uma segunda lista de aulas no UI.
- **Leitura e consulta.** Narrativa é o padrão inicial das aulas; a preferência do
  leitor continua disponível. Seções continuam indexadas por Pagefind e têm hashes
  estáveis. Metadados repetidos de navegação ficam fora do índice das aulas.
- **Blocos sem runtime pesado.** Fluxos anotados em listas ordenadas com legenda
  representam sequências, sem sugerir arestas arbitrárias. Comparações e topologias
  usam blocos existentes. Exercícios com resposta comentada usam `details/summary`;
  referências têm HTTPS validado no schema. Nenhum renderer executa conteúdo YAML.
- **Progresso privado e limitado.** Marcações locais de autoavaliação, sem login ou
  promessa de competência. Falha de armazenamento degrada para memória da sessão.
- **Experimentos distintos.** O ERP Python demonstra atomicidade e idempotência
  com polling de outbox; o Compose separado demonstra captura de WAL. Não chamamos
  a simulação de CDC. Dependências de containers são versionadas e não apresentadas
  como recomendação de produção. Status de validação fica nos arquivos do laboratório.
- **Publicação.** Corrigido o `site` após confirmar o proprietário remoto atual;
  o `base: /DevDocs` permanece. O workflow existente chama `npm run build`;
  seus hooks `prebuild`/`postbuild` validam currículo e links sem alterar o YAML
  do workflow (a credencial de push disponível não possui escopo `workflow`).
  O ZIP dos laboratórios é determinístico e gerado em Node, sem instalação extra.
