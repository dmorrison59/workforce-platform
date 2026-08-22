"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavigationItem = {
  label: string;
  href: string;
  group: string;
};

export function DashboardNavigation({ items }: { items: NavigationItem[] }) {
  const pathname = usePathname();
  const groups = Array.from(new Set(items.map((item) => item.group)));

  return (
    <nav className="nav" aria-label="Main navigation">
      {groups.map((group) => (
        <div className="nav-group" key={group}>
          <span className="nav-group-label">{group}</span>
          {items.filter((item) => item.group === group).map((item) => {
            const active = pathname === item.href
              || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
            return (
              <Link aria-current={active ? "page" : undefined} key={item.href} href={item.href}>
                <span className="nav-indicator" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
