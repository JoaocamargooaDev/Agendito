import type { Metadata } from "next";
import { PublicBookingStart } from "@/features/booking/public-booking-start";

export const metadata: Metadata = { title: "Agendar · Agendito" };

export default function BookingStartRoute() {
  return <PublicBookingStart />;
}
