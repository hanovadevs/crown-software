import { config } from "dotenv";
import { Pool } from "pg";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required for the read-only accounting audit.");

const remote = !connectionString.includes("localhost") && !connectionString.includes("127.0.0.1");
const pool = new Pool({ connectionString, connectionTimeoutMillis: 5_000, ssl: remote ? { rejectUnauthorized: false } : undefined });

function toCents(value: string) {
  const negative = value.startsWith("-");
  const [whole, fraction = ""] = (negative ? value.slice(1) : value).split(".");
  const cents = BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0").slice(0, 2));
  return negative ? -cents : cents;
}

function formatCents(value: bigint) {
  const negative = value < BigInt(0) ? "-" : "";
  const absolute = value < BigInt(0) ? -value : value;
  return `${negative}${absolute / BigInt(100)}.${String(absolute % BigInt(100)).padStart(2, "0")}`;
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN READ ONLY");
    const partyDifferences = await client.query(`
      WITH postings AS (
        SELECT party_id,
          COALESCE(SUM(total_amount) FILTER (WHERE type = 'sale' AND payment_method = 'credit'), 0)
            - COALESCE(SUM(total_amount) FILTER (WHERE type = 'customer_receipt'), 0) AS receivable,
          COALESCE(SUM(total_amount) FILTER (WHERE type = 'purchase' AND payment_method = 'credit'), 0)
            - COALESCE(SUM(total_amount) FILTER (WHERE type = 'supplier_payment'), 0) AS payable
        FROM transactions WHERE status = 'posted' AND party_id IS NOT NULL GROUP BY party_id
      ), journal AS (
        SELECT jl.party_id,
          COALESCE(SUM(CASE WHEN la.code = '1100' THEN CASE WHEN jl.side = 'debit' THEN jl.amount ELSE -jl.amount END ELSE 0 END), 0) AS receivable,
          COALESCE(SUM(CASE WHEN la.code = '2000' THEN CASE WHEN jl.side = 'credit' THEN jl.amount ELSE -jl.amount END ELSE 0 END), 0) AS payable
        FROM journal_lines jl JOIN journal_entries je ON je.id = jl.journal_entry_id
        JOIN ledger_accounts la ON la.id = jl.account_id
        WHERE je.status = 'posted' AND jl.party_id IS NOT NULL GROUP BY jl.party_id
      )
      SELECT p.name, COALESCE(t.receivable, 0) AS transaction_receivable,
        COALESCE(j.receivable, 0) AS journal_receivable,
        COALESCE(t.payable, 0) AS transaction_payable,
        COALESCE(j.payable, 0) AS journal_payable
      FROM parties p LEFT JOIN postings t ON t.party_id = p.id LEFT JOIN journal j ON j.party_id = p.id
      WHERE COALESCE(t.receivable, 0) <> COALESCE(j.receivable, 0)
         OR COALESCE(t.payable, 0) <> COALESCE(j.payable, 0)
      ORDER BY p.name
    `);
    const cashDifference = await client.query(`
      SELECT
        (SELECT COALESCE(SUM(CASE
          WHEN type IN ('bank_deposit', 'customer_receipt') OR (type = 'sale' AND payment_method <> 'credit') THEN total_amount
          WHEN type IN ('bank_withdrawal', 'supplier_payment') OR (type = 'purchase' AND payment_method <> 'credit') THEN -total_amount
          ELSE 0 END), 0) FROM transactions WHERE status = 'posted')
          - (SELECT COALESCE(SUM(paid_amount), 0) FROM worker_payments) AS source_movement,
        (SELECT COALESCE(SUM(CASE WHEN jl.side = 'debit' THEN jl.amount ELSE -jl.amount END), 0)
          FROM journal_lines jl JOIN journal_entries je ON je.id = jl.journal_entry_id
          JOIN ledger_accounts la ON la.id = jl.account_id
          WHERE je.status = 'posted' AND la.code = '1000') AS journal_movement
    `);
    const billMismatches = await client.query(`
      SELECT b.bill_number, b.total_amount,
        COALESCE(SUM(bi.line_total), 0) + b.shipping_amount - b.discount_amount AS line_total
      FROM bills b JOIN bill_items bi ON bi.bill_id = b.id
      GROUP BY b.id HAVING b.total_amount <> COALESCE(SUM(bi.line_total), 0) + b.shipping_amount - b.discount_amount
      ORDER BY b.bill_number
    `);
    const unbalancedJournals = await client.query(`
      SELECT je.entry_number,
        COALESCE(SUM(CASE WHEN jl.side = 'debit' THEN jl.amount ELSE -jl.amount END), 0) AS difference
      FROM journal_entries je LEFT JOIN journal_lines jl ON jl.journal_entry_id = je.id
      WHERE je.status = 'posted' GROUP BY je.id
      HAVING COALESCE(SUM(CASE WHEN jl.side = 'debit' THEN jl.amount ELSE -jl.amount END), 0) <> 0
      ORDER BY je.entry_number
    `);
    const payrollDifferenceResult = await client.query(`
      SELECT
        (SELECT COALESCE(SUM(paid_amount), 0) FROM worker_payments) AS payment_total,
        (SELECT COALESCE(SUM(CASE WHEN jl.side = 'debit' THEN jl.amount ELSE -jl.amount END), 0)
          FROM journal_lines jl JOIN journal_entries je ON je.id = jl.journal_entry_id
          JOIN ledger_accounts la ON la.id = jl.account_id
          WHERE je.status = 'posted' AND la.code = '5100'
            AND je.source_type IN ('worker_payment', 'worker_payment_reversal')) AS journal_total
    `);
    const unassignedPayments = await client.query(`
      SELECT t.transaction_number, TO_CHAR(t.transaction_date, 'YYYY-MM-DD') AS transaction_date,
        t.type, t.payment_method, t.total_amount, p.name AS party
      FROM transactions t LEFT JOIN parties p ON p.id = t.party_id
      WHERE t.status = 'posted' AND t.bank_account_id IS NULL AND t.payment_method IN ('bank', 'cheque')
      ORDER BY t.transaction_number
    `);
    const [linkColumn] = (await client.query(`
      SELECT EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'bills' AND column_name = 'posted_transaction_id') AS exists
    `)).rows as Array<{ exists: boolean }>;
    const unlinkedInvoices = await client.query(linkColumn.exists ? `
      SELECT bill_number, TO_CHAR(bill_date, 'YYYY-MM-DD') AS bill_date, total_amount, status FROM bills
      WHERE type <> 'quotation' AND status <> 'cancelled' AND posted_transaction_id IS NULL
      ORDER BY bill_date, bill_number
    ` : `
      SELECT bill_number, TO_CHAR(bill_date, 'YYYY-MM-DD') AS bill_date, total_amount, status FROM bills
      WHERE type <> 'quotation' AND status <> 'cancelled'
      ORDER BY bill_date, bill_number
    `);
    const negativeStock = await client.query(`
      SELECT p.sku, w.code AS warehouse, SUM(im.quantity_delta) AS stock
      FROM inventory_movements im JOIN products p ON p.id = im.product_id
      JOIN warehouses w ON w.id = im.warehouse_id
      GROUP BY p.id, w.id HAVING SUM(im.quantity_delta) < 0 ORDER BY p.sku, w.code
    `);
    const untrackedInventoryPurchases = await client.query(`
      SELECT t.transaction_number, t.total_amount
      FROM transactions t JOIN journal_entries je ON je.source_type = 'transaction' AND je.source_id = t.id
      JOIN journal_lines jl ON jl.journal_entry_id = je.id
      JOIN ledger_accounts la ON la.id = jl.account_id
      WHERE t.status = 'posted' AND t.type = 'purchase' AND t.product_id IS NULL
        AND la.code = '1200' AND jl.side = 'debit'
      ORDER BY t.transaction_number
    `);
    const cash = cashDifference.rows[0] as { source_movement: string; journal_movement: string };
    const payroll = payrollDifferenceResult.rows[0] as { payment_total: string; journal_total: string };
    const findings = {
      partyJournalDifferences: partyDifferences.rows,
      cashJournalDifference: formatCents(toCents(cash.source_movement) - toCents(cash.journal_movement)),
      payrollJournalDifference: formatCents(toCents(payroll.payment_total) - toCents(payroll.journal_total)),
      unbalancedJournals: unbalancedJournals.rows,
      billLineMismatches: billMismatches.rows,
      unassignedBankPayments: unassignedPayments.rows,
      unlinkedIssuedInvoices: unlinkedInvoices.rows,
      negativeStock: negativeStock.rows,
      untrackedInventoryPurchases: untrackedInventoryPurchases.rows,
    };
    if (process.argv.includes("--detailed")) {
      const settledPostings = await client.query(`
        SELECT p.name AS party, t.type, t.payment_method, COUNT(*) AS count, SUM(t.total_amount) AS amount
        FROM transactions t JOIN parties p ON p.id = t.party_id
        WHERE t.status = 'posted' AND t.type IN ('sale', 'purchase') AND t.payment_method <> 'credit'
        GROUP BY p.id, t.type, t.payment_method ORDER BY p.name, t.type
      `);
      const bills = await client.query(`
        SELECT b.bill_number, b.type, b.status, TO_CHAR(b.bill_date, 'YYYY-MM-DD') AS bill_date, b.total_amount, p.name AS party,
          (SELECT COUNT(*) FROM transactions t WHERE t.party_id = b.party_id AND t.type = 'sale'
            AND t.status = 'posted' AND t.transaction_date = b.bill_date) AS same_day_sales,
          (SELECT COALESCE(SUM(t.total_amount), 0) FROM transactions t WHERE t.party_id = b.party_id
            AND t.type = 'sale' AND t.status = 'posted' AND t.transaction_date = b.bill_date) AS same_day_sale_amount
        FROM bills b JOIN parties p ON p.id = b.party_id ORDER BY b.bill_date, b.bill_number
      `);
      const transactions = await client.query(`
        SELECT t.transaction_number, TO_CHAR(t.transaction_date, 'YYYY-MM-DD') AS transaction_date, t.type, t.status, t.total_amount,
          p.name AS party, pr.name AS product, t.payment_method, t.bank_account_id IS NOT NULL AS account_linked
        FROM transactions t LEFT JOIN parties p ON p.id = t.party_id
        LEFT JOIN products pr ON pr.id = t.product_id
        ORDER BY t.transaction_date, t.transaction_number
      `);
      const billItems = await client.query(`
        SELECT b.bill_number, bi.description, bi.quantity, bi.unit_price, bi.line_total,
          pr.sku AS product_sku
        FROM bill_items bi JOIN bills b ON b.id = bi.bill_id
        LEFT JOIN products pr ON pr.id = bi.product_id
        ORDER BY b.bill_number, bi.sort_order
      `);
      console.log(JSON.stringify({ settledPostings: settledPostings.rows, bills: bills.rows, transactions: transactions.rows, billItems: billItems.rows }, null, 2));
    }
    await client.query("COMMIT");
    console.log(JSON.stringify(findings, null, 2));
    if (partyDifferences.rowCount || billMismatches.rowCount || unbalancedJournals.rowCount || unassignedPayments.rowCount || unlinkedInvoices.rowCount || negativeStock.rowCount || untrackedInventoryPurchases.rowCount || findings.cashJournalDifference !== "0.00" || findings.payrollJournalDifference !== "0.00") {
      process.exitCode = 1;
    }
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => pool.end());
