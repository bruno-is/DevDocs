# Laboratórios — Engenharia de Dados & Sistemas Distribuídos

Dados inteiramente sintéticos. Execute numa pasta local e num contexto Kubernetes
de desenvolvimento. Há dois ambientes independentes: o ERP Python demonstra
outbox/inbox por **polling**, e o Compose demonstra **CDC de WAL real**.
Não confunda as garantias de um com as do outro.

## Estado de validação desta entrega

- `python -m unittest -v`: **10 testes passaram**: commit atômico,
  repetição da requisição, duas janelas de crash, versão fora de ordem,
  arquivo/reidratação/corrupção, backup/replay, oito requisições simultâneas,
  API HTTP local, normalização de timezone no arquivo e rejeição imediata de erro
  HTTP de configuração do conector. Testes usam arquivos temporários e apagam apenas esses arquivos.
- `docker compose config --quiet`: **estrutura Compose validada**. Imagens, SQL
  PostgreSQL, conector e manifesto Kubernetes foram revisados, mas **não executados**
  neste ambiente: o backend Docker Desktop não inicializou. Validar estrutura
  não prova que imagens sobem nem que o CDC funciona.
- As tags remotas PostgreSQL 17.11, Kafka 3.9.1 e Debezium Connect 3.3.1.Final
  tiveram sua existência confirmada. Disponibilidade da imagem não valida sua execução conjunta.
- Não há benchmark publicado. Tempos, planos e uso de memória devem ser medidos
  na sua máquina, registrando hardware, versões e cache.

## Preparação

Baixe o pacote disponibilizado na trilha ou clone o repositório:

```sh
git clone https://github.com/bruno-is/DevDocs.git
cd DevDocs/labs/sistemas
python --version
python -m unittest -v test_erp.py
```

No Linux o executável pode ser `python3`; no Windows pode ser `py -3`. Substitua
`python` nos comandos conforme sua instalação. Requer CPython **3.11+ com sqlite3**,
sem instalação via pip. A API escuta somente em `127.0.0.1`. Ela não implementa
autenticação, autorização, TLS ou controle de tenants: não a exponha à rede.

Para Compose: Docker Engine/Desktop funcionando, Compose v2 e acesso a Docker
Hub/Quay. Orçamento inicial estimado: **4 CPUs, 6 GiB RAM e 5 GiB livres** para os
containers; não é requisito medido. Imagens: PostgreSQL 17.11, Kafka JVM 3.9.1,
Debezium Connect 3.3.1.Final. São versões fixadas para este laboratório, não uma
recomendação de versão de produção. As tags ainda exigem download e podem deixar
de estar disponíveis; registre digests num experimento controlado.

## 1. Commit, duplicação, replay e falhas

```sh
python erp.py init
python erp.py write 1 "Pedido sintetico" --key criar-1
python erp.py write 1 "Pedido sintetico" --key criar-1
python erp.py inspect
python erp.py pump --crash before
python erp.py inspect
python erp.py pump --crash after
python erp.py inspect
python erp.py pump
python erp.py inspect
```

Os dois comandos `--crash` terminam com código 1 **por desenho**. Execute os
comandos um por vez, sem um runner que encerre toda a sessão no primeiro erro.
Antes do commit a projeção e inbox permanecem vazias. Depois do commit, existe
uma projeção e uma inbox, mas `pending=1`: o ACK à outbox não ocorreu. O próximo
`pump` recebe novamente e informa `duplicates=1`; o efeito não é repetido.
As duas escritas com `criar-1` produzem uma única versão e um único evento.
Reutilizar essa chave com outro título deve falhar.

`source.sqlite` contém tickets, requests e outbox. `projection.sqlite` contém
inbox e a projeção. Cada arquivo tem sua própria transação; não há commit
distribuído. A inbox e o efeito compartilham uma transação no destino. O teste
de ordem aplica versão 2 antes da 1 e verifica que o estado não regride.
Há **um worker**, lotes de até 100 eventos e nenhuma DLQ persistente. Um evento
inválido interrompe o lote. Não escale workers sem introduzir claim/lease,
controle de concorrência e política de mensagens inválidas.

## 2. API e investigação por evidências

Num terminal:

```sh
python erp.py serve
```

Em outro terminal, no Bash (no PowerShell use `curl.exe`):

```sh
curl -s http://127.0.0.1:8765/health
curl -s -X POST http://127.0.0.1:8765/tickets -H 'Content-Type: application/json' -H 'Idempotency-Key: api-2' -d '{"id":2,"title":"Integracao sintetica","status":"open"}'
curl -s http://127.0.0.1:8765/state
curl -s http://127.0.0.1:8765/metrics
python erp.py pump
curl -s http://127.0.0.1:8765/state
```

