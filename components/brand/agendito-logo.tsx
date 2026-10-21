import Image from "next/image";
import { cn } from "@/lib/utils";

export type AgenditoLogoSize = "small" | "medium" | "large";

export function AgenditoLogo({
  size = "medium",
  className,
  priority = false,
}: {
  size?: AgenditoLogoSize;
  className?: string;
  priority?: boolean;
}) {
  return (
    <span className={cn("agendito-logo-frame", `agendito-logo-${size}`, className)}>
      <Image
        src="/brand/agendito-neon-transparent.png"
        alt="Agendito"
        width={1536}
        height={1024}
        priority={priority}
        sizes={size === "large" ? "240px" : size === "medium" ? "(max-width: 480px) 260px, 340px" : "112px"}
        className="agendito-logo-image"
      />
    </span>
  );
}
