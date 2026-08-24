type RuntimeBindings = {
  DB?: D1Database;
  BUCKET?: R2Bucket;
};

async function getBindings(): Promise<RuntimeBindings> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    return env as RuntimeBindings;
  } catch {
    return {};
  }
}

export async function getRuntimeDb() {
  return (await getBindings()).DB;
}

export async function getRuntimeBucket() {
  return (await getBindings()).BUCKET;
}

let schemaPromise: Promise<void> | null = null;

export function ensureRuntimeSchema(db: D1Database) {
  if (!schemaPromise) {
    schemaPromise = db
      .batch([
        db.prepare(
          "CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, email TEXT NOT NULL, password_hash TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"
        ),
        db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users(email)"),
        db.prepare(
          "CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"
        ),
        db.prepare("CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id)"),
        db.prepare(
          "CREATE TABLE IF NOT EXISTS store_settings (owner_id TEXT PRIMARY KEY NOT NULL, slug TEXT NOT NULL, store_name TEXT NOT NULL, whatsapp_number TEXT, description TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"
        ),
        db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS store_settings_slug_idx ON store_settings(slug)"),
        db.prepare(
          "CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY NOT NULL, owner_id TEXT NOT NULL, sku TEXT, ean TEXT, name TEXT NOT NULL, description TEXT, category TEXT, brand TEXT, unit TEXT NOT NULL DEFAULT 'un', cost_price REAL NOT NULL DEFAULT 0, retail_price REAL NOT NULL DEFAULT 0, min_stock REAL NOT NULL DEFAULT 0, current_stock REAL NOT NULL DEFAULT 0, image_key TEXT, image_mime TEXT, active INTEGER NOT NULL DEFAULT 1, visible_in_catalog INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"
        ),
        db.prepare("CREATE INDEX IF NOT EXISTS products_owner_idx ON products(owner_id, updated_at)"),
        db.prepare(
          "CREATE TABLE IF NOT EXISTS product_variants (id TEXT PRIMARY KEY NOT NULL, product_id TEXT NOT NULL, name TEXT NOT NULL, sku TEXT, ean TEXT, price_override REAL, stock REAL NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"
        ),
        db.prepare("CREATE INDEX IF NOT EXISTS product_variants_product_idx ON product_variants(product_id)"),
        db.prepare(
          "CREATE TABLE IF NOT EXISTS price_tiers (id TEXT PRIMARY KEY NOT NULL, product_id TEXT NOT NULL, min_quantity REAL NOT NULL, price REAL NOT NULL, label TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"
        ),
        db.prepare("CREATE INDEX IF NOT EXISTS price_tiers_product_idx ON price_tiers(product_id, min_quantity)"),
        db.prepare(
          "CREATE TABLE IF NOT EXISTS customers (id TEXT PRIMARY KEY NOT NULL, owner_id TEXT NOT NULL, name TEXT NOT NULL, document TEXT, phone TEXT, email TEXT, type TEXT NOT NULL DEFAULT 'varejo', credit_limit REAL NOT NULL DEFAULT 0, payment_term_days INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'aprovado', notes TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"
        ),
        db.prepare("CREATE INDEX IF NOT EXISTS customers_owner_idx ON customers(owner_id, name)"),
        db.prepare(
          "CREATE TABLE IF NOT EXISTS stock_movements (id TEXT PRIMARY KEY NOT NULL, owner_id TEXT NOT NULL, product_id TEXT NOT NULL, variant_id TEXT, type TEXT NOT NULL, quantity REAL NOT NULL, reason TEXT, reference_order_id TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"
        ),
        db.prepare("CREATE INDEX IF NOT EXISTS stock_movements_owner_idx ON stock_movements(owner_id, created_at)"),
        db.prepare("CREATE INDEX IF NOT EXISTS stock_movements_product_idx ON stock_movements(product_id, created_at)"),
        db.prepare(
          "CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY NOT NULL, owner_id TEXT NOT NULL, customer_id TEXT, customer_name_snapshot TEXT, customer_phone_snapshot TEXT, status TEXT NOT NULL DEFAULT 'orcamento', payment_method TEXT NOT NULL DEFAULT 'pix', subtotal REAL NOT NULL DEFAULT 0, discount REAL NOT NULL DEFAULT 0, total REAL NOT NULL DEFAULT 0, notes TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"
        ),
        db.prepare("CREATE INDEX IF NOT EXISTS orders_owner_idx ON orders(owner_id, created_at)"),
        db.prepare(
          "CREATE TABLE IF NOT EXISTS order_items (id TEXT PRIMARY KEY NOT NULL, order_id TEXT NOT NULL, product_id TEXT, variant_id TEXT, description TEXT NOT NULL, quantity REAL NOT NULL, unit_price REAL NOT NULL, total REAL NOT NULL)"
        ),
        db.prepare("CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items(order_id)"),
        db.prepare(
          "CREATE TABLE IF NOT EXISTS financial_entries (id TEXT PRIMARY KEY NOT NULL, owner_id TEXT NOT NULL, type TEXT NOT NULL, order_id TEXT, description TEXT NOT NULL, category TEXT, amount REAL NOT NULL, due_date TEXT NOT NULL, paid_at TEXT, status TEXT NOT NULL DEFAULT 'pendente', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"
        ),
        db.prepare("CREATE INDEX IF NOT EXISTS financial_entries_owner_idx ON financial_entries(owner_id, due_date)"),
      ])
      .then(() => undefined);
  }
  return schemaPromise;
}

export function persistencePendingResponse() {
  return Response.json(
    { code: "PERSISTENCE_NOT_CONFIGURED", error: "Banco de dados ainda não configurado. Configure o binding D1 (DB) no ambiente do Worker." },
    { status: 503 }
  );
}