Se a origem contém o ticket e a projeção não, procure `pending_events` e o
processo consumidor antes de culpar o HTTP. Os logs estruturados contêm ação,
status e duração, sem corpo do ticket. `/metrics` retorna JSON didático, **não é
formato Prometheus nem instrumentação OpenTelemetry**. Compare antes/depois;
reiniciar a API zera seus contadores em memória. Interrompa com Ctrl+C.

## 3. Arquivo, verificação e reidratação

```sh
python erp.py write 1 "Pedido sintetico" --status closed --key fechar-1
python erp.py pump
python erp.py archive .lab-cold-1 --cutoff 9999-01-01T00:00:00+00:00
python erp.py inspect
python erp.py rehydrate .lab-cold-1
python erp.py inspect
```

A data distante inclui todos os tickets fechados sintéticos; não é política
de retenção. O arquivo contém JSONL e manifesto com quantidade, versão de schema
e SHA-256. A função verifica ambos antes de remover somente a **projeção**.
O banco de origem e a outbox são mantidos. Isso ensina a transição e leitura
histórica; **não reduz o armazenamento total nem implementa expurgo legal**.
Reidratar não deve sobrescrever uma versão mais recente. Modifique uma cópia do
JSONL e verifique que a reidratação rejeita o checksum. Um SHA-256 sem assinatura
detecta corrupção acidental; não prova autenticidade contra um agente malicioso.
A pasta de destino deve ser nova a cada execução para evitar sobrescrever arquivo.

## 4. Backup e recuperação

Pare API e worker para obter um ponto operacional comum no exercício:

```sh
python erp.py backup .lab-backup-1
python erp.py --data .lab-backup-1 inspect
python erp.py --data .lab-backup-1 pump
```

O comando usa a API de backup online SQLite e testa `PRAGMA integrity_check`.
Os dois backups são individualmente consistentes, não um snapshot atômico entre
arquivos. Manter a outbox entregue permite reconstruir uma projeção; para isso
é preciso preservar eventos e planejar reprocessamento. Este comando não é PITR.
Para medir RTO, registre hora de início e fim de uma recuperação em outra pasta
e valide contagem, versão e uma consulta de negócio. Não restaure por cima da origem.

## 5. PostgreSQL: índice e deadlock

```sh
docker compose config
docker compose up -d db
docker compose ps
docker compose exec db psql -U lab -d erp -f /lab/performance.sql
```

O script recria somente dados de `perf_orders` deste laboratório (200 mil linhas)
e compara `EXPLAIN (ANALYZE, BUFFERS)` antes/depois do índice composto. Observe
rows estimadas/reais, buffers, sort e tempo. Repita para cache quente; não publique
um fator de aceleração sem medi-lo. O índice usa espaço e aumenta custo de escrita.

Abra **dois** terminais `docker compose exec db psql -U lab -d erp` e copie
`sql/session-a.sql` e `sql/session-b.sql` **linha por linha**, respeitando os pontos
de parada. A prende id 1; B prende id 2; A pede id 2; B pede id 1. O PostgreSQL
detecta o ciclo e aborta uma transação (vítima não predeterminada). Na vítima,
`ROLLBACK`; na sobrevivente, `COMMIT`. Inspecione em um terceiro terminal:

```sh
docker compose exec db psql -U lab -d erp -c "SELECT pid,wait_event_type,wait_event,pg_blocking_pids(pid) FROM pg_stat_activity WHERE datname='erp';"
docker compose exec db psql -U lab -d erp -c "TABLE inventory;"
```

Refaça usando a mesma ordem de aquisição de IDs nas duas transações. Some os
saldos e justifique a invariância. Em produção, retry reexecuta a transação toda,
com limite, backoff e idempotência; não somente a instrução abortada.

## 6. CDC real: PostgreSQL → WAL → Debezium → Kafka

```sh
docker compose up -d
python register_connector.py
docker compose exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server kafka:9092 --list
docker compose exec kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server kafka:9092 --topic erp.public.tickets --from-beginning --max-messages 3 --timeout-ms 30000
```

Com volume novo há três registros iniciais, capturados pelo snapshot (`op=r`).
O `--max-messages` encerra depois de três; um volume reutilizado pode ter outros
eventos. Caso não cheguem, o timeout é falha de observação, não prova de perda:
inspecione `/connectors/devdocs-postgres/status` e `docker compose logs connect`.

Abra um consumidor contínuo em outro terminal:

```sh
docker compose exec kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server kafka:9092 --topic erp.public.tickets --from-beginning
```

E altere dados na origem:

```sh
docker compose exec db psql -U lab -d erp -c "INSERT INTO tickets(tenant_id,title) VALUES(3,'CDC sintetico');"
docker compose exec db psql -U lab -d erp -c "UPDATE tickets SET status='closed',version=version+1,updated_at=now() WHERE id=1;"
docker compose exec db psql -U lab -d erp -c "DELETE FROM tickets WHERE id=2;"
docker compose exec db psql -U lab -d erp -c "SELECT slot_name,active,restart_lsn,confirmed_flush_lsn,pg_wal_lsn_diff(pg_current_wal_lsn(),restart_lsn) AS retained_bytes FROM pg_replication_slots;"
```

