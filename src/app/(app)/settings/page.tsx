import { Building2, DatabaseBackup } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { PageHeader } from "@/components/ui";
import { getCompanySettings } from "@/db/operations-queries";
import { requireUser } from "@/lib/auth";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const [user, settings] = await Promise.all([
    requireUser(),
    getCompanySettings(),
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
