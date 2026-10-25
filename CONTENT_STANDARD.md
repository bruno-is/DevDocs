# CONTENT_STANDARD

Padrão editorial para manter o DevDocs consistente sem transformar consulta em
texto inchado. A regra central é simples: cada página deve servir para aprender
em sequência e para consultar rápido por busca/deep-link.

Este documento cobre apenas conteúdo em `src/content/docs/*.yaml`. Layout,
componentes, schema e stack continuam como definidos em `README.md` e
`TECH_DECISIONS.md`.

## Princípios

- Conteúdo vive no YAML; layout fica nos componentes.
- Pt-BR em texto visível, descrições, callouts, tags e placeholders.
- IDs, slugs e caminhos existentes são estáveis. Renomear `id` ou arquivo só com
  decisão explícita, porque isso pode quebrar URLs e deep-links.
- Mais completo não significa mais denso. Prefira entries curtas, uma ideia por
  exemplo, e blocos de apoio no fim.
- Go pode continuar enxuto. PHP pode continuar mais didático. O padrão iguala a
  qualidade mínima, não o tamanho das páginas.
- Git segue formato próprio de cheat sheet: comando certo rápido, bons avisos em
  operações destrutivas e sem virar tutorial longo.

## Entry

Cada entry conceitual deve buscar estes ingredientes:

- `kicker`: o contexto curto ou o critério de uso.
- `description`: quando usar, por que importa e qual cuidado mental guardar.
- `code`: exemplo mínimo, autocontido e sem saída comentada dentro do código.
- `output`: use quando a saída for determinística e ajudar a leitura.
- `callout`: use para armadilhas pontuais, risco real ou dica que evita erro.
- `tags`: termos de busca práticos, incluindo sinônimos prováveis.

`output` não é obrigatório em todo exemplo. Não force saída em código que depende
de banco, rede, arquivo local, tempo, servidor em execução ou estado externo.

## Saída Esperada

Quando um exemplo mostra resultado, a saída deve ficar no campo `output:`.

Correto:

```yaml
code: |-
  <?php
  echo "ok" . PHP_EOL;
output: ok
```

Evite:

```php
/*
Saída:
ok
*/
```

Isso mantém o código limpo para copiar, melhora o sandbox PHP e deixa o componente
`OutputBlock` responsável pela apresentação da saída.

## Estrutura De Página

Use esta ordem como base, ajustando ao tema:

1. `quickStart`: setup mínimo e caminho de teste.
2. Seções nomeadas por conceito, sem numeração no `name`.
3. Núcleo progressivo, do básico ao avançado.
4. Fecho reflexivo quando agregar valor:
   - Decisão Rápida: `reference-card`.
   - Boas Práticas: `checklist-block`.
   - Erros Comuns: `context-block` com `variant: common-error`.
   - Comparações: `comparison-block`.
   - Passo a passo: `flow-steps`.
   - Parâmetros/assinaturas: `tech-list`.

O fecho reflexivo não precisa existir em toda página. Ele entra quando resume
decisões, evita erros recorrentes ou substitui uma busca externa.

## Linguagens

### PHP

- Mantenha exemplos didáticos e de domínio quando isso ajuda o leitor.
- Entradas `runnable` devem ser autocontidas e sem dependência de banco, rede,
  arquivo local ou estado externo.
- Exemplos com saída previsível devem usar `output:`.

### Go

- Preserve o estilo curto de consulta.
- Use fechos enxutos quando eles realmente melhorarem a decisão do leitor.
- Normalize pt-BR no texto visível, mas não renomeie slugs/ids existentes por
  causa disso.

### Git

- Mantenha formato de comando/consulta.
- Use callouts de perigo em comandos destrutivos ou irreversíveis.
- Prefira lacunas de fluxo real, como conflito, `.gitignore`, tags e releases,
  em vez de transformar a página em curso.
- Divida fluxos com riscos ou várias etapas em guias especializados; mantenha
  o guia diário como hub curto, preservando slug e IDs de seção existentes.
- Use `flow-steps` para procedimentos e `comparison-block` para decisões
  (inclusive três alternativas, como stash/commit local/worktree).
- Conceitos e listas não pertencem a blocos de terminal. Use `codeLanguage: text`
  apenas para conteúdo textual literal de arquivo, como marcadores de conflito.
- Inspecione antes de descartar; ofereça dry-run quando o comando suporta.
  Comandos destrutivos exigem callout `danger`; backup de branch não salva
  edições sem commit.
- Tags são indexadas com peso menor que a prosa no Pagefind. Inclua o nome do
  comando e sinônimos do problema, sem depender apenas do quickStart (não indexado).

## Links entre guias

O `reference-card` aceita `links` além de `items`. O destino usa o ID completo
da coleção; a seção é opcional. O componente resolve com `docUrl`, respeita o
base do GitHub Pages e falha no build se o guia ou a seção não existir.

```yaml
contentBlocks:
  - type: reference-card
    title: Continuar este fluxo
    links:
      - label: Resolver conflitos durante rebase
        doc: git-conflitos
        section: rebase
```

Evite inserir HTML ou URLs com `/DevDocs` fixo no YAML. Os rótulos desses
links não entram na busca, para que referências não concorram com o guia alvo.

A busca aberta numa tecnologia ou guia começa nessa tecnologia, com seletor
visível para ampliar para todas. A home continua global. O filtro `tech` do
Pagefind deriva da coleção, sem listas de páginas ou palavras especiais.

## Unidades da formação

`learning` é opcional e não altera guias de consulta existentes. Em `sistemas`,
declare `module`, `level`, `prerequisites` (IDs completos) e `objectives`
verificáveis. `kind` pode ser `orientation`, `chapter` (padrão), `laboratory`
ou `project`. Use `order` único e pré-requisitos anteriores; a validação é
compartilhada pelo build e por `npm test`.

Uma aula deve explicar mecanismo, aplicação, fronteiras de falha e critérios
de decisão. Separe hipótese, resultado esperado e medição. Não publique tempos
fictícios nem apresente configuração revisada como laboratório executado.

- `exercise`: `prompt`, `answer` e `rubric` (lista não vazia). O gabarito é
  recolhível por HTML nativo; explique por que a resposta preserva o contrato.
- `diagram`: `caption` e `nodes` com `label`/`detail`. Representa uma sequência
  anotada em ordem de leitura; topologias com ramificações exigem explicação
  explícita ou os blocos arquiteturais existentes.
- `sources`: `items` com `label` e `url` HTTPS. Prefira fontes primárias
  versionadas. URLs externas pertencem a esse bloco, não a Markdown na prosa.

## Checklist Antes De Propagar (todos os guias)

- `npm run check` passa.
- `npm run build` passa.
- Não há saída esperada comentada dentro de exemplos com `output:` aplicável.
- Seções novas usam nomes conceituais, não numeração.
- Texto novo está em pt-BR.
- IDs e slugs existentes foram preservados, salvo decisão explícita.