Procure `op=c/u/d`; depois do delete pode aparecer o valor `null` (tombstone).
`REPLICA IDENTITY FULL` amplia imagem anterior e custo do WAL neste laboratório.
A publicação foi criada pelo administrador; o conector usa usuário `cdc` com
replicação e leitura da tabela, sem superusuário. Não reutilize as senhas locais.

Pare `connect`, faça um update e meça retenção; inicie `connect` novamente e
observe recuperação:

```sh
docker compose stop connect
docker compose exec db psql -U lab -d erp -c "UPDATE tickets SET version=version+1,updated_at=now() WHERE id=1;"
docker compose start connect
```

O limite didático `max_slot_wal_keep_size=512MB` evita retenção ilimitada pelo
slot, mas permite invalidá-lo se o leitor ficar para trás. Não gere 512 MB só
para provocar falha. Slots/offsets não substituem backup; não apague volumes para
“corrigir” um conector sem diagnosticar posição, dados e necessidade de resnapshot.
Um broker e replication factor 1 **não toleram perda desse broker**. O exemplo
não entrega uma projeção Kafka em produção nem exactly-once ponta a ponta.

## 7. Kubernetes: reconciliação, Service e volume

Instale `kubectl` e `kind` conforme os guias oficiais. Exemplo de ambiente local
com kind e APIs estáveis v1/apps/v1; reserve mais 2 CPUs e 2 GiB estimados.
Confirme que seu contexto é local antes de aplicar:

```sh
kind create cluster --name devdocs
kubectl config current-context
kubectl apply -f k8s.yaml
kubectl -n devdocs-lab rollout status deployment/echo --timeout=120s
kubectl -n devdocs-lab get pods,svc,pvc
kubectl -n devdocs-lab port-forward service/echo 8088:80
```

Acesse `http://127.0.0.1:8088`. Interrompa o port-forward e delete os Pods echo
no contexto local; o Deployment cria novos Pods. A substituição pode interromper
o port-forward e conexões em voo; execute-o novamente se necessário.

```sh
kubectl -n devdocs-lab delete pod -l app=echo
kubectl -n devdocs-lab get pods -w
kubectl -n devdocs-lab exec volume-demo -- cat /data/marker
kubectl -n devdocs-lab delete pod volume-demo
kubectl apply -f k8s.yaml
kubectl -n devdocs-lab wait --for=condition=Ready pod/volume-demo --timeout=120s
kubectl -n devdocs-lab exec volume-demo -- cat /data/marker
```

O marker deve ser preservado pelo PVC. Um Pod isolado não é recriado até o novo
`apply`. Se o PVC ficar Pending, investigue `kubectl describe pvc` e a StorageClass
padrão; não conclua que o Pod quebrou. O volume local do kind não representa
replicação entre zonas nem backup. Não há teste de falha física de disco.

## Encerramento e limpeza

Ctrl+C encerra servidores/consumidores/port-forward. `docker compose down` para
containers e preserva volumes. **Somente após concluir e conferir que está na
pasta deste laboratório**, `docker compose down -v` apaga os volumes sintéticos
deste projeto. Isso é irreversível para os dados locais. `kind delete cluster
--name devdocs` apaga o cluster local e seus volumes; não use contra outro cluster.
As pastas `.lab-data`, `.lab-cold-*` e `.lab-backup-*` podem ser mantidas para
comparação ou apagadas manualmente após verificar seu conteúdo. Não há comando
de limpeza recursiva automática para o diretório do repositório.

## Critério de conclusão

Entregue um relatório com hipótese, comandos, evidência e explicação para cada
experimento. Para considerar concluído: demonstrar uma duplicação sem efeito
duplicado, um rollback íntegro, um deadlock explicado, um plano analisado, as
três operações CDC observadas, um marker preservado e recuperação verificada.
Marque separadamente o que executou e o que apenas revisou.

## Referências

- [Python sqlite3](https://docs.python.org/3/library/sqlite3.html)
- [PostgreSQL 17: EXPLAIN](https://www.postgresql.org/docs/17/using-explain.html)
- [PostgreSQL 17: locks](https://www.postgresql.org/docs/17/explicit-locking.html)
- [Debezium 3.3: PostgreSQL](https://debezium.io/documentation/reference/3.3/connectors/postgresql.html)
- [Debezium 3.3: versões testadas](https://debezium.io/releases/3.3/)
- [Kafka 3.9: Docker](https://kafka.apache.org/39/getting-started/docker/)
- [Compose e healthchecks](https://docs.docker.com/compose/how-tos/startup-order/)
- [kind Quick Start](https://kind.sigs.k8s.io/docs/user/quick-start/)
- [kubectl](https://kubernetes.io/docs/tasks/tools/)
