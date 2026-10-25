CREATE TABLE tickets (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id integer NOT NULL,
    title text NOT NULL,
    status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')),
    version integer NOT NULL DEFAULT 1,
    updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO tickets (tenant_id,title) VALUES (1,'Pedido sintetico A'),(1,'Pedido sintetico B'),(2,'Pedido sintetico C');
ALTER TABLE tickets REPLICA IDENTITY FULL;
CREATE ROLE cdc WITH LOGIN REPLICATION PASSWORD 'cdc-local-only';
GRANT CONNECT ON DATABASE erp TO cdc;
GRANT USAGE ON SCHEMA public TO cdc;
GRANT SELECT ON TABLE tickets TO cdc;
CREATE PUBLICATION devdocs_pub FOR TABLE public.tickets;

CREATE TABLE inventory (id integer PRIMARY KEY, balance integer NOT NULL CHECK(balance>=0));
INSERT INTO inventory VALUES (1,100),(2,100);
