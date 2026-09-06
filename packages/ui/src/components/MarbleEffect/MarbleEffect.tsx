import { useId } from 'react';

import { generateColors } from './utils/generateColors';

import type { SVGProps } from 'react';

// prettier-ignore
const DEFAULT_COLORS: string[] = ['#FFAD08','#EDD75A','#74B06F','#EF8B62','#EC5B29','#85A58D','#E6E0D0','#FFB6C1','#FFD700','#FF0000','#20B2AA','#87CEEB','#6A5ACD','#4169E1','#0000FF'];

export interface MarbleEffectProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  /** Accessible name for the `role="img"` SVG. Always pass when used standalone; Avatar wires it automatically. */
  'aria-label'?: string;
  /** Palette to sample from. Same `name` + `colors` → same marble. Override to brand-match. */
  colors?: string[];
  /** Visible shape layers. Defaults to 3. */
  elements?: number;
  /** **Required.** Deterministic seed (e.g. user id / email). Same seed → same marble. */
  name: string;
  /** Square pixel size. Defaults to 80. */
  size?: number;
  /** SVG `<title>` — shown on hover. Prefer `aria-label` for accessibility; use `title` only if you want the hover tooltip too. */
  title?: string;
}

export function MarbleEffect({ 'aria-label': ariaLabel, colors = DEFAULT_COLORS, elements = 3, name, size = 80, title }: MarbleEffectProps) {
  const id = useId();

  const properties = generateColors(name, colors, elements, size);

  return (
    <svg aria-label={ariaLabel} fill="none" height={size} role="img" viewBox={`0 0 ${size} ${size}`} width={size} xmlns="http://www.w3.org/2000/svg">
      {title ? <title>{title}</title> : null}
      <mask height={size} id={id} maskUnits="userSpaceOnUse" width={size} x={0} y={0}>
        <rect fill="#FFFFFF" height={size} rx={size * 2} width={size} />
      </mask>
      <g mask={`url(#${id})`}>
        <rect fill={properties[0].color} height={size} width={size} />
        <path
          d="M32.414 59.35L50.376 70.5H72.5v-71H33.728L26.5 13.381l19.057 27.08L32.414 59.35z"
          fill={properties[1].color}
          filter={`url(#filter_${id})`}
          transform={`translate(${properties[1].translateX} ${properties[1].translateY}) rotate(${properties[1].rotate} ${size / 2} ${size / 2}) scale(${properties[2].scale})`}
          width={size}
        />
        <path
          d="M22.216 24L0 46.75l14.108 38.129L78 86l-3.081-59.276-22.378 4.005 12.972 20.186-23.35 27.395L22.215 24z"
          fill={properties[2].color}
          filter={`url(#filter_${id})`}
          style={{ mixBlendMode: 'overlay' }}
          transform={`translate(${properties[2].translateX} ${properties[2].translateY}) rotate(${properties[2].rotate} ${size / 2} ${size / 2}) scale(${properties[2].scale})`}
        />
      </g>
      <defs>
        <filter colorInterpolationFilters="sRGB" filterUnits="userSpaceOnUse" id={`filter_${id}`}>
          <feFlood floodOpacity={0} result="BackgroundImageFix" />
          <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur result="effect1_foregroundBlur" stdDeviation={7} />
        </filter>
      </defs>
    </svg>
  );
}
