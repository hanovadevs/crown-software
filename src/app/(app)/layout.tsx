import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  return (
    <AppShell user={{ displayName: user.displayName, role: user.role }}>
      {children}
    </AppShell>
  );
}
