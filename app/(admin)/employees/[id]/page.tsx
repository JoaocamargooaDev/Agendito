import { EmployeesPage } from "@/features/employees/employees-page";

export default async function EmployeeProfileRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EmployeesPage detailId={id} />;
}
