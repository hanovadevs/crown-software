import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

export function PageHeader({
  title,
  description,
  eyebrow,
  action,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1 className="page-title">{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {action}
    </header>
  );
}

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  color = "#4169f6",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
  color?: string;
}) {
  return (
    <article
      className="card stat-card"
      style={{ "--stat-color": color } as CSSProperties}
    >
      <Icon className="stat-icon" size={26} strokeWidth={1.7} />
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-hint">
        <span>↗</span>
        {hint}
      </div>
    </article>
  );
}

export function QuickCard({
  href,
  icon: Icon,
  title,
  description,
  color,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  color: string;
}) {
  return (
    <Link href={href} className="card quick-card">
      <div
        className="quick-icon"
        style={{ "--quick-color": color } as CSSProperties}
      >
        <Icon size={25} />
      </div>
      <h3 className="quick-title">{title}</h3>
      <p className="quick-description">{description}</p>
    </Link>
  );
}
