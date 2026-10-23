import { OwnerPublicPagePreview } from "@/features/platform/owner-public-page-preview";

export default async function OwnerPublicPagePreviewRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OwnerPublicPagePreview establishmentId={id} />;
}
