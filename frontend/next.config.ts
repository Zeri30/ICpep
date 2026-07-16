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
      { source: "/admin", destination: `${BACKEND}/admin` },
      { source: "/admin/:path*", destination: `${BACKEND}/admin/:path*` },
      { source: "/auth/:path*", destination: `${BACKEND}/auth/:path*` },
      // JSON admin API for the React admin — same-origin so the officer session
      // cookie and CSRF token flow exactly as the /auth login already relies on.
      { source: "/api/admin/:path*", destination: `${BACKEND}/api/admin/:path*` },
      { source: "/livewire/:path*", destination: `${BACKEND}/livewire/:path*` },
      { source: "/js/filament/:path*", destination: `${BACKEND}/js/filament/:path*` },
      { source: "/css/filament/:path*", destination: `${BACKEND}/css/filament/:path*` },
      { source: "/images/:path*", destination: `${BACKEND}/images/:path*` },
      { source: "/storage/:path*", destination: `${BACKEND}/storage/:path*` },
    ];
  },
};

export default nextConfig;
