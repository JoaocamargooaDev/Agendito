import type { Metadata } from "next";
import { findPublicEstablishment } from "@/features/public-establishment/data";
import { PublicBookingRoute } from "@/features/booking/public-booking-route";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> { const { slug } = await params; const establishment = findPublicEstablishment(slug); return { title: establishment ? `Agendar · ${establishment.name}` : "Agendamento" }; }
export default async function BookingRoute({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ service?: string; employee?: string }> }) { const { slug } = await params; const query = await searchParams; return <PublicBookingRoute slug={slug} serviceParam={query.service} employeeParam={query.employee} />; }
