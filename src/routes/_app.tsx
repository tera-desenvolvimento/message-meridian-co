/**
 * Pathless layout route shared by all authenticated app pages (Inbox, Team,
 * Settings). Keeping AuthGuard + AppHeader mounted across navigations means
 * we don't re-run the auth check, re-render the workspace badge, or flash
 * "Carregando..." every time the user clicks between tabs.
 */
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { AppHeader } from "@/components/layout/AppHeader";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  return (
    <AuthGuard>
      <div className="flex h-dvh flex-col bg-background text-foreground">
        <AppHeader />
        <div className="flex min-h-0 flex-1 flex-col">
          <Outlet />
        </div>
      </div>
    </AuthGuard>
  );
}
