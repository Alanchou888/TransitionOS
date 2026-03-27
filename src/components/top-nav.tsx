"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = {
  href: string;
  label: string;
};

export function TopNav({ items }: { items: Item[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap items-center gap-2">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={[
              "inline-flex items-center rounded-xl border px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "border-blue-200 bg-blue-50 text-blue-800"
                : "border-transparent bg-transparent text-slate-600 hover:border-slate-200 hover:bg-white hover:text-slate-900"
            ].join(" ")}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
