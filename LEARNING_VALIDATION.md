# Formação em sistemas — revisão e validação

Data: 25/10/2026. Formação: **Engenharia de Dados & Sistemas Distribuídos**.

## Entrega editorial

Uma orientação e doze unidades de estudo, em 13 YAML independentes: 79 seções,
206 entradas editoriais, 24 exercícios com resposta/rubrica e 13 fluxos anotados.
As referências primárias acompanham os capítulos. Entradas são blocos de uma
aula; essa contagem não representa 206 aulas independentes.

| Sequência | Unidade                          | Resultado esperado                                          |
| --------- | -------------------------------- | ----------------------------------------------------------- |
| 1         | Fundamentos, capacidade e falhas | Relacionar recursos, taxas, filas e resultado desconhecido. |
| 2         | Bancos internos                  | Explicar páginas, índices, planos, manutenção e migrations. |
| 3         | Transações e recuperação         | Proteger invariantes e distinguir MVCC, locks e logs.       |
| 4         | Modelagem por carga              | Escolher representação, cache e armazenamento por acesso.   |
| 5         | Replicação e distribuição        | Justificar confirmação, failover, quorum e sharding.        |
| 6         | Mensageria                       | Projetar confirmação, repetição, contratos, outbox e inbox. |
| 7         | CDC                              | Seguir snapshot, log, cursor, transporte e recuperação.     |
| 8         | Ciclo de vida                    | Comprovar arquivo, reidratação e retenção por finalidade.   |
| 9         | Cloud native                     | Separar reconciliação, persistência e protocolo do banco.   |
| 10        | Confiabilidade                   | Investigar por evidências e ensaiar recuperação.            |
| 11        | Laboratórios integrados          | Executar sete experimentos e registrar limites.             |
| 12        | Projeto integrador               | Defender decisões e provar invariantes de um ERP fictício.  |

O encadeamento foi revisado contra currículos públicos CMU 15-445 e MIT 6.5840
e documentação oficial versionada. Storage/transações precedem replicação e CDC;
containers precedem Kubernetes. A opção por fundamentos compartilhados evita
transformar o currículo num catálogo de produtos. Não há vínculo ou credencial
dessas instituições.

## Aplicação

- Coleção existente estendida com metadados opcionais `learning`; `order` é a
  única sequência de mapa/navegação. Grafo validado no build e nos testes.
- Landing `/sistemas/`, navegação anterior/próximo, objetivos e pré-requisitos.
- Modos de leitura existentes, hashes de seção e busca Pagefind preservados.
- Respostas recolhíveis com HTML nativo, fontes HTTPS e fluxos sem runtime pesado.
- Autoavaliação local com teste de atualização entre abas e fallback de sessão.
- Fontes práticas fora de `public/`; apenas ZIP com lista explícita de fontes
  é publicado. Build falha se algum arquivo necessário estiver ausente.
- `site` corrigido para `bruno-is.github.io`, mantendo `/DevDocs`; origem Pages
  corrigida de `legacy` para `workflow` pela API do GitHub.

## Verificações executadas

- `npm ci --no-audit --no-fund`: dependências do lockfile instaladas.
- `npm run check`: sem erros, avisos ou hints do Astro.
- `npm test`: seis testes aprovados, incluindo referências, ciclos/ordem e
  regressões de progresso em múltiplas abas e quota local indisponível.
- `npm run build`: 75 páginas estáticas; Pagefind indexa 67 guias, incluindo
  as 13 unidades de Sistemas. Permanecem avisos das dependências php-wasm sobre
  módulos Node externalizados e `eval`; não são erros e não foram introduzidos
  pela formação.
- O workflow existente permanece intacto; `prebuild` executa os seis testes de
  currículo/progresso e gera o pacote, enquanto `postbuild` valida os links.
  Os testes Python foram executados localmente, inclusive a partir do ZIP.
- `npm run check:links`: 1.351 links internos/âncoras válidos nas 75 páginas.
- `python -B -m unittest discover -s labs/sistemas -p test_erp.py -v`: dez testes
  aprovados, incluindo HTTP, concorrência, rollback, commit antes do ACK,
  deduplicação, versão antiga, arquivo/restore, timezone e erro de configuração.
- ZIP verificado com `zipfile.testzip`, extraído em pasta temporária e suíte
  executada a partir dos arquivos extraídos. Sem dados SQLite ou caches no pacote.
- `docker compose -f labs/sistemas/compose.yaml config --quiet`: estrutura válida.
  `docker manifest inspect` confirmou as três tags de imagem declaradas.
- Dois snippets JavaScript de capacidade executados e comparados à saída.

Inspeção em navegador sobre o build servido por `npm run preview`:

- Home, landing e CDC sem overflow em 320, 390, 768 e 1.440 px.
- Capturas desktop/mobile revisadas visualmente.
- Busca UI no escopo Sistemas e API Pagefind com filtro de 13 documentos.
- Deep-link `cdc/#snapshot`, modos de leitura, gabaritos e progresso em duas abas.
- Movimento reduzido mantém conteúdo visível; CDC sem JavaScript mantém as seis
  seções legíveis e os exercícios disponíveis.
- PHP, Go, JavaScript, Git e Arquitetura retornaram HTTP 200 e blocos de código.

## Limites experimentais

Docker Desktop foi iniciado, mas seu backend falhou na inicialização do serviço
Inference manager. Não foram executados containers, SQL PostgreSQL, fluxo CDC
real ou cluster Kubernetes; não há benchmark desses ambientes. Configuração,
existência de imagem e execução são evidências distintas, explicitadas no curso.

O mínimo integrado implementado é API Python → SQLite/outbox por polling →
inbox/projeção → arquivo/backup. O Compose PostgreSQL → Debezium → Kafka é um
experimento separado. A API PostgreSQL e o consumidor Kafka materializando uma
projeção são uma extensão arquitetural proposta, não anunciada como implementada.
Os testes locais não demonstram failover físico, isolamento multi-tenant ou
exactly-once de efeitos externos.

## Preservação do trabalho anterior

Implementação criada em worktree/branch `codex/formacao-dados` a partir de
`ed3a972`. As alterações locais de UI em `C:/Dev/DevDocs` não foram copiadas,
descartadas ou incluídas nesta entrega. Nenhum YAML anterior foi alterado.
Publicação e SHA final são registrados no relatório da conversa após a Action.

O primeiro push foi recusado por ausência de escopo OAuth `workflow`. Nenhuma
branch foi criada por essa tentativa. As verificações foram integradas aos hooks
do build e o commit não publicado foi ajustado para preservar o workflow existente.
