import React from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  UploadCloud,
  FileSignature,
  Users,
  UserCog,
  Building,
  Building2,
  Wallet,
  Receipt,
  KeyRound,
  Settings,
  ShieldCheck,
  LogOut,
  CircleUserRound,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useQueryClient } from "@tanstack/react-query";
import { logout, useGetAuthStatus } from "@workspace/api-client-react";
import leoLogo from "@assets/image_1778408412841.png";
import { useSystemSettings } from "@/hooks/use-system-settings";

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  roles?: string[]; // undefined = visible to all roles
};

// Role visibility matrix (undefined = all roles; array = restricted to listed roles)
// superuser/admin: see everything
// company: their candidates, their company record, their billing, upload
// client: their candidates, their client record, their billing
// employee/agent: dashboard + master list (read-only internal staff)
// Web sidebar matrix (mirrors mobile tab visibility):
//   employee  → Dashboard only
//   agent     → Dashboard + Master List
//   client    → Dashboard + Master List + Billing
//   company   → Dashboard + Upload + Master List + Companies + LOA + Billing
//   admin/superuser → everything; Settings restricted to admin/superuser
const ALL_NAV_ITEMS: NavItem[] = [
  // Overview — all authenticated roles
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  // Operations
  { href: "/upload", label: "Process Document", icon: UploadCloud, roles: ["superuser", "admin", "company"] },
  { href: "/master-list", label: "Master List", icon: Users, roles: ["superuser", "admin", "company", "client", "agent"] },
  { href: "/companies", label: "Companies", icon: Building2, roles: ["superuser", "admin", "company"] },
  { href: "/clients", label: "Clients", icon: Building, roles: ["superuser", "admin"] },
  { href: "/loa", label: "Letter of Appointment", icon: FileSignature, roles: ["superuser", "admin", "company"] },
  { href: "/expenses", label: "Expenses", icon: Wallet, roles: ["superuser", "admin"] },
  { href: "/billing", label: "Invoices & Quotes", icon: Receipt, roles: ["superuser", "admin", "company", "client"] },
  { href: "/passwords", label: "Passwords", icon: KeyRound, roles: ["superuser", "admin"] },
  // Admin
  { href: "/users", label: "User Management", icon: UserCog, roles: ["superuser", "admin"] },
  // System — superuser only
  { href: "/settings", label: "Settings", icon: Settings, roles: ["superuser"] },
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
        <span className={`${text} font-bold tracking-tight text-sidebar-foreground`}>{appName}</span>
      </div>
    </div>
  );
}

function AppSidebar() {
  const [location] = useLocation();
  const qc = useQueryClient();
  const { isMobile, setOpenMobile } = useSidebar();
  const { data: authData } = useGetAuthStatus({ query: { queryKey: ["/auth/me"], staleTime: 60_000 } });
  const role = (authData as { role?: string | null } | undefined)?.role ?? null;

  const handleNavClick = () => {
    if (isMobile) setOpenMobile(false);
  };

  async function handleLogout() {
    try {
      await logout();
    } catch {
      // ignore — still clear local state
    }
    await qc.invalidateQueries({ queryKey: ["/auth/me"] });
    qc.clear();
  }

  const visibleItems = ALL_NAV_ITEMS.filter(
    (item) => !item.roles || (role && item.roles.includes(role)),
  );

  // Group items
  const overviewItems = visibleItems.filter((i) => i.href === "/");
  const operationsItems = visibleItems.filter(
    (i) =>
      ["/upload", "/master-list", "/companies", "/clients", "/loa", "/expenses", "/billing", "/passwords"].includes(i.href),
  );
  const adminItems = visibleItems.filter((i) => i.href === "/users");
  const systemItems = visibleItems.filter(
    (i) => i.href === "/settings" || i.href === "/system-settings",
  );

  const groups = [
    { group: "Overview", items: overviewItems },
    { group: "Operations", items: operationsItems },
    ...(adminItems.length > 0 ? [{ group: "Admin", items: adminItems }] : []),
    { group: "System", items: systemItems },
  ].filter((g) => g.items.length > 0);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-3 py-4 border-b border-sidebar-border">
        <BrandMark />
      </SidebarHeader>

      <SidebarContent>
        {groups.map(({ group, items }) => (
          <SidebarGroup key={group}>
            <SidebarGroupLabel className="text-[10px] font-mono uppercase tracking-[0.15em]">
              {group}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map(({ href, label, icon: Icon }) => {
                  const active =
                    href === "/"
                      ? location === "/"
                      : location === href ||
                        (href === "/master-list" && location === "/passports");
                  return (
                    <SidebarMenuItem key={href}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={label}
                        data-testid={`nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        <Link href={href} onClick={handleNavClick}>
                          <Icon className="h-4 w-4" />
                          <span>{label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="rounded-lg bg-[#e8dec4] px-3 py-2.5 flex items-center justify-center">
          <img
            src={leoLogo}
            alt="LEO Employment Services"
            className="w-full h-auto max-h-12 object-contain"
          />
        </div>
        {role && (
          <Link
            href="/profile"
            onClick={handleNavClick}
            className="px-2 py-1 flex items-center gap-2 rounded-md hover:bg-sidebar-accent/50 transition group"
            data-testid="link-profile"
          >
            <CircleUserRound className="h-3.5 w-3.5 text-sidebar-foreground/50 group-hover:text-sidebar-foreground transition" />
            <span className="text-[10px] font-mono uppercase tracking-wider text-sidebar-foreground/50 group-hover:text-sidebar-foreground transition">
              {role}
            </span>
          </Link>
        )}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 rounded-md px-3 py-2 text-[12px] font-medium text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition"
          data-testid="button-logout"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        {/* Mobile top bar */}
        <header className="flex md:hidden items-center gap-3 px-4 py-3 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-30">
          <SidebarTrigger className="h-8 w-8" />
          <BrandMark size="small" />
        </header>

        <div className="flex-1 overflow-auto p-4 md:p-8 lg:p-10">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
