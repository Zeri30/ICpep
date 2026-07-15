/* Base URL of the Laravel backend. Set NEXT_PUBLIC_API_URL in .env.local
   (e.g. http://localhost:8000). NEXT_PUBLIC_* values are inlined at build
   time, so this must be set in the hosting environment before `next build`. */
export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
