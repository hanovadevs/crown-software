import { Bell, Info } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { listNotifications } from "@/db/operations-queries";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await requireUser();
  const items = await listNotifications(user.id);
  return (
    <main className="page form-page">
      <PageHeader
        title="Notifications"
        description="Stock alerts, payment reminders, and system activity"
      />
      {items.length ? (
        <section className="notification-list">
          {items.map((item) => (
            <article className="card notification-card" key={item.id}>
              <span className="table-icon blue">
                <Bell size={19} />
              </span>
              <div>
                <h2>{item.title}</h2>
                <p>{item.message}</p>
                <time>{item.createdAt.toLocaleString("en-PK")}</time>
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
