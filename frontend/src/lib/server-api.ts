import "server-only";

import { API_URL } from "@/lib/api";

// Docker DNS is available only to Next.js on the server, never to the browser.
// Host-based development continues to use the public API URL by default.
export const SERVER_API_URL = process.env.INTERNAL_API_URL || API_URL;
