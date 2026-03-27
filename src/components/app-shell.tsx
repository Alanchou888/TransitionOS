import Link from "next/link";
import type { ReactNode } from "react";
import { getPrincipalFromCookies, roleLabel } from "@/lib/auth";
import { canCreateTask, canManageSources } from "@/lib/permissions";
import { TopNav } from "@/components/top-nav";

export async function AppShell({ children }: { children: ReactNode }) {
  const principal = await getPrincipalFromCookies();
  const menu = [
    { href: "/dashboard", label: "Dashboard", visible: true },
    { href: "/guide", label: "Guide", visible: true },
    { href: "/tasks/new", label: "Create Task", visible: principal ? canCreateTask(principal.role) : false },
    {
      href: "/admin/settings",
      label: "Admin Settings",
      visible: principal ? canManageSources(principal.role) : false
    },
    { href: "/login", label: "Switch User", visible: true }
  ];
  const visibleMenu = menu.filter((item) => item.visible).map((item) => ({ href: item.href, label: item.label }));

  return (
    <div className="page-shell">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="inline-flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 text-sm font-bold text-white">
                T
              </span>
              <span className="text-lg font-semibold tracking-tight text-slate-900">TransitionOS</span>
            </Link>
            <span className="hidden text-xs text-slate-400 md:inline">Knowledge Transition Platform</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/guide" className="btn-secondary px-3 py-1.5 text-xs md:text-sm">
              Quick Guide
            </Link>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600 md:text-sm">
              {principal ? (
                <>
                  <span className="font-medium text-slate-800">{principal.email}</span>{" "}
                  <span className="text-slate-400">|</span>{" "}
                  <span className="chip">{roleLabel(principal.role)}</span>
                </>
              ) : (
                "No user selected"
              )}
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-4 pb-3 md:px-6">
          <TopNav items={visibleMenu} />
        </div>
      </header>
      <main className="page-container">{children}</main>
    </div>
  );
}
