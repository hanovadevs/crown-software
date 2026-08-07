import { AlertTriangle, ArrowRight, Bell, ClipboardCheck, Info, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { listNotifications } from "@/db/operations-queries";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Notifications & System Alerts" };

export default async function NotificationsPage() {
  const user = await requireUser();
  const items = await listNotifications(user.id);

  function getIcon(type: string) {
    switch (type) {
      case "stock":
        return <AlertTriangle size={20} />;
      case "gate_pass":
        return <ClipboardCheck size={20} />;
      case "payment":
        return <Wallet size={20} />;
      default:
        return <Bell size={20} />;
    }
  }

  function getIconClass(type: string, severity: string) {
    if (severity === "danger") return "table-icon red";
    if (severity === "warning") return "table-icon orange";
    if (type === "gate_pass") return "table-icon cyan";
    return "table-icon blue";
  }

  return (
    <main className="page">
      <PageHeader
        title="Notifications & Live Alerts"
        description="Real-time stock restock alerts, returnable gate pass reminders, and pending payment notices"
      />

      {items.length ? (
        <section className="notification-list">
          {items.map((item) => (
            <article className="card notification-card" key={item.id}>
              <span className={getIconClass(item.type, item.severity)}>
                {getIcon(item.type)}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                  <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>{item.title}</h2>
                  <span
                    className={`badge ${
                      item.severity === "danger"
                        ? "badge-danger"
                        : item.severity === "warning"
                        ? "badge-warning"
                        : "badge-primary"
                    }`}
                    style={{ fontSize: "0.7rem", textTransform: "uppercase" }}
                  >
                    {item.severity}
                  </span>
                </div>
                <p style={{ margin: "4px 0 10px", color: "var(--muted-strong)", fontSize: "0.9rem" }}>
                  {item.message}
                </p>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <time style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
                    {new Date(item.createdAt).toLocaleString("en-PK", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </time>
                  {item.link && (
                    <Link className="button button-secondary small-button" href={item.link}>
                      View Details <ArrowRight size={14} />
                    </Link>
                  )}
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="card empty-state">
          <Info size={42} />
          <h2>You’re all caught up</h2>
          <p>New stock alerts and operational notices will appear here.</p>
        </section>
      )}
    </main>
  );
}
