import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";

const connectionString = process.env.DATABASE_URL;
const pool = connectionString ? new Pool({ connectionString }) : null;

afterAll(async () => {
  await pool?.end();
});

describe.runIf(Boolean(connectionString))("database accounting invariants", () => {
  it("has no parties without a customer or supplier role", async () => {
    const result = await pool!.query<{ invalid_count: string }>(
      "SELECT COUNT(*) AS invalid_count FROM parties WHERE NOT is_customer AND NOT is_supplier",
    );
    expect(Number(result.rows[0]?.invalid_count)).toBe(0);
  });

  it("keeps every posted journal entry balanced", async () => {
    const result = await pool!.query<{
      entry_number: string;
      debits: string;
      credits: string;
    }>(`
      SELECT
        je.entry_number,
        SUM(CASE WHEN jl.side = 'debit' THEN jl.amount ELSE 0 END) AS debits,
        SUM(CASE WHEN jl.side = 'credit' THEN jl.amount ELSE 0 END) AS credits
      FROM journal_entries je
      JOIN journal_lines jl ON jl.journal_entry_id = je.id
      WHERE je.status = 'posted'
      GROUP BY je.id
      HAVING
        SUM(CASE WHEN jl.side = 'debit' THEN jl.amount ELSE 0 END)
        <>
        SUM(CASE WHEN jl.side = 'credit' THEN jl.amount ELSE 0 END)
    `);
    expect(result.rows).toEqual([]);
  });

  it("keeps document numbers unique", async () => {
    const result = await pool!.query<{ duplicates: string }>(`
      SELECT COUNT(*) AS duplicates
      FROM (
        SELECT transaction_number
        FROM transactions
        GROUP BY transaction_number
        HAVING COUNT(*) > 1
      ) duplicate_numbers
    `);
    expect(Number(result.rows[0]?.duplicates)).toBe(0);
  });
});
