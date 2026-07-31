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
- Stock is derived from immutable inventory movements.
- Sales are rejected when the selected warehouse has insufficient stock.
- Posted transactions are designed to be reversed rather than hard deleted.
- Sequential document numbers are generated atomically in PostgreSQL.
- All business dates display in the `Asia/Karachi` timezone.

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
