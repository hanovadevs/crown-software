"use client";

import {
  Bell,
  Boxes,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  ReceiptText,
  Search,
  Settings,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { logoutAction } from "@/app/actions/auth";
import { Brand } from "./brand";
import { LiveRefresh } from "./live-refresh";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/parties", label: "Customers/Suppliers", icon: Users },
  { href: "/products", label: "Products", icon: Package },
  { href: "/transactions", label: "Transactions", icon: Boxes },
  { href: "/bills/new", label: "Generate Bill", icon: ReceiptText },
  { href: "/reports", label: "Reports", icon: FileText },
];

export function AppShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: { displayName: string; role: string };
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const avatarText = user.displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div className="app-shell">
      <LiveRefresh />
      <header className="topbar">
        <Link href="/dashboard" aria-label="Crown Accumulator dashboard">
          <Brand />
        </Link>

        <nav className={`topnav ${menuOpen ? "open" : ""}`} aria-label="Main">
          {links.map(({ href, label, icon: Icon }) => {
            const active =
              pathname === href ||
              (href !== "/dashboard" &&
                pathname.startsWith(href.replace("/new", "")));
            return (
              <Link
                className={`nav-link ${active ? "active" : ""}`}
                href={href}
                key={href}
                onClick={() => setMenuOpen(false)}
              >
                <Icon size={21} strokeWidth={1.8} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="topbar-actions">
          <Link
            className="icon-button search-button"
            href="/search"
            aria-label="Search"
          >
            <Search size={21} />
          </Link>
          <Link className="icon-button" href="/notifications" aria-label="Notifications">
            <Bell size={21} />
          </Link>
          <Link
            className="icon-button settings-button"
            href="/settings"
            aria-label="Settings"
          >
            <Settings size={22} />
          </Link>
          <form action={logoutAction} className="logout-button">
            <button className="icon-button" type="submit" aria-label="Sign out">
              <LogOut size={20} />
            </button>
          </form>
          <div
            className="avatar"
            title={`${user.displayName} · ${user.role}`}
            aria-label={`${user.displayName}, ${user.role}`}
          >
            {avatarText || "CA"}
          </div>
          <button
            className="icon-button mobile-menu-button"
            onClick={() => setMenuOpen((open) => !open)}
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={23} /> : <Menu size={23} />}
          </button>
        </div>
      </header>
      {children}
    </div>
  );
}
