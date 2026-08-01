import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", [
  "admin",
  "manager",
  "accounts",
  "inventory",
  "production",
  "viewer",
]);
export const transactionTypeEnum = pgEnum("transaction_type", [
  "sale",
  "purchase",
  "bank_deposit",
  "bank_withdrawal",
  "customer_receipt",
  "supplier_payment",
  "adjustment",
]);
export const transactionStatusEnum = pgEnum("transaction_status", [
  "draft",
  "posted",
  "reversed",
]);
export const paymentMethodEnum = pgEnum("payment_method", [
  "cash",
  "bank",
  "cheque",
  "credit",
]);
export const billTypeEnum = pgEnum("bill_type", [
  "invoice",
  "quotation",
  "tax_invoice",
]);
export const billStatusEnum = pgEnum("bill_status", [
  "draft",
  "issued",
  "partial",
  "paid",
  "cancelled",
  "expired",
]);
export const inventoryMovementTypeEnum = pgEnum("inventory_movement_type", [
  "opening",
  "purchase",
  "sale",
  "return_in",
  "return_out",
  "adjustment_in",
  "adjustment_out",
  "production_issue",
  "production_output",
  "transfer_in",
  "transfer_out",
]);
export const accountTypeEnum = pgEnum("account_type", [
  "asset",
  "liability",
  "equity",
  "revenue",
  "expense",
]);
export const journalStatusEnum = pgEnum("journal_status", [
  "posted",
  "reversed",
]);
export const journalSideEnum = pgEnum("journal_side", ["debit", "credit"]);
export const workerStatusEnum = pgEnum("worker_status", ["active", "inactive"]);
export const workerPaymentStatusEnum = pgEnum("worker_payment_status", [
  "pending",
  "partial",
  "paid",
]);
export const workOrderStatusEnum = pgEnum("work_order_status", [
  "planned",
  "released",
  "in_progress",
  "completed",
  "cancelled",
]);
export const auditActionEnum = pgEnum("audit_action", [
  "create",
  "update",
  "archive",
  "post",
  "reverse",
  "login",
  "logout",
  "restore",
]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
};

