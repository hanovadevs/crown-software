import { sql } from "drizzle-orm";

type SqlExecutor = {
  execute: (query: ReturnType<typeof sql>) => Promise<{ rows: unknown[] }>;
};

export async function nextDocumentNumber(
  executor: SqlExecutor,
  key: string,
  prefix: string,
  documentDate = new Date(),
) {
  const year = documentDate.getFullYear();
  const sequenceKey = `${key}:${year}`;
  const result = await executor.execute(sql`
    INSERT INTO document_sequences (key, last_number, updated_at)
    VALUES (${sequenceKey}, 1, NOW())
    ON CONFLICT (key)
    DO UPDATE SET last_number = document_sequences.last_number + 1, updated_at = NOW()
    RETURNING last_number
  `);
  const row = result.rows[0] as { last_number: number };
  return `${prefix}-${year}-${String(row.last_number).padStart(5, "0")}`;
}
