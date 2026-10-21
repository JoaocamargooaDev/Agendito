import Image from "next/image";
import { cn } from "@/lib/utils";

export type AgenditoLogoSize = "small" | "medium" | "large";

export function AgenditoLogo({
  size = "medium",
  className,
  priority = false,
  sizes: sizesOverride,
}: {
  size?: AgenditoLogoSize;
  className?: string;
  priority?: boolean;
  sizes?: string;
}) {
  return (
    <span className={cn("agendito-logo-frame", `agendito-logo-${size}`, className)}>
      <Image
        src="/brand/agendito-neon-transparent.png"
        alt="Agendito"
        width={1536}
        height={1024}
        priority={priority}
        sizes={sizesOverride ?? (size === "large" ? "(max-width: 760px) 144px, (max-width: 1200px) 30vw, 440px" : size === "medium" ? "(max-width: 480px) 260px, 340px" : "112px")}
        quality={size === "large" ? 95 : undefined}
        unoptimized={size === "large" || Boolean(sizesOverride)}
        className="agendito-logo-image"
      />
    </span>
  );
}
