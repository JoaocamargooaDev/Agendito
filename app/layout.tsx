import type { Metadata } from "next";
import "@/styles/globals.css";
import "@/styles/base.css";
import "@/styles/agendito.css";
import "@/styles/layout-audit.css";
import { AuthProvider } from "@/features/auth";
import { GlassFilterDefinitions } from "@/components/ui/glass-filter-definitions";

export const metadata: Metadata = {
  title: "Agendito — agendamentos para estabelecimentos e clientes",
  description: "Agendito: gestão de agenda e experiência de agendamento para estabelecimentos e clientes.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" data-scroll-behavior="smooth">
      <body>
        <GlassFilterDefinitions />
        <div className="agendito-background-art" aria-hidden="true">
          <span className="background-art-clock" />
          <span className="background-art-calendar" />
          <span className="background-art-stopwatch" />
          <span className="background-art-bell" />
          <span className="background-art-planner" />
          <span className="background-art-calendar-clock" />
        </div>
        <AuthProvider><div className="agendito-app-layer">{children}</div></AuthProvider>
      </body>
    </html>
  );
}
