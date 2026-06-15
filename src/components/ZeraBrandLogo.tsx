import React from 'react';
import { ZERA_LOGO_B64 } from '../constants/zeraLogo';

interface ZeraBrandLogoProps {
  className?: string;
  /** Kept for backwards compatibility — the official lockup is always shown. */
  iconOnly?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** dark: for green/dark backgrounds (logo renders white); light/original: black lockup */
  variant?: 'dark' | 'light' | 'original';
}

const HEIGHTS: Record<NonNullable<ZeraBrandLogoProps['size']>, string> = {
  sm: 'h-6',
  md: 'h-8',
  lg: 'h-12',
  xl: 'h-16',
};

/** Official Zera Education horizontal lockup (embedded from the brand kit).
 *  The artwork is pure black, so the dark variant simply inverts it to white. */
export const ZeraBrandLogo: React.FC<ZeraBrandLogoProps> = ({
  className = '',
  size = 'md',
  variant = 'original',
}) => (
  <img
    src={ZERA_LOGO_B64}
    alt="Zera Education"
    draggable={false}
    className={`${HEIGHTS[size] || HEIGHTS.md} w-auto select-none ${className}`}
    style={variant === 'dark' ? { filter: 'invert(1)' } : undefined}
  />
);
