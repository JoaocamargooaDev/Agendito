import type { PageDesignConfig } from "@/types";

/** Copies visual settings between establishments without replacing their own business text or records. */
export function copyPublicPageAppearance(content: PageDesignConfig, source: PageDesignConfig): PageDesignConfig {
  const destinationSections = new Map((content.sections ?? []).map((section) => [section.id, section]));
  return {
    ...content,
    template: "editorial",
    palette: source.palette,
    primaryColor: source.primaryColor,
    secondaryColor: source.secondaryColor,
    backgroundColor: source.backgroundColor,
    backgroundImageUrl: source.backgroundImageUrl,
    buttonColor: source.buttonColor,
    typography: source.typography,
    cardStyle: source.cardStyle,
    cornerRadius: source.cornerRadius,
    buttonCornerRadius: source.buttonCornerRadius,
    sectionSpacing: source.sectionSpacing,
    sections: source.sections?.map((section) => ({
      ...section,
      title: destinationSections.get(section.id)?.title ?? section.title,
      description: destinationSections.get(section.id)?.description ?? section.description,
    })) ?? content.sections,
  };
}
