"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavGroup {
  label: string;
  items: { label: string; href: string }[];
}

const NAV: NavGroup[] = [
  { label: "", items: [{ label: "Home", href: "/home" }] },
  {
    label: "Prospects",
    items: [
      { label: "Target list", href: "/prospects/target-list" },
      { label: "Triage", href: "/prospects/triage" },
      { label: "Contacts", href: "/prospects/contacts" },
    ],
  },
  {
    label: "Oversight",
    items: [
      { label: "Usage & audit", href: "/oversight/usage" },
      { label: "Analytics", href: "/oversight/analytics" },
    ],
  },
  { label: "", items: [{ label: "Accounts", href: "/accounts" }] },
  {
    label: "Admin",
    items: [{ label: "Model config", href: "/admin/config" }],
  },
];

export function NavSidebar() {
  const pathname = usePathname();

  return (
    <nav className="w-56 shrink-0 border-r border-neutral-200 p-4 dark:border-neutral-800">
      {NAV.map((group, i) => {
        const items = group.items;
        if (items.length === 0) return null;

        return (
          <div key={i} className="mb-6">
            {group.label && (
              <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
                {group.label}
              </p>
            )}
            <ul className="space-y-1">
              {items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`block rounded-md px-2 py-1.5 text-sm transition ${
                        active
                          ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                          : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
