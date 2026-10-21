import { CustomersPage } from "@/features/customers/customers-page";

export default async function CustomerProfileRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CustomersPage detailId={id} />;
}
