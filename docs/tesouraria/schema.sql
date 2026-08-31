-- Sistema de Tesouraria da Igreja — esquema D1 (SQLite)
-- Convenções:
--   * dinheiro sempre em centavos, INTEGER, nunca REAL;
--   * datas em TEXT no formato 'YYYY-MM-DD'; timestamps em ISO-8601 UTC;
--   * ids em TEXT (uuid/ulid gerado na aplicação);
--   * exclusão lógica via deleted_at.

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------- acesso ----

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY NOT NULL,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'TESOUREIRO'
                CHECK (role IN ('ADMINISTRADOR', 'TESOUREIRO', 'LEITOR')),
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users(email);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY NOT NULL,
  user_id    TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);

-- Token de serviço para o agente/integrações (nunca reutiliza sessão de browser).
CREATE TABLE IF NOT EXISTS agent_tokens (
  id          TEXT PRIMARY KEY NOT NULL,
  name        TEXT NOT NULL,
  token_hash  TEXT NOT NULL,
  created_by  TEXT REFERENCES users(id),
  revoked_at  TEXT,
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS agent_tokens_hash_idx ON agent_tokens(token_hash);

-- ------------------------------------------------------ unidades e contas ----

CREATE TABLE IF NOT EXISTS units (
  id         TEXT PRIMARY KEY NOT NULL,
  name       TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS units_name_idx ON units(name);

CREATE TABLE IF NOT EXISTS user_units (
  user_id TEXT NOT NULL REFERENCES users(id),
  unit_id TEXT NOT NULL REFERENCES units(id),
  PRIMARY KEY (user_id, unit_id)
);

-- unit_id NULL = conta "Geral" (ex.: Santander Mulheres, Santander Família).
CREATE TABLE IF NOT EXISTS accounts (
  id                    TEXT PRIMARY KEY NOT NULL,
  unit_id               TEXT REFERENCES units(id),
  name                  TEXT NOT NULL,
  kind                  TEXT NOT NULL CHECK (kind IN ('CAIXA', 'BANCO')),
  institution           TEXT CHECK (institution IN ('Itau','Santander','Bradesco','Stone')),
  opening_balance_cents INTEGER NOT NULL DEFAULT 0,
  current_balance_cents INTEGER NOT NULL DEFAULT 0, -- saldo apurado (cache incremental)
  active                INTEGER NOT NULL DEFAULT 1,
  created_at            TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- conta CAIXA não tem instituição; conta BANCO tem.
  CHECK ((kind = 'CAIXA' AND institution IS NULL) OR (kind = 'BANCO' AND institution IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS accounts_unit_idx ON accounts(unit_id, name);

-- --------------------------------------------------------------- categorias --
-- Lista fixa e padronizada. A tela não deixa criar categoria nova: novas grafias
-- entram como alias, o que impede a volta da duplicidade.

CREATE TABLE IF NOT EXISTS categories (
  id         TEXT PRIMARY KEY NOT NULL,       -- slug estável, ex.: 'acao_social'
  name       TEXT NOT NULL,                   -- rótulo canônico exibido
  nature     TEXT NOT NULL CHECK (nature IN ('ENTRADA','SAIDA','AMBAS','TRANSFERENCIA')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  active     INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS categories_name_idx ON categories(name);

-- Grafias antigas/variantes → categoria canônica (usado na importação e no agente).
CREATE TABLE IF NOT EXISTS category_aliases (
  alias       TEXT PRIMARY KEY NOT NULL,      -- sempre normalizado: minúsculo, sem acento
  category_id TEXT NOT NULL REFERENCES categories(id)
);

-- ------------------------------------------------------------- lançamentos --
-- Uma linha por lançamento, inclusive transferência (origem + destino na mesma
-- linha). amount_cents é sempre positivo; o sinal vem do tipo.

CREATE TABLE IF NOT EXISTS transactions (
  id                TEXT PRIMARY KEY NOT NULL,
  ledger            TEXT NOT NULL DEFAULT 'UNIDADE'
                    CHECK (ledger IN ('UNIDADE','CAMPANHA')),
  date              TEXT NOT NULL,                    -- 'YYYY-MM-DD'
  unit_id           TEXT REFERENCES units(id),
  type              TEXT NOT NULL CHECK (type IN ('ENTRADA','SAIDA','TRANSFERENCIA')),
  description       TEXT NOT NULL,
  category_id       TEXT REFERENCES categories(id),
  account_id        TEXT NOT NULL REFERENCES accounts(id),
  counter_account_id TEXT REFERENCES accounts(id),    -- destino da transferência
  payment_method    TEXT CHECK (payment_method IN
                      ('PIX','DEBITO','CREDITO','PRE_PAGO','BOLETO','ESPECIE','TRANSFERENCIA','OUTRO')),
  reference         TEXT,
  amount_cents      INTEGER NOT NULL CHECK (amount_cents > 0),
  status            TEXT NOT NULL DEFAULT 'PENDENTE'
                    CHECK (status IN ('CONCILIADO','PENDENTE')),
  reconciled_at     TEXT,
  campaign_id       TEXT REFERENCES campaigns(id),
  bill_id           TEXT REFERENCES bills(id),
  source            TEXT NOT NULL DEFAULT 'web'
                    CHECK (source IN ('planilha','web','agente')),
  import_hash       TEXT,                             -- idempotência da importação
  receipt_key       TEXT,                             -- objeto no R2
  created_by        TEXT REFERENCES users(id),
  created_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at        TEXT,
  -- transferência exige destino diferente da origem; os demais tipos não têm destino
  CHECK (
    (type = 'TRANSFERENCIA' AND counter_account_id IS NOT NULL AND counter_account_id <> account_id)
    OR (type <> 'TRANSFERENCIA' AND counter_account_id IS NULL)
  ),
  -- entrada/saída exigem categoria
  CHECK (type = 'TRANSFERENCIA' OR category_id IS NOT NULL),
  -- lançamento de campanha pertence a uma campanha; o de unidade, a uma unidade
  CHECK (
    (ledger = 'CAMPANHA' AND campaign_id IS NOT NULL)
    OR (ledger = 'UNIDADE' AND unit_id IS NOT NULL)
  ),
  CHECK (status = 'PENDENTE' OR reconciled_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS tx_unit_date_idx     ON transactions(unit_id, date)      WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS tx_account_date_idx  ON transactions(account_id, date)   WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS tx_counter_date_idx  ON transactions(counter_account_id, date) WHERE counter_account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS tx_category_date_idx ON transactions(category_id, date)  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS tx_date_idx          ON transactions(date)               WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS tx_pending_idx       ON transactions(status, account_id, date) WHERE status = 'PENDENTE';
CREATE INDEX IF NOT EXISTS tx_campaign_idx      ON transactions(campaign_id, date)  WHERE campaign_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS tx_import_hash_idx ON transactions(import_hash)   WHERE import_hash IS NOT NULL;

-- Expansão do lançamento em movimentos com sinal por conta. É a fonte da verdade
-- do saldo; accounts.current_balance_cents é só o cache dela.
CREATE VIEW IF NOT EXISTS account_entries AS
  SELECT id AS transaction_id, date, account_id, unit_id, category_id, ledger, status,
         CASE type WHEN 'ENTRADA' THEN amount_cents ELSE -amount_cents END AS signed_cents
    FROM transactions
   WHERE deleted_at IS NULL AND type IN ('ENTRADA','SAIDA')
  UNION ALL
  SELECT id, date, account_id, unit_id, category_id, ledger, status, -amount_cents
    FROM transactions
   WHERE deleted_at IS NULL AND type = 'TRANSFERENCIA'
  UNION ALL
  SELECT id, date, counter_account_id, unit_id, category_id, ledger, status, amount_cents
    FROM transactions
   WHERE deleted_at IS NULL AND type = 'TRANSFERENCIA';

-- Resumo mensal mantido na escrita: alimenta o consolidado e as séries do painel
-- sem varrer transactions.
CREATE TABLE IF NOT EXISTS monthly_summary (
  month        TEXT NOT NULL,                 -- 'YYYY-MM'
  unit_id      TEXT,
  account_id   TEXT NOT NULL,
  -- '' quando não há categoria (transferência): coluna de chave primária não
  -- pode ser NULL em SQLite sem perder a unicidade.
  category_id  TEXT NOT NULL DEFAULT '',
  ledger       TEXT NOT NULL DEFAULT 'UNIDADE',
  in_cents     INTEGER NOT NULL DEFAULT 0,
  out_cents    INTEGER NOT NULL DEFAULT 0,
  updated_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (month, account_id, ledger, category_id)
);
CREATE INDEX IF NOT EXISTS monthly_summary_unit_idx ON monthly_summary(unit_id, month);

-- --------------------------------------------------- contas a pagar/receber --

CREATE TABLE IF NOT EXISTS bills (
  id                  TEXT PRIMARY KEY NOT NULL,
  unit_id             TEXT REFERENCES units(id),
  direction           TEXT NOT NULL DEFAULT 'PAGAR' CHECK (direction IN ('PAGAR','RECEBER')),
  description         TEXT NOT NULL,
  category_id         TEXT REFERENCES categories(id),
  supplier            TEXT,
  pix_key             TEXT,
  due_date            TEXT NOT NULL,
  expected_cents      INTEGER NOT NULL CHECK (expected_cents > 0),
  status              TEXT NOT NULL DEFAULT 'PENDENTE'
                      CHECK (status IN ('PENDENTE','PAGO','CANCELADO')),
  paid_at             TEXT,
  paid_cents          INTEGER,
  account_id          TEXT REFERENCES accounts(id),
  recurrence          TEXT CHECK (recurrence IN ('MENSAL','BIMESTRAL','TRIMESTRAL','SEMESTRAL','ANUAL')),
  recurrence_parent_id TEXT REFERENCES bills(id),
  installment_number  INTEGER,
  installment_total   INTEGER,
  transaction_id      TEXT REFERENCES transactions(id),  -- lançamento gerado na baixa
  calendar_event_id   TEXT,
  notes               TEXT,
  created_by          TEXT REFERENCES users(id),
  created_at          TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at          TEXT,
  CHECK (status <> 'PAGO' OR (paid_at IS NOT NULL AND paid_cents IS NOT NULL AND account_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS bills_due_idx  ON bills(status, due_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS bills_unit_idx ON bills(unit_id, due_date) WHERE deleted_at IS NULL;

-- ------------------------------------------------------------------ cartões --

CREATE TABLE IF NOT EXISTS cards (
  id           TEXT PRIMARY KEY NOT NULL,
  name         TEXT NOT NULL,
  unit_id      TEXT REFERENCES units(id),
  account_id   TEXT REFERENCES accounts(id),  -- conta que paga a fatura
  closing_day  INTEGER,
  due_day      INTEGER,
  active       INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS card_installments (
  id                 TEXT PRIMARY KEY NOT NULL,
  card_id            TEXT NOT NULL REFERENCES cards(id),
  unit_id            TEXT REFERENCES units(id),
  description        TEXT NOT NULL,
  purchase_month     TEXT NOT NULL,            -- 'YYYY-MM'
  invoice_month      TEXT NOT NULL,            -- 'YYYY-MM' da fatura desta parcela
  total_cents        INTEGER NOT NULL CHECK (total_cents > 0),
  installment_cents  INTEGER NOT NULL CHECK (installment_cents > 0),
  installment_number INTEGER NOT NULL,
  installment_total  INTEGER NOT NULL,
  category_id        TEXT REFERENCES categories(id),
  transaction_id     TEXT REFERENCES transactions(id),
  source             TEXT NOT NULL DEFAULT 'web',
  created_by         TEXT REFERENCES users(id),
  created_at         TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (installment_number BETWEEN 1 AND installment_total)
);
CREATE INDEX IF NOT EXISTS card_inst_invoice_idx ON card_installments(card_id, invoice_month);

-- --------------------------------------------------------------- campanhas --

CREATE TABLE IF NOT EXISTS campaigns (
  id            TEXT PRIMARY KEY NOT NULL,
  name          TEXT NOT NULL,
  unit_id       TEXT REFERENCES units(id),   -- NULL = campanha de toda a igreja
  budget_cents  INTEGER NOT NULL DEFAULT 0,
  starts_on     TEXT,
  ends_on       TEXT,
  status        TEXT NOT NULL DEFAULT 'ATIVA'
                CHECK (status IN ('ATIVA','ENCERRADA','CANCELADA')),
  notes         TEXT,
  created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- Os lançamentos da campanha ficam em transactions com ledger = 'CAMPANHA'.

-- ------------------------------------------------ reembolsos de ministério --

CREATE TABLE IF NOT EXISTS ministry_refunds (
  id             TEXT PRIMARY KEY NOT NULL,
  unit_id        TEXT REFERENCES units(id),
  ministry       TEXT NOT NULL,
  description    TEXT NOT NULL,
  amount_cents   INTEGER NOT NULL CHECK (amount_cents > 0),
  requested_on   TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'PENDENTE'
                 CHECK (status IN ('PENDENTE','PAGO','CANCELADO')),
  paid_at        TEXT,
  transaction_id TEXT REFERENCES transactions(id),
  notes          TEXT,
  created_by     TEXT REFERENCES users(id),
  created_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS refunds_status_idx ON ministry_refunds(status, requested_on);

-- ------------------------------------- classificação automática e rascunhos --

CREATE TABLE IF NOT EXISTS category_rules (
  id           TEXT PRIMARY KEY NOT NULL,
  pattern      TEXT NOT NULL,                -- comparado com LIKE sobre o texto normalizado
  unit_id      TEXT REFERENCES units(id),
  account_id   TEXT REFERENCES accounts(id),
  category_id  TEXT NOT NULL REFERENCES categories(id),
  type         TEXT CHECK (type IN ('ENTRADA','SAIDA','TRANSFERENCIA')),
  priority     INTEGER NOT NULL DEFAULT 100, -- menor vence
  active       INTEGER NOT NULL DEFAULT 1,
  created_by   TEXT REFERENCES users(id),
  created_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS category_rules_priority_idx ON category_rules(active, priority);

-- Texto cru vindo do agente/WhatsApp/importação vira rascunho e só entra no
-- razão depois de confirmado por uma pessoa.
CREATE TABLE IF NOT EXISTS entry_drafts (
  id             TEXT PRIMARY KEY NOT NULL,
  raw_text       TEXT NOT NULL,
  parsed_json    TEXT,                        -- proposta de lançamento
  confidence     REAL NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'PENDENTE'
                 CHECK (status IN ('PENDENTE','CONFIRMADO','DESCARTADO')),
  transaction_id TEXT REFERENCES transactions(id),
  source         TEXT NOT NULL DEFAULT 'agente',
  created_by     TEXT REFERENCES users(id),
  reviewed_by    TEXT REFERENCES users(id),
  created_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at    TEXT
);
CREATE INDEX IF NOT EXISTS entry_drafts_status_idx ON entry_drafts(status, created_at);

-- ----------------------------------------------- importação e auditoria -----

CREATE TABLE IF NOT EXISTS import_batches (
  id            TEXT PRIMARY KEY NOT NULL,
  filename      TEXT NOT NULL,
  kind          TEXT NOT NULL DEFAULT 'PLANILHA'
                CHECK (kind IN ('PLANILHA','EXTRATO')),
  account_id    TEXT REFERENCES accounts(id),
  total_rows    INTEGER NOT NULL DEFAULT 0,
  imported_rows INTEGER NOT NULL DEFAULT 0,
  skipped_rows  INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'EM_ANALISE'
                CHECK (status IN ('EM_ANALISE','CONFIRMADO','CANCELADO')),
  created_by    TEXT REFERENCES users(id),
  created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_log (
  id          TEXT PRIMARY KEY NOT NULL,
  user_id     TEXT REFERENCES users(id),
  actor_kind  TEXT NOT NULL DEFAULT 'USUARIO'
              CHECK (actor_kind IN ('USUARIO','AGENTE','IMPORTACAO')),
  entity      TEXT NOT NULL,                  -- 'transactions', 'bills', ...
  entity_id   TEXT NOT NULL,
  action      TEXT NOT NULL CHECK (action IN ('CREATE','UPDATE','DELETE','RECONCILE')),
  before_json TEXT,
  after_json  TEXT,
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS audit_entity_idx ON audit_log(entity, entity_id, created_at);
CREATE INDEX IF NOT EXISTS audit_user_idx   ON audit_log(user_id, created_at);
