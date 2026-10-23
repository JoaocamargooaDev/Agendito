import { notFound } from "next/navigation";
import { DashboardPreview } from "@/features/dashboard/dashboard-preview";
import { AuthGuard } from "@/components/auth";
import { CAPABILITIES } from "@/features/auth/capabilities";

export default function DashboardPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <AuthGuard requiredCapability={CAPABILITIES.establishmentDashboard} loginPath="/login"><DashboardPreview /></AuthGuard>;
}
