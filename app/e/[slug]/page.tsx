import type { Metadata } from "next";
import { PublicEstablishmentRoute as PublicEstablishmentView } from "@/features/public-establishment/public-establishment-route";
import { findPublicEstablishment } from "@/features/public-establishment/data";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params; const establishment = findPublicEstablishment(slug); if (!establishment) return { title: "Estabelecimento | Agendito" }; return { title: `${establishment.name} | Agendito`, description: establishment.description, openGraph: { title: `${establishment.name} | Agendito`, description: establishment.description, images: establishment.coverUrl ? [establishment.coverUrl] : undefined } };
}

export default async function PublicEstablishmentRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; return <PublicEstablishmentView slug={slug} />;
}
