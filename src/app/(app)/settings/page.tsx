import { Building2, DatabaseBackup, Landmark } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { PageHeader } from "@/components/ui";
import { getCompanySettings } from "@/db/operations-queries";
import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import { bankAccounts, parties, transactions } from "@/db/schema";
import { and, asc, eq, isNull, inArray } from "drizzle-orm";
import { PasswordForm } from "./password-form";
import { BankAccountForm } from "./bank-account-form";
import { LegacyBankAssignment } from "./legacy-bank-assignment";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const [user, settings, accounts, legacyBankTransactions] = await Promise.all([
    requireUser(),
    getCompanySettings(),
    db.select({ id: bankAccounts.id, name: bankAccounts.name, bankName: bankAccounts.bankName,
      isCashAccount: bankAccounts.isCashAccount, isActive: bankAccounts.isActive })
      .from(bankAccounts).orderBy(asc(bankAccounts.name)),
    db.select({ id: transactions.id, number: transactions.transactionNumber,
      date: transactions.transactionDate, amount: transactions.totalAmount,
      type: transactions.type, partyName: parties.name })
      .from(transactions).leftJoin(parties, eq(transactions.partyId, parties.id))
      .where(and(eq(transactions.status, "posted"), isNull(transactions.bankAccountId),
        inArray(transactions.paymentMethod, ["bank", "cheque"])))
      .orderBy(asc(transactions.transactionDate), asc(transactions.transactionNumber)),
  ]);
  const company = (settings.company ?? {}) as Record<string, string>;
  return (
    <main className="page">
      <PageHeader
        title="Settings"
        description="Company configuration, account security, and data protection"
      />
      <section className="settings-grid">
        <article className="card panel settings-card">
          <div className="settings-heading">
            <span className="table-icon green">
              <Building2 size={19} />
            </span>
            <div>
              <h2>Company</h2>
              <p>Branding and financial defaults</p>
            </div>
          </div>
          <dl className="settings-list">
            <div>
              <dt>Name</dt>
              <dd>{company.name ?? "Crown Accumulator"}</dd>
            </div>
            <div>
              <dt>Factory Address</dt>
              <dd>{company.address ?? "55/28-C, AKBAR COLONY, MOMINPURA ROAD, DAROGHAWALA, LAHORE"}</dd>
            </div>
            <div>
              <dt>Phone / Contact</dt>
              <dd>{company.phone ?? "+92 300 1234567"}</dd>
            </div>
            <div>
              <dt>Sales Tax NTN</dt>
              <dd>{company.taxNumber ?? "1234567-8"}</dd>
            </div>
            <div>
              <dt>Currency</dt>
              <dd>{company.currency ?? "PKR"}</dd>
            </div>
            <div>
              <dt>Timezone</dt>
              <dd>{company.timezone ?? "Asia/Karachi"}</dd>
            </div>
          </dl>
          <div className="settings-brand-assets" aria-label="Company brand assets">
            <Image src="/CrownAccumulatorbox.jpeg" alt="Crown Accumulator" width={300} height={291} />
            <Image src="/solo-removebg-preview.png" alt="SOLO" width={675} height={379} />
          </div>
        </article>
        <PasswordForm required={user.mustChangePassword} />
        <article className="card panel settings-card">
          <div className="settings-heading">
            <span className="table-icon blue"><Landmark size={19} /></span>
            <div><h2>Cash & Bank Accounts</h2><p>Transactions must use a specific account for accurate bank reports.</p></div>
          </div>
          <ul>{accounts.map((account) => <li key={account.id}>
            {account.name} {account.isCashAccount ? "(Cash)" : `(${account.bankName ?? "Bank"})`}{account.isActive ? "" : " — archived"}
          </li>)}</ul>
        </article>
        {user.role === "admin" && <BankAccountForm />}
        {user.role === "admin" && legacyBankTransactions.length > 0 && <article className="card panel settings-card">
          <div className="settings-heading"><span className="table-icon blue"><Landmark size={19} /></span>
            <div><h2>Assign Historical Bank Entries</h2><p>Match each entry to the bank statement before assigning it. The amount and party will not change.</p></div></div>
          {legacyBankTransactions.map((item) => <div key={item.id} className="field">
            <strong>{item.number}</strong> · {String(item.date)} · {item.partyName ?? item.type} · PKR {item.amount}
            <LegacyBankAssignment transactionId={item.id} accounts={accounts.filter((account) => !account.isCashAccount && account.isActive)} />
          </div>)}
        </article>}
        <Link className="card panel backup-link-card" href="/settings/backup">
          <span className="table-icon red">
            <DatabaseBackup size={20} />
          </span>
          <div>
            <h2>Backup & Restore</h2>
            <p>Download a complete PostgreSQL backup.</p>
          </div>
        </Link>
      </section>
    </main>
  );
}
