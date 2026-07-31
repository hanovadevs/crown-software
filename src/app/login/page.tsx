import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { getSession } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in",
};
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <main className="login-page">
      <div className="login-wrap">
        <div className="login-brand">
          <Brand compact />
          <h1>Crown Accumulator</h1>
          <p>Management System Login</p>
        </div>
        <section className="card login-card">
          <LoginForm />
          <div className="security-note">
            <ShieldCheck size={22} color="#6690ff" />
            <div>
              <strong>Secure Access</strong>
              Only authorized personnel can access this management system. All
              login attempts are monitored.
            </div>
          </div>
        </section>
        <div className="login-footer">
          © {new Date().getFullYear()} Crown Accumulator Management System
        </div>
      </div>
    </main>
  );
}
