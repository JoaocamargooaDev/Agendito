/**
 * Compatibility export for stale development bundles that may still request
 * the former component. New screens should render their headings directly.
 */
export function TypewriterHeading({ id, text }: { id: string; text: string }) {
  return <h1 id={id}>{text}</h1>;
}
