import { NextRequest, NextResponse } from "next/server";

const publicPaths = ["/", "/pricing", "/features", "/demo", "/blog", "/compare", "/pos-for-", "/restaurant-", "/login", "/signup", "/super-admin/login"];
const authPages = ["/login", "/signup", "/super-admin/login"];

function tokenRole(token?: string): string {
  if (!token) return "";
  try {
    const part = token.split(".")[1];
    if (!part) return "";
    const json = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
    return String(json.role || "");
  } catch {
    return "";
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic = publicPaths.some((p) => (p === "/" ? pathname === "/" : pathname.startsWith(p)));
  const isAuthPage = authPages.some((p) => pathname.startsWith(p));
  const isSuperLogin = pathname.startsWith("/super-admin/login");
  const token = req.cookies.get("pt_access_token")?.value;
  const role = tokenRole(token);
  const isSuperPath = pathname.startsWith("/super-admin");

  if (!token && !isPublic) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  // Keep super-admin login reachable even when an admin session exists.
  if (token && isAuthPage && !isSuperLogin) {
    return NextResponse.redirect(new URL(role === "super_admin" ? "/super-admin/dashboard" : "/dashboard", req.url));
  }
  if (token && isSuperPath && !isSuperLogin && role !== "super_admin") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
  if (token && !isSuperPath && role === "super_admin") {
    return NextResponse.redirect(new URL("/super-admin/dashboard", req.url));
  }
  return NextResponse.next();
}

/**
 * Match all routes except Next internals and favicon. Using `/_next/` covers static, image,
 * webpack-hmr, flight/data fetches, etc. — if any of those hit auth, the app spins or stays blank.
 */
export const config = {
  matcher: ["/((?!api|_next/|favicon.ico).*)"]
};
