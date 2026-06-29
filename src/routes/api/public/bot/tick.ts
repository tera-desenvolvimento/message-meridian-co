import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/bot/tick")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const { tickTimeouts } = await import("@/lib/bot-runner");
          const result = await tickTimeouts();
          return Response.json({ ok: true, ...result });
        } catch (e) {
          console.error("bot tick error", e);
          return Response.json(
            { ok: false, error: e instanceof Error ? e.message : "unknown" },
            { status: 500 },
          );
        }
      },
      GET: async () => Response.json({ ok: true, hint: "POST to run tick" }),
    },
  },
});
