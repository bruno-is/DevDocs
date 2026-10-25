\set ON_ERROR_STOP on
\timing on
CREATE TABLE IF NOT EXISTS perf_orders (
  id bigint PRIMARY KEY,
  customer_id integer NOT NULL,
  total_cents integer NOT NULL,
  created_at timestamptz NOT NULL
);
TRUNCATE perf_orders;
DROP INDEX IF EXISTS perf_orders_customer_created;
INSERT INTO perf_orders
SELECT n, n % 1000, 100 + n % 100000,
       timestamptz '2025-01-01T00:00:00Z' + n * interval '1 second'
FROM generate_series(1,200000) AS n;
ANALYZE perf_orders;
EXPLAIN (ANALYZE, BUFFERS)
SELECT id,total_cents FROM perf_orders WHERE customer_id=42 ORDER BY created_at DESC LIMIT 20;
CREATE INDEX perf_orders_customer_created ON perf_orders(customer_id,created_at DESC);
ANALYZE perf_orders;
EXPLAIN (ANALYZE, BUFFERS)
SELECT id,total_cents FROM perf_orders WHERE customer_id=42 ORDER BY created_at DESC LIMIT 20;
SELECT pg_size_pretty(pg_total_relation_size('perf_orders')) AS total_com_indices;