export const documentSequences = pgTable("document_sequences", {
  key: varchar("key", { length: 80 }).primaryKey(),
  lastNumber: integer("last_number").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    username: varchar("username", { length: 80 }).notNull(),
    displayName: varchar("display_name", { length: 160 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    role: userRoleEnum("role").notNull().default("viewer"),
    isActive: boolean("is_active").notNull().default(true),
    mustChangePassword: boolean("must_change_password").notNull().default(true),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [uniqueIndex("users_username_unique").on(table.username)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    userAgent: text("user_agent"),
    ipAddress: varchar("ip_address", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("sessions_token_hash_unique").on(table.tokenHash),
    index("sessions_user_id_idx").on(table.userId),
    index("sessions_expires_at_idx").on(table.expiresAt),
  ],
);

export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    username: varchar("username", { length: 80 }).notNull(),
    succeeded: boolean("succeeded").notNull(),
    ipAddress: varchar("ip_address", { length: 64 }),
    userAgent: text("user_agent"),
    attemptedAt: timestamp("attempted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("login_attempts_username_time_idx").on(table.username, table.attemptedAt)],
);

export const parties = pgTable(
  "parties",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 200 }).notNull(),
    contactPerson: varchar("contact_person", { length: 160 }),
    phone: varchar("phone", { length: 40 }),
    email: varchar("email", { length: 255 }),
    address: text("address"),
    taxNumber: varchar("tax_number", { length: 80 }),
    isCustomer: boolean("is_customer").notNull().default(false),
    isSupplier: boolean("is_supplier").notNull().default(false),
    openingReceivable: numeric("opening_receivable", {
      precision: 18,
      scale: 2,
    })
      .notNull()
      .default("0"),
    openingPayable: numeric("opening_payable", { precision: 18, scale: 2 })
      .notNull()
      .default("0"),
    isActive: boolean("is_active").notNull().default(true),
    version: integer("version").notNull().default(1),
    ...timestamps,
  },
  (table) => [
    index("parties_name_idx").on(table.name),
    index("parties_roles_idx").on(table.isCustomer, table.isSupplier),
    check(
      "parties_must_have_role",
      sql`${table.isCustomer} = true OR ${table.isSupplier} = true`,
    ),
    check(
      "parties_opening_balances_nonnegative",
      sql`${table.openingReceivable} >= 0 AND ${table.openingPayable} >= 0`,
    ),
  ],
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sku: varchar("sku", { length: 80 }).notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    category: varchar("category", { length: 120 }),
    brand: varchar("brand", { length: 120 }).notNull().default("Crown"),
    unit: varchar("unit", { length: 40 }).notNull().default("Pieces"),
    description: text("description"),
    salePrice: numeric("sale_price", { precision: 18, scale: 2 })
      .notNull()
      .default("0"),
    purchasePrice: numeric("purchase_price", { precision: 18, scale: 2 })
      .notNull()
      .default("0"),
    reorderLevel: numeric("reorder_level", { precision: 18, scale: 3 })
      .notNull()
      .default("0"),
    isSellable: boolean("is_sellable").notNull().default(true),
    isPurchasable: boolean("is_purchasable").notNull().default(true),
    isRawMaterial: boolean("is_raw_material").notNull().default(false),
    isFinishedGood: boolean("is_finished_good").notNull().default(true),
    isActive: boolean("is_active").notNull().default(true),
    version: integer("version").notNull().default(1),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("products_sku_unique").on(table.sku),
    index("products_name_idx").on(table.name),
    check(
      "products_prices_nonnegative",
      sql`${table.salePrice} >= 0 AND ${table.purchasePrice} >= 0`,
    ),
    check(
      "products_business_role_required",
      sql`${table.isSellable} OR ${table.isPurchasable}`,
    ),
  ],
);

export const warehouses = pgTable(
  "warehouses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 40 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    address: text("address"),
    isDefault: boolean("is_default").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (table) => [uniqueIndex("warehouses_code_unique").on(table.code)],
);

export const bankAccounts = pgTable(
  "bank_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 160 }).notNull(),
    bankName: varchar("bank_name", { length: 160 }),
    accountNumber: varchar("account_number", { length: 120 }),
    iban: varchar("iban", { length: 64 }),
    openingBalance: numeric("opening_balance", { precision: 18, scale: 2 })
      .notNull()
      .default("0"),
    isCashAccount: boolean("is_cash_account").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (table) => [uniqueIndex("bank_accounts_name_unique").on(table.name)],
);

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    transactionNumber: varchar("transaction_number", { length: 64 }).notNull(),
    type: transactionTypeEnum("type").notNull(),
    status: transactionStatusEnum("status").notNull().default("posted"),
    partyId: uuid("party_id").references(() => parties.id, {
      onDelete: "restrict",
    }),
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "restrict",
    }),
    bankAccountId: uuid("bank_account_id").references(() => bankAccounts.id, {
      onDelete: "restrict",
    }),
    warehouseId: uuid("warehouse_id").references(() => warehouses.id, {
      onDelete: "restrict",
    }),
    quantity: numeric("quantity", { precision: 18, scale: 3 }),
    unitPrice: numeric("unit_price", { precision: 18, scale: 2 }),
    totalAmount: numeric("total_amount", { precision: 18, scale: 2 }).notNull(),
    paymentMethod: paymentMethodEnum("payment_method")
      .notNull()
      .default("cash"),
    description: text("description").notNull(),
    reference: varchar("reference", { length: 120 }),
    transactionDate: date("transaction_date").notNull(),
    reversedTransactionId: uuid("reversed_transaction_id"),
    version: integer("version").notNull().default(1),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("transactions_number_unique").on(table.transactionNumber),
    index("transactions_date_idx").on(table.transactionDate),
    index("transactions_party_idx").on(table.partyId),
    index("transactions_product_idx").on(table.productId),
    index("transactions_status_type_idx").on(table.status, table.type),
    index("transactions_party_status_idx").on(table.partyId, table.status),
    check("transactions_amount_positive", sql`${table.totalAmount} > 0`),
    check(
      "transactions_quantity_nonnegative",
      sql`${table.quantity} IS NULL OR ${table.quantity} >= 0`,
    ),
  ],
);

