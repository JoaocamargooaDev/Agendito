/**
 * Shared procedural displacement map for selective Liquid Glass refraction.
 * CSS backdrop-filter:url() is not implemented consistently, so materials
 * retain a full blur/opacity/highlight fallback when SVG refraction is absent.
 */
export function GlassFilterDefinitions() {
  return (
    <svg
      aria-hidden="true"
      className="glass-filter-definitions"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
       <filter id="agendito-liquid-glass-refraction" x="-12%" y="-12%" width="124%" height="124%" colorInterpolationFilters="sRGB">
        <feTurbulence
          type="fractalNoise" baseFrequency="0.012 0.022" numOctaves="1" seed="9" result="glass-noise"
        />
        <feGaussianBlur in="glass-noise" stdDeviation="1.25" result="glass-map" />
        <feDisplacementMap
          in="SourceGraphic" in2="glass-map" scale="-2.4" xChannelSelector="R" yChannelSelector="G" result="disp-red"
        />
        <feColorMatrix in="disp-red" type="matrix" values="1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" result="red" />
        <feDisplacementMap in="SourceGraphic" in2="glass-map" scale="-2.9" xChannelSelector="R" yChannelSelector="G" result="disp-green" />
        <feColorMatrix in="disp-green" type="matrix" values="0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0" result="green" />
        <feDisplacementMap in="SourceGraphic" in2="glass-map" scale="-3.4" xChannelSelector="R" yChannelSelector="G" result="disp-blue" />
        <feColorMatrix in="disp-blue" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0" result="blue" />
        <feBlend in="red" in2="green" mode="screen" result="red-green" />
        <feBlend in="red-green" in2="blue" mode="screen" result="chromatic-glass" />
        <feGaussianBlur in="chromatic-glass" stdDeviation="0.18" />
       </filter>
      </defs>
    </svg>
  );
}
