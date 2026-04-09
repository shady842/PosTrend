import Link from "next/link";

const linkAuth =
  "text-indigo-600 underline decoration-indigo-600/30 underline-offset-2 hover:text-indigo-500";
const linkMarketing = "font-medium text-slate-600 hover:text-indigo-600";

type Props = {
  className?: string;
  /** `marketing` = header on public pages; `auth` = under login forms */
  tone?: "marketing" | "auth";
};

/** Same-origin entry points (dev: http://localhost:3001/...). */
export function PortalLinks({ className = "", tone = "auth" }: Props) {
  const a = tone === "marketing" ? linkMarketing : linkAuth;
  return (
    <nav className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm ${className}`} aria-label="App entry points">
      <Link href="/" className={a}>
        Site
      </Link>
      <span className="text-slate-300 dark:text-slate-600" aria-hidden>
        |
      </span>
      <Link href="/login" className={a}>
        Tenant admin
      </Link>
      <span className="text-slate-300 dark:text-slate-600" aria-hidden>
        |
      </span>
      <Link href="/super-admin/login" className={a}>
        Super admin
      </Link>
    </nav>
  );
}
