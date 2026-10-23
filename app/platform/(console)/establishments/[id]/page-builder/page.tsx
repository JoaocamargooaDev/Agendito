import { PublicPageBuilderPage } from "@/features/platform/public-page-builder-page";

export default async function PublicPageBuilderRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PublicPageBuilderPage establishmentId={id} />;
}
