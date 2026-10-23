import { AuthGuard } from "@/components/auth";
import { PlatformConsoleNavigation } from "@/components/admin/platform-console-navigation";
import { CAPABILITIES } from "@/features/auth/capabilities";

export default function PlatformConsoleLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard requiredCapability={CAPABILITIES.platformConsole} loginPath="/login"><div className="platform-console-layout"><PlatformConsoleNavigation />{children}</div></AuthGuard>;
}