export const inventoryMovements = pgTable(
  "inventory_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "restrict" }),
    transactionId: uuid("transaction_id").references(() => transactions.id, {
      onDelete: "restrict",
    }),
    movementType: inventoryMovementTypeEnum("movement_type").notNull(),
    quantityDelta: numeric("quantity_delta", {
      precision: 18,
      scale: 3,
    }).notNull(),
    unitCost: numeric("unit_cost", { precision: 18, scale: 4 }),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    reference: varchar("reference", { length: 120 }),
    notes: text("notes"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("inventory_movements_product_warehouse_idx").on(
      table.productId,
      table.warehouseId,
    ),
    index("inventory_movements_product_id_idx").on(table.productId),
    index("inventory_movements_occurred_at_idx").on(table.occurredAt),
    check("inventory_movement_not_zero", sql`${table.quantityDelta} <> 0`),
  ],
);

export const ledgerAccounts = pgTable(
  "ledger_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 30 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    type: accountTypeEnum("type").notNull(),
    isSystem: boolean("is_system").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (table) => [uniqueIndex("ledger_accounts_code_unique").on(table.code)],
);

export const journalEntries = pgTable(
  "journal_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entryNumber: varchar("entry_number", { length: 64 }).notNull(),
    entryDate: date("entry_date").notNull(),
    description: text("description").notNull(),
    sourceType: varchar("source_type", { length: 50 }).notNull(),
    sourceId: uuid("source_id"),
    status: journalStatusEnum("status").notNull().default("posted"),
    reversalOfId: uuid("reversal_of_id"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("journal_entries_number_unique").on(table.entryNumber),
    index("journal_entries_source_idx").on(table.sourceType, table.sourceId),
  ],
);

export const journalLines = pgTable(
  "journal_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    journalEntryId: uuid("journal_entry_id")
      .notNull()
      .references(() => journalEntries.id, { onDelete: "restrict" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => ledgerAccounts.id, { onDelete: "restrict" }),
    partyId: uuid("party_id").references(() => parties.id, {
      onDelete: "restrict",
    }),
    bankAccountId: uuid("bank_account_id").references(() => bankAccounts.id, {
      onDelete: "restrict",
    }),
    side: journalSideEnum("side").notNull(),
    amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
    memo: text("memo"),
  },
  (table) => [
    index("journal_lines_entry_idx").on(table.journalEntryId),
    index("journal_lines_party_idx").on(table.partyId),
    check("journal_lines_amount_positive", sql`${table.amount} > 0`),
  ],
);

