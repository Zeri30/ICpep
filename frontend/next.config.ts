import type { NextConfig } from "next";

/* Origin of the Laravel app that actually renders the admin. */
const BACKEND = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const nextConfig: NextConfig = {
  /* Serve the Laravel/Filament admin under this origin, so /admin stays on the
     site's own URL instead of sending officers to the backend's.

     Filament resolves its assets and Livewire endpoint from the root rather
     than from /admin, so those prefixes have to be forwarded as well or the
     panel loads unstyled and its actions fail. Laravel is told to generate
     URLs on this origin via URL::forceRootUrl (see AppServiceProvider).

     Returning an array applies these after Next's own files, so anything in
     public/ still wins. */
  async rewrites() {
    return [
      // Auth (sign-in modal + admin sign-out) and the JSON admin API are proxied
      // same-origin so the officer session cookie and CSRF token flow as the
      // login already relies on.
      { source: "/auth/:path*", destination: `${BACKEND}/auth/:path*` },
      { source: "/api/admin/:path*", destination: `${BACKEND}/api/admin/:path*` },
      // NOTE: /admin is now served by this Next app (the React admin). The old
      // /admin proxy to Filament was removed — an afterFiles rewrite for
      // /admin/:path* runs before dynamic routes and would shadow pages like
      // /admin/members/[id]. Filament stays reachable directly at the backend
      // origin (localhost:8000/admin) until it's removed.
    ];
  },
};

export default nextConfig;
