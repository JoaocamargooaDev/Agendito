import type { PageDesignConfig } from "@/types";

type PublicThemeTokens = {
  "--public-page-custom-background": string;
  "--public-page-accent": string;
  "--public-page-accent-ink": string;
  "--public-page-accent-button-ink": string;
  "--public-page-secondary": string;
  "--public-page-button": string;
  "--public-page-ink": string;
  "--public-page-muted": string;
  "--public-page-surface": string;
  "--public-page-surface-raised": string;
  "--public-page-border": string;
  "--public-page-button-ink": string;
  "--public-page-radius": string;
  "--public-page-background-image"?: string;
};

const paletteAccents = { moss: "#91b895", copper: "#e2a078", sand: "#e0bf83", ink: "#bac8be", sage: "#b7c9aa" } as const;
const defaultBackground = "#f4f2ec";

function normalizedHex(value: string | undefined, fallback: string) {
  const color = value?.trim() ?? "";
  if (/^#[\da-f]{6}$/i.test(color)) return color;
  if (/^#[\da-f]{3}$/i.test(color)) return `#${[...color.slice(1)].map((part) => part + part).join("")}`;
  return fallback;
}

function luminance(color: string) {
  const channels = color.slice(1).match(/.{2}/g)?.map((channel) => parseInt(channel, 16) / 255) ?? [1, 1, 1];
  const linear = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function darken(color: string, amount: number) {
  const channels = color.slice(1).match(/.{2}/g) ?? ["00", "00", "00"];
  return `#${channels.map((channel) => Math.round(parseInt(channel, 16) * amount).toString(16).padStart(2, "0")).join("")}`;
}

export function getPublicThemeTokens(config?: PageDesignConfig | null): PublicThemeTokens {
  const background = normalizedHex(config?.backgroundColor, defaultBackground);
  const accent = normalizedHex(config?.primaryColor, paletteAccents[config?.palette ?? "moss"]);
  const secondary = normalizedHex(config?.secondaryColor, accent);
  const button = normalizedHex(config?.buttonColor, accent);
  const dark = luminance(background) < 0.34;
  const accentInk = dark
    ? luminance(accent) < 0.22 ? "#c8d4cb" : accent
    : luminance(accent) > 0.34 ? darken(accent, 0.55) : accent;

  const backgroundImage = safePublicImageReference(config?.backgroundImageUrl);
  return {
    "--public-page-custom-background": background,
    "--public-page-accent": accent,
    "--public-page-accent-ink": accentInk,
    "--public-page-accent-button-ink": luminance(accent) < 0.4 ? "#ffffff" : "#17231b",
    "--public-page-secondary": secondary,
    "--public-page-button": button,
    "--public-page-ink": dark ? "#f7f6f0" : "#202923",
    "--public-page-muted": dark ? "#c3cec6" : "#56625a",
    "--public-page-surface": dark ? "#18231f" : "#fffefa",
    "--public-page-surface-raised": dark ? "#22312b" : "#f0eee7",
    "--public-page-border": dark ? "rgba(247,246,240,.16)" : "rgba(32,41,35,.13)",
    "--public-page-button-ink": luminance(button) < 0.4 ? "#ffffff" : "#17231b",
    "--public-page-radius": `${config?.cornerRadius ?? 20}px`,
    ...(backgroundImage ? { "--public-page-background-image": `linear-gradient(${dark ? "rgba(0,0,0,.44)" : "rgba(255,255,255,.68)"},${dark ? "rgba(0,0,0,.44)" : "rgba(255,255,255,.68)"}),url(${JSON.stringify(backgroundImage)})` } : {}),
  };
}

export function safePublicImageReference(value?: string) {
  const reference = value?.trim() ?? "";
  if (!reference || /[\u0000-\u001f"'\\]/.test(reference)) return undefined;
  if (/^data:image\/(?:png|jpe?g|webp|gif|avif);base64,[a-z0-9+/=]+$/i.test(reference)) return reference;
  if (reference.startsWith("/") && !reference.startsWith("//")) return reference;
  try { return new URL(reference).protocol === "https:" ? reference : undefined; } catch { return undefined; }
}

export function isPublicThemeDark(config?: PageDesignConfig | null) {
  return luminance(normalizedHex(config?.backgroundColor, defaultBackground)) < 0.34;
}