export const bills = pgTable(
  "bills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    billNumber: varchar("bill_number", { length: 64 }).notNull(),
    type: billTypeEnum("type").notNull(),
    status: billStatusEnum("status").notNull().default("draft"),
    partyId: uuid("party_id")
      .notNull()
      .references(() => parties.id, { onDelete: "restrict" }),
    billDate: date("bill_date").notNull(),
    dueDate: date("due_date"),
    supplierNtn: varchar("supplier_ntn", { length: 80 }),
    buyerNtn: varchar("buyer_ntn", { length: 80 }),
    timeOfSupply: varchar("time_of_supply", { length: 80 }),
    termsOfSales: varchar("terms_of_sales", { length: 160 }),
    subtotal: numeric("subtotal", { precision: 18, scale: 2 }).notNull(),
    taxRate: numeric("tax_rate", { precision: 7, scale: 4 })
      .notNull()
      .default("0"),
    taxAmount: numeric("tax_amount", { precision: 18, scale: 2 })
      .notNull()
      .default("0"),
    sedRate: numeric("sed_rate", { precision: 7, scale: 4 })
      .notNull()
      .default("0"),
    sedAmount: numeric("sed_amount", { precision: 18, scale: 2 })
      .notNull()
      .default("0"),
    shippingAmount: numeric("shipping_amount", { precision: 18, scale: 2 })
      .notNull()
      .default("0"),
    discountAmount: numeric("discount_amount", { precision: 18, scale: 2 })
      .notNull()
      .default("0"),
    totalAmount: numeric("total_amount", { precision: 18, scale: 2 }).notNull(),
    notes: text("notes"),
    terms: text("terms"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    version: integer("version").notNull().default(1),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("bills_number_unique").on(table.billNumber),
    index("bills_party_idx").on(table.partyId),
    index("bills_date_idx").on(table.billDate),
    check(
      "bills_amounts_nonnegative",
      sql`${table.subtotal} >= 0 AND ${table.taxAmount} >= 0 AND ${table.shippingAmount} >= 0 AND ${table.discountAmount} >= 0 AND ${table.totalAmount} >= 0`,
    ),
  ],
);

export const billItems = pgTable(
  "bill_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    billId: uuid("bill_id")
      .notNull()
      .references(() => bills.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "restrict",
    }),
    description: varchar("description", { length: 300 }).notNull(),
    quantity: numeric("quantity", { precision: 18, scale: 3 }).notNull(),
    unitPrice: numeric("unit_price", { precision: 18, scale: 2 }).notNull(),
    salesTaxRate: numeric("sales_tax_rate", { precision: 7, scale: 4 })
      .notNull()
      .default("0"),
    salesTaxAmount: numeric("sales_tax_amount", { precision: 18, scale: 2 })
      .notNull()
      .default("0"),
    sedRate: numeric("sed_rate", { precision: 7, scale: 4 })
      .notNull()
      .default("0"),
    sedAmount: numeric("sed_amount", { precision: 18, scale: 2 })
      .notNull()
      .default("0"),
    lineTotal: numeric("line_total", { precision: 18, scale: 2 }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [
    index("bill_items_bill_idx").on(table.billId),
    check(
      "bill_items_valid_values",
      sql`${table.quantity} > 0 AND ${table.unitPrice} >= 0 AND ${table.lineTotal} >= 0`,
    ),
  ],
);

export const workers = pgTable(
  "workers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workerCode: varchar("worker_code", { length: 40 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    phone: varchar("phone", { length: 40 }),
    address: text("address"),
    nationalId: varchar("national_id", { length: 40 }),
    designation: varchar("designation", { length: 120 }),
    monthlySalary: numeric("monthly_salary", { precision: 18, scale: 2 })
      .notNull()
      .default("0"),
    joiningDate: date("joining_date").notNull(),
    status: workerStatusEnum("status").notNull().default("active"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("workers_code_unique").on(table.workerCode),
    index("workers_name_idx").on(table.name),
  ],
);

