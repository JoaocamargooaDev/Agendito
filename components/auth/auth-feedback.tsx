import { AlertCircle, CheckCircle2, Info } from "lucide-react";

export function AuthFeedback({ tone, children }: { tone: "error" | "success" | "info"; children: React.ReactNode }) {
  const Icon = tone === "error" ? AlertCircle : tone === "success" ? CheckCircle2 : Info;
  return <div className={`auth-feedback feedback-${tone}`} role={tone === "error" ? "alert" : "status"}><Icon size={16} aria-hidden /><span>{children}</span></div>;
}

export function AuthLoadingState({ label = "Restaurando sessão…" }: { label?: string }) { return <div className="auth-loading" role="status"><span className="loading-orb" />{label}</div>; }
