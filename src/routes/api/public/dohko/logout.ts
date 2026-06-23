import { createFileRoute } from "@tanstack/react-router";
import { clearSessionCookieHeader } from "@/lib/dohko-auth.server";

export const Route = createFileRoute("/api/public/dohko/logout")({
  server: {
    handlers: {
      POST: async () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: {
            "content-type": "application/json",
            "set-cookie": clearSessionCookieHeader(),
          },
        }),
    },
  },
});