export const workerPayments = pgTable(
  "worker_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workerId: uuid("worker_id")
      .notNull()
      .references(() => workers.id, { onDelete: "restrict" }),
    salaryMonth: date("salary_month").notNull(),
    grossAmount: numeric("gross_amount", { precision: 18, scale: 2 }).notNull(),
    advanceAmount: numeric("advance_amount", { precision: 18, scale: 2 })
      .notNull()
      .default("0"),
    deductionAmount: numeric("deduction_amount", { precision: 18, scale: 2 })
      .notNull()
      .default("0"),
    paidAmount: numeric("paid_amount", { precision: 18, scale: 2 })
      .notNull()
      .default("0"),
    status: workerPaymentStatusEnum("status").notNull().default("pending"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    notes: text("notes"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("worker_payments_worker_month_unique").on(
      table.workerId,
      table.salaryMonth,
    ),
  ],
);

export const billsOfMaterials = pgTable(
  "bills_of_materials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 64 }).notNull(),
    finishedProductId: uuid("finished_product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    outputQuantity: numeric("output_quantity", { precision: 18, scale: 3 })
      .notNull()
      .default("1"),
    versionNumber: integer("version_number").notNull().default(1),
    isActive: boolean("is_active").notNull().default(true),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [uniqueIndex("boms_code_unique").on(table.code)],
);

export const billOfMaterialItems = pgTable(
  "bill_of_material_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bomId: uuid("bom_id")
      .notNull()
      .references(() => billsOfMaterials.id, { onDelete: "cascade" }),
    materialProductId: uuid("material_product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    quantity: numeric("quantity", { precision: 18, scale: 3 }).notNull(),
    expectedWastePercent: numeric("expected_waste_percent", {
      precision: 7,
      scale: 4,
    })
      .notNull()
      .default("0"),
  },
  (table) => [
    uniqueIndex("bom_items_material_unique").on(
      table.bomId,
      table.materialProductId,
    ),
    check("bom_items_quantity_positive", sql`${table.quantity} > 0`),
  ],
);

export const workOrders = pgTable(
  "work_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderNumber: varchar("order_number", { length: 64 }).notNull(),
    bomId: uuid("bom_id")
      .notNull()
      .references(() => billsOfMaterials.id, { onDelete: "restrict" }),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "restrict" }),
    plannedQuantity: numeric("planned_quantity", {
      precision: 18,
      scale: 3,
    }).notNull(),
    completedQuantity: numeric("completed_quantity", {
      precision: 18,
      scale: 3,
    })
      .notNull()
      .default("0"),
    rejectedQuantity: numeric("rejected_quantity", {
      precision: 18,
      scale: 3,
    })
      .notNull()
      .default("0"),
    status: workOrderStatusEnum("status").notNull().default("planned"),
    plannedStartDate: date("planned_start_date").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    notes: text("notes"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("work_orders_number_unique").on(table.orderNumber),
    index("work_orders_status_idx").on(table.status),
  ],
);

export const qualityChecks = pgTable(
  "quality_checks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workOrderId: uuid("work_order_id")
      .notNull()
      .references(() => workOrders.id, { onDelete: "restrict" }),
    checkName: varchar("check_name", { length: 160 }).notNull(),
    result: varchar("result", { length: 80 }).notNull(),
    measuredValue: varchar("measured_value", { length: 120 }),
    notes: text("notes"),
    checkedBy: uuid("checked_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    checkedAt: timestamp("checked_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("quality_checks_work_order_idx").on(table.workOrderId)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    title: varchar("title", { length: 180 }).notNull(),
    message: text("message").notNull(),
    type: varchar("type", { length: 40 }).notNull().default("info"),
    href: text("href"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("notifications_user_read_idx").on(table.userId, table.readAt),
  ],
);

export const appSettings = pgTable("app_settings", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: jsonb("value").notNull(),
  updatedBy: uuid("updated_by").references(() => users.id, {
    onDelete: "restrict",
  }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: auditActionEnum("action").notNull(),
    entityType: varchar("entity_type", { length: 80 }).notNull(),
    entityId: uuid("entity_id"),
    oldValues: jsonb("old_values"),
    newValues: jsonb("new_values"),
    ipAddress: varchar("ip_address", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("audit_logs_entity_idx").on(table.entityType, table.entityId),
    index("audit_logs_created_at_idx").on(table.createdAt),
  ],
);

export type User = typeof users.$inferSelect;
export type Party = typeof parties.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Bill = typeof bills.$inferSelect;
