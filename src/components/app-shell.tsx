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

const stockManagerLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/products", label: "Products", icon: Package },
  { href: "/stock", label: "Stock Levels", icon: Boxes },
  { href: "/stock/adjust", label: "Adjust Stock", icon: Package },
  { href: "/reports", label: "Inventory Reports", icon: FileText },
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
  const activeLinks = user.role === "inventory" ? stockManagerLinks : links;
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

        <nav className={`topnav ${menuOpen ? "open" : ""}`} aria-label="Main navigation">
          {activeLinks.map(({ href, label, icon: Icon }) => {
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
                <Icon size={20} strokeWidth={1.8} />
                <span>{label}</span>
              </Link>
            );
          })}

          <div className="mobile-drawer-footer">
            <div className="mobile-user-info">
              <div className="avatar">{avatarText || "CA"}</div>
              <div>
                <strong>{user.displayName}</strong>
                <small>{user.role}</small>
              </div>
            </div>
            <div className="mobile-drawer-actions">
              <Link className="nav-link" href="/search" onClick={() => setMenuOpen(false)}>
                <Search size={20} />
                <span>Search</span>
              </Link>
              <Link className="nav-link" href="/notifications" onClick={() => setMenuOpen(false)}>
                <Bell size={20} />
                <span>Notifications</span>
              </Link>
              <Link className="nav-link" href="/settings" onClick={() => setMenuOpen(false)}>
                <Settings size={20} />
                <span>Settings</span>
              </Link>
              <form action={logoutAction} className="mobile-logout-form">
                <button className="nav-link mobile-logout-btn" type="submit">
                  <LogOut size={20} />
                  <span>Sign out</span>
                </button>
              </form>
            </div>
          </div>
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
