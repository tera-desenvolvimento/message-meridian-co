import { createFileRoute } from "@tanstack/react-router";
import {
  checkDohkoCredentials,
  sessionCookieHeader,
  signDohkoToken,
} from "@/lib/dohko-auth.server";

export const Route = createFileRoute("/api/public/dohko/login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { code?: string; password?: string } = {};
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "JSON inválido" }, { status: 400 });
        }
        const code = (body.code ?? "").trim();
        const password = body.password ?? "";
        if (!code || !password) {
          return Response.json({ error: "Informe código e senha" }, { status: 400 });
        }
        if (!checkDohkoCredentials(code, password)) {
          return Response.json({ error: "Credenciais inválidas" }, { status: 401 });
        }
        const token = await signDohkoToken();
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: {
            "content-type": "application/json",
            "set-cookie": sessionCookieHeader(token),
          },
        });
      },
    },
  },
});
