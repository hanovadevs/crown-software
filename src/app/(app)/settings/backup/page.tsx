import { ArchiveRestore, DatabaseBackup, Download, HardDrive, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { pool } from "@/db";
import { requireUser } from "@/lib/auth";
import { formatBackupBytes, listSafetyBackups } from "@/lib/database-backup";
import { formatDate } from "@/lib/utils";
import { RestoreForm } from "./restore-form";

export const metadata: Metadata = { title: "Backup & Restore" };

export default async function BackupPage() {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/settings");
  const [sizeResult, backups] = await Promise.all([
    pool.query<{ size: string }>("SELECT pg_database_size(current_database())::text AS size"),
    listSafetyBackups(),
  ]);
  const databaseSize = Number(sizeResult.rows[0]?.size ?? 0);

  return (
    <main className="page form-page">
      <PageHeader
        title="Backup & Restore"
        description="Protect the complete Crown Accumulator database"
      />
      <section className="backup-overview">
        <article className="card backup-stat">
          <HardDrive size={22} />
          <div><span>Live database size</span><strong>{formatBackupBytes(databaseSize)}</strong></div>
        </article>
        <article className="card backup-stat">
          <ShieldCheck size={22} />
          <div><span>Automatic recovery copies</span><strong>{backups.length}</strong></div>
        </article>
      </section>

      <section className="card backup-panel">
        <span className="backup-icon">
          <DatabaseBackup size={34} />
        </span>
        <div>
          <h2>Export Complete Database</h2>
          <p>
            Creates a complete compressed PostgreSQL backup containing company
            records, ledger entries, stock movements, bills, workers, and audit
            history.
          </p>
          <a className="button button-primary" href="/api/backup">
            <Download size={19} /> Export All Data
          </a>
        </div>
      </section>
      <section className="card restore-panel">
        <ArchiveRestore size={28} />
        <div>
          <h2>Import Complete Database</h2>
          <p>
            Restores parties, products, stock, transactions, bills, accounts,
            workers, payroll, users, settings, and audit history together.
            Validation finishes before the current database is changed.
          </p>
          <RestoreForm />
        </div>
      </section>

      <section className="card table-card">
        <div className="table-title">
          <div><h2>Automatic recovery backups</h2><p>Created immediately before every restore; the newest five are retained.</p></div>
          <span>{backups.length} saved</span>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Backup</th><th>Created</th><th>Size</th><th>Action</th></tr></thead>
            <tbody>
              {backups.length ? backups.map((backup) => (
                <tr key={backup.filename}>
                  <td>{backup.filename}</td>
                  <td>{formatDate(backup.createdAt)}</td>
                  <td>{formatBackupBytes(backup.size)}</td>
                  <td><Link className="table-action" href={`/api/backup/safety/${encodeURIComponent(backup.filename)}`}><Download size={16} /> Download</Link></td>
                </tr>
              )) : <tr><td className="table-empty" colSpan={4}>No restore has been performed, so no recovery copy is needed yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
