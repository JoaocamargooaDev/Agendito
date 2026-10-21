import { AuthGuard } from "@/components/auth";

export default function PlatformConsoleLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard allowedRole="PLATFORM_ADMIN" loginPath="/login">{children}</AuthGuard>;
}
