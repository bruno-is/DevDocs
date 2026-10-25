-- Cole linha por linha no terminal B; siga a coordenacao de session-a.sql.
BEGIN;
UPDATE inventory SET balance=balance-20 WHERE id=2;
-- Depois do segundo UPDATE de A estar bloqueado:
UPDATE inventory SET balance=balance+20 WHERE id=1;
-- PostgreSQL aborta uma das transacoes; a vitima nao e predeterminada.
-- Na sessao abortada use ROLLBACK. Na sobrevivente use COMMIT.
