import type { Metadata } from "next";
import { PublicEstablishmentRoute as PublicEstablishmentView } from "@/features/public-establishment/public-establishment-route";
import { findPublicEstablishment } from "@/features/public-establishment/data";
import { getPageConfig } from "@/features/platform/storage";
import { getPublishedPageContent } from "@/features/platform/public-page-builder";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params; const establishment = findPublicEstablishment(slug); if (!establishment) return { title: "Estabelecimento | Agendito" }; const page = getPublishedPageContent(getPageConfig(establishment.id)); const title = page?.publicName || page?.heroTitle || establishment.name; const description = page?.heroSubtitle || establishment.description; return { title: `${title} | Agendito`, description, openGraph: { title: `${title} | Agendito`, description, images: page?.coverUrl ?? establishment.coverUrl ? [page?.coverUrl ?? establishment.coverUrl!] : undefined } };
}

export default async function PublicEstablishmentRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; return <PublicEstablishmentView slug={slug} />;
}
