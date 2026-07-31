import "server-only";

import { count, desc, eq, sql } from "drizzle-orm";
import { db } from ".";
import { inventoryMovements, parties, products, transactions, warehouses } from "./schema";

export async function getDashboardSummary() {
  const [[productResult], [customerResult], [supplierResult], balancesResult, healthResult] =
    await Promise.all([
      db
        .select({ value: count() })
        .from(products)
        .where(eq(products.isActive, true)),
      db
        .select({ value: count() })
        .from(parties)
        .where(eq(parties.isCustomer, true)),
      db
        .select({ value: count() })
        .from(parties)
        .where(eq(parties.isSupplier, true)),
      db.execute(sql`
        SELECT
          COALESCE((SELECT SUM(opening_receivable) FROM parties WHERE is_active), 0)
            + COALESCE((SELECT SUM(total_amount) FROM transactions WHERE status = 'posted' AND type = 'sale'), 0)
            - COALESCE((SELECT SUM(total_amount) FROM transactions WHERE status = 'posted' AND type = 'customer_receipt'), 0)
            AS receivables,
          COALESCE((SELECT SUM(opening_payable) FROM parties WHERE is_active), 0)
            + COALESCE((SELECT SUM(total_amount) FROM transactions WHERE status = 'posted' AND type = 'purchase'), 0)
            - COALESCE((SELECT SUM(total_amount) FROM transactions WHERE status = 'posted' AND type = 'supplier_payment'), 0)
            AS payables,
          COALESCE((SELECT SUM(opening_balance) FROM bank_accounts WHERE is_active), 0)
            + COALESCE((SELECT SUM(total_amount) FROM transactions WHERE status = 'posted' AND type IN ('bank_deposit', 'customer_receipt')), 0)
            - COALESCE((SELECT SUM(total_amount) FROM transactions WHERE status = 'posted' AND type IN ('bank_withdrawal', 'supplier_payment')), 0)
            AS company_balance
      `),
      db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE current_stock <= reorder_level) AS low_stock,
          (SELECT COUNT(*) FROM workers WHERE status = 'active') AS active_workers,
          (SELECT COUNT(*)
             FROM workers w
            WHERE w.status = 'active'
              AND NOT EXISTS (
                SELECT 1 FROM worker_payments wp
                 WHERE wp.worker_id = w.id
                   AND DATE_TRUNC('month', wp.salary_month) = DATE_TRUNC('month', CURRENT_DATE)
                   AND wp.status = 'paid'
              )) AS payroll_due
        FROM (
          SELECT p.reorder_level, COALESCE(SUM(im.quantity_delta), 0) AS current_stock
            FROM products p
            LEFT JOIN inventory_movements im ON im.product_id = p.id
           WHERE p.is_active
           GROUP BY p.id
        ) stock_health
      `),
    ]);

  const balances = balancesResult.rows[0] as {
    receivables: string;
    payables: string;
    company_balance: string;
  };
  const health = healthResult.rows[0] as {
    low_stock: string;
    active_workers: string;
    payroll_due: string;
  };

  return {
    products: productResult?.value ?? 0,
    customers: customerResult?.value ?? 0,
    suppliers: supplierResult?.value ?? 0,
    receivables: Number(balances.receivables),
    payables: Number(balances.payables),
    companyBalance: Number(balances.company_balance),
    lowStock: Number(health.low_stock),
    activeWorkers: Number(health.active_workers),
    payrollDue: Number(health.payroll_due),
  };
}

export async function getRecentTransactions(limit = 5) {
  return db
    .select()
    .from(transactions)
    .orderBy(sql`${transactions.createdAt} DESC`)
    .limit(limit);
}

export async function getStockManagerSummary() {
  const [stockMetricsResult, lowStockList, recentMovements] = await Promise.all([
    db.execute(sql`
      SELECT
        COUNT(*) AS total_products,
        COUNT(*) FILTER (WHERE is_raw_material) AS raw_materials,
        COUNT(*) FILTER (WHERE is_finished_good) AS finished_goods,
        COUNT(*) FILTER (WHERE current_stock <= reorder_level) AS low_stock_count,
        COALESCE(SUM(current_stock), 0) AS total_stock_units,
        COALESCE(SUM(current_stock * purchase_price), 0) AS total_stock_value
      FROM (
        SELECT
          p.id,
          p.reorder_level,
          p.purchase_price,
          p.is_raw_material,
          p.is_finished_good,
          COALESCE(SUM(im.quantity_delta), 0) AS current_stock
        FROM products p
        LEFT JOIN inventory_movements im ON im.product_id = p.id
        WHERE p.is_active
        GROUP BY p.id
      ) p_stock
    `),
    db.execute(sql`
      SELECT
        p.id,
        p.sku,
        p.name,
        p.brand,
        p.category,
        p.unit,
        p.reorder_level,
        p.purchase_price,
        COALESCE(SUM(im.quantity_delta), 0) AS current_stock
      FROM products p
      LEFT JOIN inventory_movements im ON im.product_id = p.id
      WHERE p.is_active
      GROUP BY p.id
      HAVING COALESCE(SUM(im.quantity_delta), 0) <= p.reorder_level
      ORDER BY (COALESCE(SUM(im.quantity_delta), 0) - p.reorder_level) ASC
      LIMIT 10
    `),
    db
      .select({
        id: inventoryMovements.id,
        reference: inventoryMovements.reference,
        productName: products.name,
        sku: products.sku,
        warehouseName: warehouses.name,
        movementType: inventoryMovements.movementType,
        quantityDelta: inventoryMovements.quantityDelta,
        unitCost: inventoryMovements.unitCost,
        occurredAt: inventoryMovements.occurredAt,
      })
      .from(inventoryMovements)
      .innerJoin(products, eq(inventoryMovements.productId, products.id))
      .innerJoin(warehouses, eq(inventoryMovements.warehouseId, warehouses.id))
      .orderBy(desc(inventoryMovements.occurredAt))
      .limit(6),
  ]);

  const metrics = stockMetricsResult.rows[0] as {
    total_products: string;
    raw_materials: string;
    finished_goods: string;
    low_stock_count: string;
    total_stock_units: string;
    total_stock_value: string;
  };

  return {
    totalProducts: Number(metrics?.total_products ?? 0),
    rawMaterials: Number(metrics?.raw_materials ?? 0),
    finishedGoods: Number(metrics?.finished_goods ?? 0),
    lowStockCount: Number(metrics?.low_stock_count ?? 0),
    totalStockUnits: Number(metrics?.total_stock_units ?? 0),
    totalStockValue: Number(metrics?.total_stock_value ?? 0),
    lowStockProducts: lowStockList.rows as Array<{
      id: string;
      sku: string;
      name: string;
      brand: string;
      category: string | null;
      unit: string;
      reorder_level: string;
      purchase_price: string;
      current_stock: string;
    }>,
    recentMovements,
  };
}
