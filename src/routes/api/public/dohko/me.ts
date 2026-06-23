import { createFileRoute } from "@tanstack/react-router";
import { requireDohkoAdmin } from "@/lib/dohko-auth.server";

export const Route = createFileRoute("/api/public/dohko/me")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const claims = await requireDohkoAdmin(request);
        if (claims instanceof Response) return claims;
        return Response.json({ ok: true, role: claims.role, exp: claims.exp });
      },
    },
  },
});
