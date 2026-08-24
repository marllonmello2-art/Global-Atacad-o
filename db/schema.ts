import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const sessions = sqliteTable("sessions", {
  token: text("token").primaryKey(),
  userId: text("user_id").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const storeSettings = sqliteTable("store_settings", {
  ownerId: text("owner_id").primaryKey(),
  slug: text("slug").notNull(),
  storeName: text("store_name").notNull(),
  whatsappNumber: text("whatsapp_number"),
  description: text("description"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const products = sqliteTable("products", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  sku: text("sku"),
  ean: text("ean"),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category"),
  brand: text("brand"),
  unit: text("unit").notNull().default("un"),
  costPrice: real("cost_price").notNull().default(0),
  retailPrice: real("retail_price").notNull().default(0),
  minStock: real("min_stock").notNull().default(0),
  currentStock: real("current_stock").notNull().default(0),
  imageKey: text("image_key"),
  imageMime: text("image_mime"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  visibleInCatalog: integer("visible_in_catalog", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const productVariants = sqliteTable("product_variants", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull(),
  name: text("name").notNull(),
  sku: text("sku"),
  ean: text("ean"),
  priceOverride: real("price_override"),
  stock: real("stock").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const priceTiers = sqliteTable("price_tiers", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull(),
  minQuantity: real("min_quantity").notNull(),
  price: real("price").notNull(),
  label: text("label"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const customers = sqliteTable("customers", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  name: text("name").notNull(),
  document: text("document"),
  phone: text("phone"),
  email: text("email"),
  type: text("type").notNull().default("varejo"),
  creditLimit: real("credit_limit").notNull().default(0),
  paymentTermDays: integer("payment_term_days").notNull().default(0),
  status: text("status").notNull().default("aprovado"),
  notes: text("notes"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const stockMovements = sqliteTable("stock_movements", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  productId: text("product_id").notNull(),
  variantId: text("variant_id"),
  type: text("type").notNull(),
  quantity: real("quantity").notNull(),
  reason: text("reason"),
  referenceOrderId: text("reference_order_id"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  customerId: text("customer_id"),
  customerNameSnapshot: text("customer_name_snapshot"),
  customerPhoneSnapshot: text("customer_phone_snapshot"),
  status: text("status").notNull().default("orcamento"),
  paymentMethod: text("payment_method").notNull().default("pix"),
  subtotal: real("subtotal").notNull().default(0),
  discount: real("discount").notNull().default(0),
  total: real("total").notNull().default(0),
  notes: text("notes"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const orderItems = sqliteTable("order_items", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull(),
  productId: text("product_id"),
  variantId: text("variant_id"),
  description: text("description").notNull(),
  quantity: real("quantity").notNull(),
  unitPrice: real("unit_price").notNull(),
  total: real("total").notNull(),
});

export const financialEntries = sqliteTable("financial_entries", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  type: text("type").notNull(),
  orderId: text("order_id"),
  description: text("description").notNull(),
  category: text("category"),
  amount: real("amount").notNull(),
  dueDate: text("due_date").notNull(),
  paidAt: text("paid_at"),
  status: text("status").notNull().default("pendente"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
