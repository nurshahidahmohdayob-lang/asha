import React from 'react';

interface ZeraBrandLogoProps {
  className?: string;
  iconOnly?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'dark' | 'light' | 'original'; // dark (for green/dark backgrounds - white text), light/original (for white/gray backgrounds - emerald text)
}

export const ZeraBrandLogo: React.FC<ZeraBrandLogoProps> = ({
  className = '',
  iconOnly = false,
  size = 'md',
  variant = 'original'
}) => {
  // Main brand colors from the Zera Brand Kit:
  // - Primary Emerald Green: #0A4F29
  // - Secondary Sage Green: #668C4A
  const isDark = variant === 'dark';
  const mainColor = isDark ? '#FFFFFF' : '#0A4F29';
  const subColor = isDark ? 'rgba(255, 255, 255, 0.6)' : '#668C4A';
  const dividerColor = isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(10, 79, 41, 0.2)';

  // Sizing mapping for typography
  const specs = {
    sm: {
      zeraClass: 'text-2xl font-black tracking-tighter',
      lineHeight: 'h-6',
      stackedClass: 'text-[9px]',
      gapClass: 'gap-2'
    },
    md: {
      zeraClass: 'text-3xl font-black tracking-tighter',
      lineHeight: 'h-7',
      stackedClass: 'text-[10px]',
      gapClass: 'gap-2.5'
    },
    lg: {
      zeraClass: 'text-[44px] font-black tracking-tightest',
      lineHeight: 'h-10',
      stackedClass: 'text-[13px]',
      gapClass: 'gap-3.5'
    },
    xl: {
      zeraClass: 'text-[64px] font-black tracking-tightest',
      lineHeight: 'h-14',
      stackedClass: 'text-[16px]',
      gapClass: 'gap-4'
    }
  }[size];

  if (iconOnly) {
    // If only an icon/monogram is requested but we removed the shield,
    // we represent the brand in its minimal typographic "z" form or a clean monogram
    return (
      <div 
        className={`inline-flex items-center justify-center font-black rounded-xl select-none select-none pointer-events-none ${className}`}
        style={{ 
          color: mainColor,
          fontFamily: 'system-ui, sans-serif'
        }}
      >
        <span className={specs.zeraClass.replace('text-', 'text-[1.25em] text-')}>z</span>
      </div>
    );
  }

  return (
    <div 
      className={`flex items-center select-none pointer-events-none transition-all duration-300 ${specs.gapClass} ${className}`}
      style={{ fontFamily: 'system-ui, sans-serif' }}
    >
      {/* 
        PRECISE BRAND TYPOGRAPHY:
        Conforms strictly to the official "Zera International School" Brand Kit guidelines.
        - Primary Lowercase "zera"
        - Subtle clean separator
        - Stacked secondary descriptor
      */}
      <span 
        className={`${specs.zeraClass} lowercase leading-none font-sans`} 
        style={{ color: mainColor }}
      >
        zera
      </span>
      
      {/* Vertical divider */}
      <div 
        className={`w-[1.5px] ${specs.lineHeight} transition-colors duration-300`} 
        style={{ backgroundColor: dividerColor }}
      />
      
      {/* Stacked Subtitle */}
      <div className="flex flex-col text-left justify-center leading-none">
        <span 
          className={`${specs.stackedClass} font-extrabold uppercase tracking-[0.15em]`} 
          style={{ color: mainColor }}
        >
          International
        </span>
        <span 
          className={`${specs.stackedClass} font-medium uppercase tracking-[0.12em] mt-0.5`} 
          style={{ color: subColor }}
        >
          School
        </span>
      </div>
    </div>
  );
};
