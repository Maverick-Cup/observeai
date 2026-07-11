import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { CheckCircle2, Loader2 } from "lucide-react";
import { LoginTagline } from "../components/login/LoginTagline";
import { useAuth } from "../hooks/useAuth";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { demoLogin, user, loading } = useAuth();

  // Already logged in? Redirect away
  useEffect(() => {
    if (user) {
      const from = (location.state as { from?: { pathname: string } })?.from?.pathname || "/";
      navigate(from, { replace: true });
    }
  }, [user, navigate, location.state]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <LoginTagline />

        {/* Auth Card */}
        <div className="bg-card border border-border rounded-2xl shadow-xl p-6">
          <h2 className="font-heading text-lg font-semibold text-foreground mb-1 text-center">
            Welcome
          </h2>
          <p className="text-sm text-muted-foreground mb-6 text-center">
            Sign in to explore your AI observability dashboard
          </p>

          <button
            onClick={demoLogin}
            type="button"
            className="w-full bg-emerald-500/10 text-emerald-500 font-medium rounded-lg py-3 text-sm transition-all duration-150 ease-out cursor-pointer hover:bg-emerald-500/20 active:scale-[0.97] border border-emerald-500/20 flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            Demo Mode (skip email)
          </button>

          <div className="mt-6 pt-5 border-t border-border">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-medium text-foreground">Email-based auth is paused.</span>{" "}
              The Resend free tier only delivers to verified addresses, which makes sign-up
              unreliable without a custom domain. Full email auth will return once a production
              domain is configured.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}