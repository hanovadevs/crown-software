# Crown Accumulator Management System

A PostgreSQL-backed factory management system for Crown Accumulator. The
application implements customer/supplier ledgers, products and stock, financial
transactions, invoices and quotations, reports, workers, backups, audit logs,
and the database foundation for manufacturing.

## Current modules

- Secure username/password authentication with monitored login attempts
- Role-ready users and database sessions
- Live dashboard with receivables, payables, cash/bank balance, and products
- Parties that can independently be customers, suppliers, or both
- Products with Crown/SOLO branding, PKR pricing, units, stock limits, and type
- Posted sales, purchases, receipts, payments, deposits, and withdrawals
- Double-entry journal generation for every posted transaction
- Inventory movements with negative-stock protection on sales
- Invoices and quotations with multiple product or custom lines
- Configurable tax, shipping, discounts, print and PDF-ready layouts
- CSV and printable reports
- WhatsApp document handoff using saved party or worker numbers: prepare the PDF, open the addressed chat, then attach and send the downloaded file. Device file sharing is available where supported; the browser cannot confirm WhatsApp delivery.
- Workers and salary foundations
- Full PostgreSQL custom-format export and guarded database restore
- Automatic pre-restore recovery copies with newest-five retention
- BOM, work order, and quality-control database foundation
- PostgreSQL `LISTEN`/`NOTIFY` live refresh across signed-in screens
- Immutable audit events for important actions

## Local setup

Requirements:

- Node.js 22+
- Docker Desktop

Copy `.env.example` to `.env` and choose a strong bootstrap password. Then run:

```powershell
docker compose up -d postgres
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Open `http://localhost:3000`.

The development seed uses the username configured by `ADMIN_USERNAME`. Change
the bootstrap password immediately from Settings.

## Useful commands

```powershell
npm run check
npm run build
npm run db:generate
npm run db:migrate
npm run db:prisma:pull
npm run audit:accounting
npm run db:studio
npm run db:studio:drizzle
docker compose ps
```

`npm run db:studio` opens Prisma Studio at `http://localhost:5555` for browsing
and editing all PostgreSQL tables. Run `npm run db:prisma:pull` after a Drizzle
migration to refresh `prisma/schema.prisma`. Drizzle remains the source of truth
for schema migrations; do not run Prisma Migrate in this project. Studio writes
directly to PostgreSQL and bypasses application audit, stock, and accounting
workflows, so use editing and deletion carefully.

## Full backup and restore

Administrators can open **Settings → Backup & Restore** to export the complete
database as a PostgreSQL custom-format `.dump` file. Import validates the dump,
requires the current administrator password and the phrase `RESTORE CROWN`, then
restores all business records in one database transaction. A recovery backup is
saved automatically before the restore and the five newest recovery copies are
available from the same screen.

The app server needs PostgreSQL 18 command-line tools (`pg_dump` and
`pg_restore`). On Windows they are detected at the standard PostgreSQL 18 path;
for another installation set `POSTGRES_BIN` to its `bin` directory.

## Financial and stock rules

- Currency uses PostgreSQL `numeric`, never floating-point database fields.
- Party customer and supplier roles are independent booleans with a database
  constraint requiring at least one role.
- Every posted financial transaction creates balanced debit and credit lines.
- Only credit sales and purchases change party receivables or payables; cash, bank, and cheque sales and purchases settle immediately.
- Purchases without a tracked product are expensed; purchases with a product increase inventory.
- The dashboard cash and bank balance includes settled sales, purchases, receipts, supplier payments, and worker salary payments. Payroll currently posts against the default cash account.
- Stock is calculated from inventory movements.
- Sales are rejected when the selected warehouse has insufficient stock.
- Posted transactions are reversed with offsetting stock and journal entries rather than hard deleted. The Edit action accepts amount, date, party, product, payment, and reference changes: it checks stock, reverses the original, and posts a linked replacement atomically. The ledger records the correction on the day it is made, preserving earlier statements. Invoice-owned sales must be corrected through invoice cancellation and reissue. Parties and products are archived without erasing financial history.
- Workers are archived without deleting payroll. Editing or reversing a paid salary keeps dated reversing journal entries and the audit trail.
- Issuing a new invoice or tax invoice posts one credit sale, balanced receivable/revenue/tax journal lines, and stock movements for linked products. A quotation does not post. Record customer receipts in Transactions with the invoice number as reference before marking it paid. Cancelling an unpaid posted invoice reverses its sale, journal, and stock. Older invoices remain unlinked until manually reconciled to avoid duplicate sales.
- Sequential document numbers are generated atomically in PostgreSQL.
- All business dates display in the `Asia/Karachi` timezone.

`npm run audit:accounting` reads the configured database without changing it and reports party, cash, and payroll journal differences, unbalanced journal entries, bill total mismatches, bank payments without an account, issued invoices without a linked sale, negative stock, and older custom purchases booked to inventory without stock. Use `-- --detailed` for transaction and invoice detail. Add real bank accounts in Settings before recording new bank payments. Reconcile old unlinked invoices and bank payments against source documents before changing their postings.

## Logos

The interface and print layouts use the official Crown and SOLO assets stored
in `public/`.

## Production checklist

Before factory deployment:

1. Replace all values in `.env`, especially the database and admin passwords.
2. Set `SEED_DEMO_DATA=false`.
3. Serve the application only over HTTPS.
4. Put PostgreSQL on a private network and do not expose port 5432 publicly.
5. Schedule encrypted off-site backups and test restoring them.
6. Configure real company information, invoice terms, and tax rules.
7. Create named users with the least privilege required for their roles.
8. Complete acceptance testing with real Crown workflows and opening balances.
