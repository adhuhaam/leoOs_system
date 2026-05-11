import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  UploadCloud,
  FileSignature,
  Users,
  Building,
  Wallet,
  Receipt,
  Menu,
  X,
  Settings,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { logout } from "@workspace/api-client-react";
import leoLogo from "@assets/image_1778408412841.png";
import { useSystemSettings } from "@/hooks/use-system-settings";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, group: "Overview" },
  { href: "/upload", label: "Process Document", icon: UploadCloud, group: "Operations" },
  { href: "/master-list", label: "Master List", icon: Users, group: "Operations" },
  { href: "/clients", label: "Clients", icon: Building, group: "Operations" },
  { href: "/loa", label: "Letter of Appointment", icon: FileSignature, group: "Operations" },
  { href: "/expenses", label: "Expenses", icon: Wallet, group: "Operations" },
  { href: "/billing", label: "Invoices & Quotes", icon: Receipt, group: "Operations" },
  { href: "/settings", label: "Settings", icon: Settings, group: "System" },
];

function BrandMark({ size = "default" }: { size?: "default" | "small" }) {
  const dim = size === "small" ? "h-7 w-7" : "h-8 w-8";
  const text = size === "small" ? "text-sm" : "text-base";
  const { appName, logoImage } = useSystemSettings();
  const initial = (appName.trim()[0] ?? "L").toUpperCase();
  return (
    <div className="flex items-center gap-2.5">
      <div
        className={`${dim} relative flex-shrink-0 rounded-lg flex items-center justify-center shadow-[0_4px_12px_-2px_rgba(60,140,120,0.5)] overflow-hidden`}
        style={{
          background: logoImage
            ? "transparent"
            : "linear-gradient(135deg, hsl(var(--brand-grad-from)), hsl(var(--brand-grad-via)), hsl(var(--brand-grad-to)))",
        }}
      >
        {logoImage ? (
          <img src={logoImage} alt={appName} className="h-full w-full object-cover" />
        ) : (
          <>
            <span className="font-extrabold text-white text-[11px] tracking-tighter">{initial}</span>
            <div className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-300 ring-2 ring-sidebar" />
          </>
        )}
      </div>
      <div className="flex flex-col leading-tight">
        <span className={`${text} font-bold tracking-tight text-black`}>{appName}</span>
      </div>
    </div>
  );
}

function SidebarNav({ onClose }: { onClose?: () => void }) {
  const [location] = useLocation();

  const groups = navItems.reduce<Record<string, typeof navItems>>((acc, item) => {
    (acc[item.group] ||= []).push(item);
    return acc;
  }, {});

  return (
    <>
      <div className="flex items-center gap-2 px-5 py-5 border-b border-sidebar-border">
        <BrandMark />
      </div>
      <nav className="flex-1 py-3 overflow-y-auto">
        {Object.entries(groups).map(([group, items]) => (
          <div key={group} className="mb-4">
            <p className="px-5 pb-2 text-[10px] font-mono uppercase tracking-[0.15em] text-sidebar-foreground/65">
              {group}
            </p>
            {items.map(({ href, label, icon: Icon }) => {
              const active = location === href;
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onClose}
                  className={`relative mx-2 flex items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium transition-all duration-150
                    ${active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/85 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"
                    }`}
                  data-testid={`nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  {active && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-sidebar-primary" />
                  )}
                  <Icon className={`h-4 w-4 flex-shrink-0 ${active ? "text-sidebar-primary" : ""}`} />
                  <span className="truncate">{label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      {/* Footer — brand logo + logout */}
      <div className="border-t border-sidebar-border px-3 py-4 space-y-2">
        <div className="rounded-lg bg-[#e8dec4] px-3 py-3 flex items-center justify-center">
          <img
            src={leoLogo}
            alt="LEO Employment Services"
            className="w-full h-auto max-h-14 object-contain"
          />
        </div>
        <LogoutButton />
      </div>
    </>
  );
}

function LogoutButton() {
  const qc = useQueryClient();
  async function onClick() {
    try {
      await logout();
    } catch {
      // ignore — we still want to clear local state
    }
    await qc.invalidateQueries({ queryKey: ["/auth/me"] });
    qc.clear();
  }
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-center gap-2 rounded-md px-3 py-2 text-[12px] font-medium text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition"
      data-testid="button-logout"
    >
      <LogOut className="h-3.5 w-3.5" />
      Sign out
    </button>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full bg-app-shell">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-60 flex-shrink-0 bg-sidebar border-r border-sidebar-border">
        <SidebarNav />
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar drawer */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-sidebar border-r border-sidebar-border flex flex-col
          transform transition-transform duration-200 ease-out md:hidden
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center justify-end px-3 pt-3">
          <button
            onClick={() => setMobileOpen(false)}
            className="p-1.5 rounded text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition"
            data-testid="button-close-sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <SidebarNav onClose={() => setMobileOpen(false)} />
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header className="flex md:hidden items-center gap-3 px-4 py-3 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-30">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setMobileOpen(true)}
            data-testid="button-open-sidebar"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <BrandMark size="small" />
        </header>

        <div className="flex-1 overflow-auto p-4 md:p-8 lg:p-10">
          {children}
        </div>
      </main>
    </div>
  );
}
