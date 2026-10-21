import { CustomerAppointmentDetails } from "@/features/customer/customer-pages";
import { CustomerShell } from "@/features/customer/customer-shell";
export default async function CustomerAppointmentPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <CustomerShell><CustomerAppointmentDetails id={id} /></CustomerShell>; }
