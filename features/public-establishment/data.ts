import { listAllEstablishments } from "@/features/platform";
import type { Establishment } from "@/types";

export function findPublicEstablishment(slug: string): Establishment | null { return listAllEstablishments().find((item) => item.slug === slug && item.active !== false) ?? null; }
