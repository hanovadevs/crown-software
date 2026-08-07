"use client";

import {
  Banknote,
  Bell,
  Boxes,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileText,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  ReceiptText,
  Search,
  Settings,
  Users,
  UsersRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { logoutAction } from "@/app/actions/auth";
import { BackForwardNav } from "./back-forward-nav";
import { Brand } from "./brand";
import { LiveRefresh } from "./live-refresh";
import { QuickActionMenu } from "./quick-action-menu";
import { ThemeToggle } from "./theme-toggle";

type NavGroup = {
  title: string;
  items: Array<{
    href: string;
    label: string;
    icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  }>;
};

const adminNavGroups: NavGroup[] = [
  {
    title: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    title: "Sales & Purchasing",
    items: [
      { href: "/transactions", label: "Transactions", icon: Boxes },
      { href: "/bills/new", label: "Generate Bill", icon: ReceiptText },
      { href: "/parties", label: "Parties", icon: Users },
    ],
  },
  {
    title: "Inventory & Factory",
    items: [
      { href: "/products", label: "Products", icon: Package },
      { href: "/stock", label: "Stock Levels", icon: Boxes },
      { href: "/gate-pass", label: "Gate Pass", icon: ClipboardCheck },
    ],
  },
  {
    title: "HR & Reports",
    items: [
      { href: "/workers", label: "Worker Payroll", icon: UsersRound },
      { href: "/reports", label: "Reports", icon: FileText },
    ],
  },
];

const stockManagerNavGroups: NavGroup[] = [
  {
    title: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    title: "Inventory",
    items: [
      { href: "/products", label: "Products", icon: Package },
      { href: "/stock", label: "Stock Levels", icon: Boxes },
      { href: "/stock/adjust", label: "Adjust Stock", icon: Package },
      { href: "/gate-pass", label: "Gate Pass", icon: ClipboardCheck },
    ],
  },
  {
    title: "Reports",
    items: [
      { href: "/reports", label: "Stock Reports", icon: FileText },
    ],
  },
];

export function AppShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: { displayName: string; role: string };
}) {
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navGroups = user.role === "inventory" ? stockManagerNavGroups : adminNavGroups;

  const avatarText = user.displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  // Generate simple breadcrumb title based on path
  const currentPathSegment = pathname.split("/").filter(Boolean)[0] || "dashboard";
  const formattedBreadcrumb =
    currentPathSegment.charAt(0).toUpperCase() +
    currentPathSegment.slice(1).replaceAll("-", " ");

  return (
    <div className={`app-container ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <LiveRefresh />

      {/* Sidebar Navigation */}
      <aside className={`app-sidebar ${mobileMenuOpen ? "mobile-open" : ""}`}>
        <div className="sidebar-header">
          <Link href="/dashboard" className="sidebar-brand-link">
            <Brand compact={sidebarCollapsed} />
          </Link>
          <button
            className="sidebar-toggle-btn"
            onClick={() => setSidebarCollapsed((c) => !c)}
            type="button"
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        <div className="sidebar-scroll">
          {navGroups.map((group) => (
            <div className="nav-group" key={group.title}>
              {!sidebarCollapsed && <span className="nav-group-title">{group.title}</span>}
              {group.items.map(({ href, label, icon: Icon }) => {
                const active =
                  pathname === href ||
                  (href !== "/dashboard" && pathname.startsWith(href.replace("/new", "")));
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`sidebar-nav-link ${active ? "active" : ""}`}
                    onClick={() => setMobileMenuOpen(false)}
                    title={sidebarCollapsed ? label : undefined}
                  >
                    <span className="sidebar-nav-icon">
                      <Icon size={20} strokeWidth={1.8} />
                    </span>
                    {!sidebarCollapsed && <span className="sidebar-nav-text">{label}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-user-card">
            <div className="avatar">{avatarText || "CA"}</div>
            {!sidebarCollapsed && (
              <div className="sidebar-user-info">
                <strong>{user.displayName}</strong>
                <small>{user.role}</small>
              </div>
            )}
          </div>
          <form action={logoutAction}>
            <button
              className="sidebar-logout-btn"
              type="submit"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut size={18} />
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="app-main">
        {/* Topbar Header */}
        <header className="app-header">
          <div className="header-left">
            <button
              className="icon-button mobile-menu-toggle"
              onClick={() => setMobileMenuOpen((open) => !open)}
              type="button"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
            <BackForwardNav />
            <div className="header-breadcrumbs">
              <span className="breadcrumb-root">Crown Accumulator</span>
              <span className="breadcrumb-sep">/</span>
              <span className="breadcrumb-current">{formattedBreadcrumb}</span>
            </div>
          </div>

          <div className="header-right">
            <QuickActionMenu />

            <ThemeToggle />

            <Link className="icon-button header-btn" href="/search" aria-label="Search">
              <Search size={20} />
            </Link>
            <Link className="icon-button header-btn" href="/notifications" aria-label="Notifications">
              <Bell size={20} />
            </Link>
            <Link className="icon-button header-btn" href="/settings" aria-label="Settings">
              <Settings size={20} />
            </Link>

            <div className="header-user-avatar" title={`${user.displayName} · ${user.role}`}>
              {avatarText || "CA"}
            </div>
          </div>
        </header>

        {/* Page Children */}
        <div className="app-content">{children}</div>

        {/* Mobile iPhone Navigation Bottom Bar */}
        <nav className="mobile-bottom-dock" aria-label="Mobile navigation">
          <Link
            href="/dashboard"
            className={`bottom-dock-item ${pathname === "/dashboard" ? "active" : ""}`}
          >
            <Home size={20} />
            <span>Home</span>
          </Link>
          <Link
            href="/parties"
            className={`bottom-dock-item ${pathname.startsWith("/parties") ? "active" : ""}`}
          >
            <Users size={20} />
            <span>Parties</span>
          </Link>
          <Link
            href="/bills/new"
            className={`bottom-dock-item highlight ${pathname === "/bills/new" ? "active" : ""}`}
          >
            <ReceiptText size={22} />
            <span>Bill</span>
          </Link>
          <Link
            href="/gate-pass"
            className={`bottom-dock-item ${pathname.startsWith("/gate-pass") ? "active" : ""}`}
          >
            <ClipboardCheck size={20} />
            <span>Gate Pass</span>
          </Link>
          <button
            className="bottom-dock-item"
            onClick={() => setMobileMenuOpen((open) => !open)}
            type="button"
          >
            <Menu size={20} />
            <span>Menu</span>
          </button>
        </nav>
      </div>

      {/* Backdrop for mobile drawer */}
      {mobileMenuOpen && (
        <div className="mobile-drawer-backdrop" onClick={() => setMobileMenuOpen(false)} />
      )}
    </div>
  );
}

