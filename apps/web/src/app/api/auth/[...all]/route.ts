import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth/server";

// Routes HTTP de Better Auth (connexion, inscription, session). Les routes de gestion
// d'agence sont fermées : voir DISABLED_ORGANIZATION_PATHS dans src/lib/auth/options.ts.
export const { GET, POST } = toNextJsHandler((request: Request) => getAuth().handler(request));
