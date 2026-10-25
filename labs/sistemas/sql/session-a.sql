-- Cole linha por linha no terminal A. Pare onde indicado; nao execute em lote.
BEGIN;
UPDATE inventory SET balance=balance-10 WHERE id=1;
-- Execute agora as duas primeiras instrucoes de session-b.sql no terminal B.
UPDATE inventory SET balance=balance+10 WHERE id=2;
-- Aguarda B liberar id=2. Execute o segundo UPDATE de B para formar o ciclo.
COMMIT;
