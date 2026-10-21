import { CustomerReschedule } from "@/features/customer/customer-pages";
import { CustomerShell } from "@/features/customer/customer-shell";
export default async function CustomerReschedulePage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <CustomerShell><CustomerReschedule id={id} /></CustomerShell>; }
