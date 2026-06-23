import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { TrialBanner, TrialGate } from "@/components/trial/TrialBanner";

/**
 * Guards client routes. Redirects to /login if no token, or to /onboarding
 * if the user has no workspace (unless requireWorkspace=false).
 */
export function AuthGuard({
  children,
  requireWorkspace = true,
}: {
  children: React.ReactNode;
  requireWorkspace?: boolean;
}) {
  const { isAuthenticated, loading, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      navigate({ to: "/login" });
      return;
    }
    if (requireWorkspace && user && !user.workspaceId) {
      navigate({ to: "/onboarding" });
    }
  }, [loading, isAuthenticated, user, requireWorkspace, navigate]);

  if (loading) {
    return (
      <div className="flex h-dvh w-full items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Carregando...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;
  if (requireWorkspace && user && !user.workspaceId) return null;

  return <>{children}</>;
}
