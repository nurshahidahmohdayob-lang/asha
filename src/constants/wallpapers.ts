export interface Wallpaper {
  url: string;
  thumbnail: string;
  category: 'Zera' | 'Abstract' | 'Pastel';
}

export const PRESET_WALLPAPERS: Wallpaper[] = [
  // --- ZERA BRAND DESIGN SYSTEM (Beautiful, lightweight self-contained SVGs) ---
  { 
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675"><defs><linearGradient id="bg-light" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%23F4FDF7"/><stop offset="100%" stop-color="%23FFFFFF"/></linearGradient><linearGradient id="accent-light" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%230A4F29" stop-opacity="0.05"/><stop offset="100%" stop-color="%23668C4A" stop-opacity="0.02"/></linearGradient></defs><rect width="1200" height="675" fill="url(%23bg-light)"/><path d="M350,675 Q650,420 1200,520 L1200,675 Z" fill="url(%23accent-light)"/><path d="M550,675 Q850,520 1200,320 L1200,675 Z" fill="url(%23accent-light)"/><g stroke="%230A4F29" stroke-width="1.5" stroke-opacity="0.04" fill="none"><circle cx="1200" cy="0" r="160"/><circle cx="1200" cy="0" r="320"/><circle cx="1200" cy="0" r="480"/><circle cx="1200" cy="0" r="640"/></g><text x="1140" y="605" font-family="system-ui, sans-serif" font-weight="900" font-size="28" fill="%230A4F29" fill-opacity="0.08" text-anchor="end">zera</text><text x="1140" y="625" font-family="system-ui, sans-serif" font-weight="700" font-size="9" fill="%23668C4A" fill-opacity="0.08" text-anchor="end" letter-spacing="2">INTERNATIONAL SCHOOL</text></svg>', 
    thumbnail: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675"><defs><linearGradient id="bg-light" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%23F4FDF7"/><stop offset="100%" stop-color="%23FFFFFF"/></linearGradient><linearGradient id="accent-light" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%230A4F29" stop-opacity="0.05"/><stop offset="100%" stop-color="%23668C4A" stop-opacity="0.02"/></linearGradient></defs><rect width="1200" height="675" fill="url(%23bg-light)"/><path d="M350,675 Q650,420 1200,520 L1200,675 Z" fill="url(%23accent-light)"/><path d="M550,675 Q850,520 1200,320 L1200,675 Z" fill="url(%23accent-light)"/><g stroke="%230A4F29" stroke-width="1.5" stroke-opacity="0.04" fill="none"><circle cx="1200" cy="0" r="160"/><circle cx="1200" cy="0" r="320"/><circle cx="1200" cy="0" r="480"/><circle cx="1200" cy="0" r="640"/></g><text x="1140" y="605" font-family="system-ui, sans-serif" font-weight="900" font-size="28" fill="%230A4F29" fill-opacity="0.08" text-anchor="end">zera</text><text x="1140" y="625" font-family="system-ui, sans-serif" font-weight="700" font-size="9" fill="%23668C4A" fill-opacity="0.08" text-anchor="end" letter-spacing="2">INTERNATIONAL SCHOOL</text></svg>', 
    category: 'Zera' 
  },
  { 
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675"><defs><linearGradient id="bg-dark" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%23052814"/><stop offset="100%" stop-color="%230A4F29"/></linearGradient><linearGradient id="accent-dark" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%23F7B917" stop-opacity="0.06"/><stop offset="100%" stop-color="%23668C4A" stop-opacity="0.02"/></linearGradient></defs><rect width="1200" height="675" fill="url(%23bg-dark)"/><path d="M350,675 Q650,420 1200,520 L1200,675 Z" fill="url(%23accent-dark)"/><path d="M550,675 Q850,520 1200,520 L1200,675 Z" fill="url(%23accent-dark)"/><g stroke="%23F7B917" stroke-width="1" stroke-opacity="0.05" fill="none"><line x1="0" y1="120" x2="1200" y2="120" /><line x1="0" y1="260" x2="1200" y2="260" /><line x1="0" y1="400" x2="1200" y2="400" /><line x1="0" y1="540" x2="1200" y2="540" /></g><text x="1140" y="605" font-family="system-ui, sans-serif" font-weight="900" font-size="28" fill="%23F7B917" fill-opacity="0.14" text-anchor="end">zera</text><text x="1140" y="625" font-family="system-ui, sans-serif" font-weight="700" font-size="9" fill="%23FFFFFF" fill-opacity="0.14" text-anchor="end" letter-spacing="2">INTERNATIONAL SCHOOL</text></svg>', 
    thumbnail: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675"><defs><linearGradient id="bg-dark" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%23052814"/><stop offset="100%" stop-color="%230A4F29"/></linearGradient><linearGradient id="accent-dark" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%23F7B917" stop-opacity="0.06"/><stop offset="100%" stop-color="%23668C4A" stop-opacity="0.02"/></linearGradient></defs><rect width="1200" height="675" fill="url(%23bg-dark)"/><path d="M350,675 Q650,420 1200,520 L1200,675 Z" fill="url(%23accent-dark)"/><path d="M550,675 Q850,520 1200,520 L1200,675 Z" fill="url(%23accent-dark)"/><g stroke="%23F7B917" stroke-width="1" stroke-opacity="0.05" fill="none"><line x1="0" y1="120" x2="1200" y2="120" /><line x1="0" y1="260" x2="1200" y2="260" /><line x1="0" y1="400" x2="1200" y2="400" /><line x1="0" y1="540" x2="1200" y2="540" /></g><text x="1140" y="605" font-family="system-ui, sans-serif" font-weight="900" font-size="28" fill="%23F7B917" fill-opacity="0.14" text-anchor="end">zera</text><text x="1140" y="625" font-family="system-ui, sans-serif" font-weight="700" font-size="9" fill="%23FFFFFF" fill-opacity="0.14" text-anchor="end" letter-spacing="2">INTERNATIONAL SCHOOL</text></svg>', 
    category: 'Zera' 
  },
  { 
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675"><defs><linearGradient id="bg-sage" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%23F4FDF5"/><stop offset="100%" stop-color="%23E2EFE5"/></linearGradient><linearGradient id="lines" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="%23668C4A" stop-opacity="0.07"/><stop offset="100%" stop-color="%230A4F29" stop-opacity="0.02"/></linearGradient></defs><rect width="1200" height="675" fill="url(%23bg-sage)"/><circle cx="100" cy="100" r="300" fill="url(%23lines)" /><circle cx="1100" cy="600" r="350" fill="url(%23lines)" /><text x="1140" y="605" font-family="system-ui, sans-serif" font-weight="900" font-size="28" fill="%230A4F29" fill-opacity="0.08" text-anchor="end">zera</text><text x="1140" y="625" font-family="system-ui, sans-serif" font-weight="700" font-size="9" fill="%23668C4A" fill-opacity="0.08" text-anchor="end" letter-spacing="2">INTERNATIONAL SCHOOL</text></svg>', 
    thumbnail: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675"><defs><linearGradient id="bg-sage" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%23F4FDF5"/><stop offset="100%" stop-color="%23E2EFE5"/></linearGradient><linearGradient id="lines" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="%23668C4A" stop-opacity="0.07"/><stop offset="100%" stop-color="%230A4F29" stop-opacity="0.02"/></linearGradient></defs><rect width="1200" height="675" fill="url(%23bg-sage)"/><circle cx="100" cy="100" r="300" fill="url(%23lines)" /><circle cx="1100" cy="600" r="350" fill="url(%23lines)" /><text x="1140" y="605" font-family="system-ui, sans-serif" font-weight="900" font-size="28" fill="%230A4F29" fill-opacity="0.08" text-anchor="end">zera</text><text x="1140" y="625" font-family="system-ui, sans-serif" font-weight="700" font-size="9" fill="%23668C4A" fill-opacity="0.08" text-anchor="end" letter-spacing="2">INTERNATIONAL SCHOOL</text></svg>', 
    category: 'Zera' 
  },
  { 
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675"><defs><linearGradient id="bg-clean" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%23FFFFFF"/><stop offset="100%" stop-color="%23F9FBF9"/></linearGradient></defs><rect width="1200" height="675" fill="url(%23bg-clean)"/><rect x="30" y="30" width="1140" height="615" rx="16" fill="none" stroke="%230A4F29" stroke-width="2" stroke-opacity="0.06"/><circle cx="1170" cy="645" r="90" fill="%23F7B917" fill-opacity="0.04" /><text x="1140" y="605" font-family="system-ui, sans-serif" font-weight="900" font-size="28" fill="%230A4F29" fill-opacity="0.08" text-anchor="end">zera</text><text x="1140" y="625" font-family="system-ui, sans-serif" font-weight="700" font-size="9" fill="%23668C4A" fill-opacity="0.08" text-anchor="end" letter-spacing="2">INTERNATIONAL SCHOOL</text></svg>', 
    thumbnail: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675"><defs><linearGradient id="bg-clean" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%23FFFFFF"/><stop offset="100%" stop-color="%23F9FBF9"/></linearGradient></defs><rect width="1200" height="675" fill="url(%23bg-clean)"/><rect x="30" y="30" width="1140" height="615" rx="16" fill="none" stroke="%230A4F29" stroke-width="2" stroke-opacity="0.06"/><circle cx="1170" cy="645" r="90" fill="%23F7B917" fill-opacity="0.04" /><text x="1140" y="605" font-family="system-ui, sans-serif" font-weight="900" font-size="28" fill="%230A4F29" fill-opacity="0.08" text-anchor="end">zera</text><text x="1140" y="625" font-family="system-ui, sans-serif" font-weight="700" font-size="9" fill="%23668C4A" fill-opacity="0.08" text-anchor="end" letter-spacing="2">INTERNATIONAL SCHOOL</text></svg>', 
    category: 'Zera' 
  },
  { 
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675"><defs><linearGradient id="bg-pre" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%23F0FDF8"/><stop offset="100%" stop-color="%23E6FCF2"/></linearGradient></defs><rect width="1200" height="675" fill="url(%23bg-pre)"/><g stroke="%233A7A5E" stroke-width="1.5" stroke-opacity="0.06" fill="none"><path d="M100,200 Q200,100 300,200 T500,200 T700,200 T900,200 T1100,200" /><path d="M50,450 Q180,350 310,450 T630,450 T950,450 T1150,450" /></g><g fill="%23F7B917" fill-opacity="0.08"><polygon points="120,80 125,95 140,95 128,105 132,120 120,110 108,120 112,105 100,95 115,95" /><polygon points="980,140 983,150 995,150 985,157 988,168 980,160 972,168 975,157 965,150 977,150" /><circle cx="500" cy="130" r="18" /><circle cx="750" cy="500" r="12" /></g><text x="1140" y="605" font-family="system-ui, sans-serif" font-weight="950" font-size="34" fill="%233A7A5E" fill-opacity="0.08" text-anchor="end">zera pre</text><text x="1140" y="625" font-family="system-ui, sans-serif" font-weight="700" font-size="9" fill="%23F7B917" fill-opacity="0.1" text-anchor="end" letter-spacing="3.2">EARLY YEARS EDUCATION</text></svg>', 
    thumbnail: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675"><defs><linearGradient id="bg-pre" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%23F0FDF8"/><stop offset="100%" stop-color="%23E6FCF2"/></linearGradient></defs><rect width="1200" height="675" fill="url(%23bg-pre)"/><g stroke="%233A7A5E" stroke-width="1.5" stroke-opacity="0.06" fill="none"><path d="M100,200 Q200,100 300,200 T500,200 T700,200 T900,200 T1100,200" /><path d="M50,450 Q180,350 310,450 T630,450 T950,450 T1150,450" /></g><g fill="%23F7B917" fill-opacity="0.08"><polygon points="120,80 125,95 140,95 128,105 132,120 120,110 108,120 112,105 100,95 115,95" /><polygon points="980,140 983,150 995,150 985,157 988,168 980,160 972,168 975,157 965,150 977,150" /><circle cx="500" cy="130" r="18" /><circle cx="750" cy="500" r="12" /></g><text x="1140" y="605" font-family="system-ui, sans-serif" font-weight="950" font-size="34" fill="%233A7A5E" fill-opacity="0.08" text-anchor="end">zera pre</text><text x="1140" y="625" font-family="system-ui, sans-serif" font-weight="700" font-size="9" fill="%23F7B917" fill-opacity="0.1" text-anchor="end" letter-spacing="3.2">EARLY YEARS EDUCATION</text></svg>', 
    category: 'Zera' 
  },
  { 
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675"><defs><linearGradient id="bg-music" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%23FFFDF2"/><stop offset="100%" stop-color="%23FFFBEA"/></linearGradient></defs><rect width="1200" height="675" fill="url(%23bg-music)"/><path d="M-100,200 C300,50 600,450 1300,250" fill="none" stroke="%23F7B917" stroke-width="3" stroke-opacity="0.04" /><path d="M-100,220 C300,70 600,470 1300,270" fill="none" stroke="%230A4F29" stroke-width="1.5" stroke-opacity="0.03" /><path d="M-100,240 C300,90 600,490 1300,290" fill="none" stroke="%230A4F29" stroke-width="1" stroke-opacity="0.02" /><g fill="%230A4F29" fill-opacity="0.05"><path d="M300,220 A15,10 0 1 1 270,220 A15,10 0 1 1 300,220 z" /><rect x="290" y="140" width="4" height="80" /><path d="M800,320 A15,10 0 1 1 770,320 A15,10 0 1 1 800,320 z" /><rect x="790" y="240" width="4" height="80" /><path d="M790,240 Q820,230 840,250 L840,240 Q810,220 790,240" fill="%230A4F29" fill-opacity="0.05" /></g><text x="1140" y="605" font-family="system-ui, sans-serif" font-weight="900" font-size="28" fill="%230A4F29" fill-opacity="0.08" text-anchor="end">zera music</text><text x="1140" y="625" font-family="system-ui, sans-serif" font-weight="700" font-size="9" fill="%23F7B917" fill-opacity="0.1" text-anchor="end" letter-spacing="2">CREATIVE ARTS DIVISION</text></svg>', 
    thumbnail: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675"><defs><linearGradient id="bg-music" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%23FFFDF2"/><stop offset="100%" stop-color="%23FFFBEA"/></linearGradient></defs><rect width="1200" height="675" fill="url(%23bg-music)"/><path d="M-100,200 C300,50 600,450 1300,250" fill="none" stroke="%23F7B917" stroke-width="3" stroke-opacity="0.04" /><path d="M-100,220 C300,70 600,470 1300,270" fill="none" stroke="%230A4F29" stroke-width="1.5" stroke-opacity="0.03" /><path d="M-100,240 C300,90 600,490 1300,290" fill="none" stroke="%230A4F29" stroke-width="1" stroke-opacity="0.02" /><g fill="%230A4F29" fill-opacity="0.05"><path d="M300,220 A15,10 0 1 1 270,220 A15,10 0 1 1 300,220 z" /><rect x="290" y="140" width="4" height="80" /><path d="M800,320 A15,10 0 1 1 770,320 A15,10 0 1 1 800,320 z" /><rect x="790" y="240" width="4" height="80" /><path d="M790,240 Q820,230 840,250 L840,240 Q810,220 790,240" fill="%230A4F29" fill-opacity="0.05" /></g><text x="1140" y="605" font-family="system-ui, sans-serif" font-weight="900" font-size="28" fill="%230A4F29" fill-opacity="0.08" text-anchor="end">zera music</text><text x="1140" y="625" font-family="system-ui, sans-serif" font-weight="700" font-size="9" fill="%23F7B917" fill-opacity="0.1" text-anchor="end" letter-spacing="2">CREATIVE ARTS DIVISION</text></svg>', 
    category: 'Zera' 
  },
  { 
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675"><defs><linearGradient id="bg-plus" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%23ECFEFF"/><stop offset="100%" stop-color="%23FFFFFF"/></linearGradient></defs><rect width="1200" height="675" fill="url(%23bg-plus)"/><g stroke="%2327829E" stroke-width="1" stroke-opacity="0.04" fill="none"><line x1="50" y1="0" x2="50" y2="675" /><line x1="150" y1="0" x2="150" y2="675" /><line x1="250" y1="0" x2="250" y2="675" /><line x1="350" y1="0" x2="350" y2="675" /><line x1="450" y1="0" x2="450" y2="675" /><line x1="550" y1="0" x2="550" y2="675" /><line x1="650" y1="0" x2="650" y2="675" /><line x1="750" y1="0" x2="750" y2="675" /><line x1="850" y1="0" x2="850" y2="675" /><line x1="950" y1="0" x2="950" y2="675" /><line x1="1050" y1="0" x2="1050" y2="675" /><line x1="1150" y1="0" x2="1150" y2="675" /><line x1="0" y1="100" x2="1200" y2="100" /><line x1="0" y1="200" x2="1200" y2="200" /><line x1="0" y1="300" x2="1200" y2="300" /><line x1="0" y1="400" x2="1200" y2="400" /><line x1="0" y1="500" x2="1200" y2="500" /><line x1="0" y1="600" x2="1200" y2="600" /></g><path d="M-100,500 Q200,650 630,480 T1300,520 L1300,675 L-100,675 Z" fill="%2327829E" fill-opacity="0.02" /><path d="M-100,550 Q300,620 700,510 T1300,580 L1300,675 L-100,675 Z" fill="%2327829E" fill-opacity="0.01" /><text x="1140" y="605" font-family="system-ui, sans-serif" font-weight="900" font-size="28" fill="%2327829E" fill-opacity="0.08" text-anchor="end">zera plus</text><text x="1140" y="625" font-family="system-ui, sans-serif" font-weight="700" font-size="9" fill="%2327829E" fill-opacity="0.08" text-anchor="end" letter-spacing="2">HIGHER SECONDARY ACADEMY</text></svg>', 
    thumbnail: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675"><defs><linearGradient id="bg-plus" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%23ECFEFF"/><stop offset="100%" stop-color="%23FFFFFF"/></linearGradient></defs><rect width="1200" height="675" fill="url(%23bg-plus)"/><g stroke="%2327829E" stroke-width="1" stroke-opacity="0.04" fill="none"><line x1="50" y1="0" x2="50" y2="675" /><line x1="150" y1="0" x2="150" y2="675" /><line x1="250" y1="0" x2="250" y2="675" /><line x1="350" y1="0" x2="350" y2="675" /><line x1="450" y1="0" x2="450" y2="675" /><line x1="550" y1="0" x2="550" y2="675" /><line x1="650" y1="0" x2="650" y2="675" /><line x1="750" y1="0" x2="750" y2="675" /><line x1="850" y1="0" x2="850" y2="675" /><line x1="950" y1="0" x2="950" y2="675" /><line x1="1050" y1="0" x2="1050" y2="675" /><line x1="1150" y1="0" x2="1150" y2="675" /><line x1="0" y1="100" x2="1200" y2="100" /><line x1="0" y1="200" x2="1200" y2="200" /><line x1="0" y1="300" x2="1200" y2="300" /><line x1="0" y1="400" x2="1200" y2="400" /><line x1="0" y1="500" x2="1200" y2="500" /><line x1="0" y1="600" x2="1200" y2="600" /></g><path d="M-100,500 Q200,650 630,480 T1300,520 L1300,675 L-100,675 Z" fill="%2327829E" fill-opacity="0.02" /><path d="M-100,550 Q300,620 700,510 T1300,580 L1300,675 L-100,675 Z" fill="%2327829E" fill-opacity="0.01" /><text x="1140" y="605" font-family="system-ui, sans-serif" font-weight="900" font-size="28" fill="%2327829E" fill-opacity="0.08" text-anchor="end">zera plus</text><text x="1140" y="625" font-family="system-ui, sans-serif" font-weight="700" font-size="9" fill="%2327829E" fill-opacity="0.08" text-anchor="end" letter-spacing="2">HIGHER SECONDARY ACADEMY</text></svg>', 
    category: 'Zera' 
  },
  { 
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675"><defs><linearGradient id="bg-scientific" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%23FFFFFF"/><stop offset="100%" stop-color="%23F4FDF7"/></linearGradient></defs><rect width="1200" height="675" fill="url(%23bg-scientific)"/><circle cx="150" cy="150" r="120" stroke="%230A4F29" stroke-width="1.5" stroke-opacity="0.03" fill="none" /><line x1="150" y1="10" x2="150" y2="290" stroke="%230A4F29" stroke-linecap="round" stroke-width="1" stroke-dasharray="4,4" stroke-opacity="0.03" /><line x1="10" y1="150" x2="290" y2="150" stroke="%230A4F29" stroke-linecap="round" stroke-width="1" stroke-dasharray="4,4" stroke-opacity="0.03" /><circle cx="1050" cy="200" r="180" stroke="%23668C4A" stroke-width="1.5" stroke-opacity="0.03" fill="none" /><path d="M1010,240 L1050,160 L1090,240 Z" fill="none" stroke="%23668C4A" stroke-width="1.5" stroke-opacity="0.03" /><text x="1140" y="605" font-family="system-ui, sans-serif" font-weight="900" font-size="28" fill="%230A4F29" fill-opacity="0.08" text-anchor="end">zera</text><text x="1140" y="625" font-family="system-ui, sans-serif" font-weight="700" font-size="9" fill="%23668C4A" fill-opacity="0.08" text-anchor="end" letter-spacing="2">STEM %26 ACADEMICS LABORATORY</text></svg>', 
    thumbnail: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675"><defs><linearGradient id="bg-scientific" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%23FFFFFF"/><stop offset="100%" stop-color="%23F4FDF7"/></linearGradient></defs><rect width="1200" height="675" fill="url(%23bg-scientific)"/><circle cx="150" cy="150" r="120" stroke="%230A4F29" stroke-width="1.5" stroke-opacity="0.03" fill="none" /><line x1="150" y1="10" x2="150" y2="290" stroke="%230A4F29" stroke-linecap="round" stroke-width="1" stroke-dasharray="4,4" stroke-opacity="0.03" /><line x1="10" y1="150" x2="290" y2="150" stroke="%230A4F29" stroke-linecap="round" stroke-width="1" stroke-dasharray="4,4" stroke-opacity="0.03" /><circle cx="1050" cy="200" r="180" stroke="%23668C4A" stroke-width="1.5" stroke-opacity="0.03" fill="none" /><path d="M1010,240 L1050,160 L1090,240 Z" fill="none" stroke="%23668C4A" stroke-width="1.5" stroke-opacity="0.03" /><text x="1140" y="605" font-family="system-ui, sans-serif" font-weight="900" font-size="28" fill="%230A4F29" fill-opacity="0.08" text-anchor="end">zera</text><text x="1140" y="625" font-family="system-ui, sans-serif" font-weight="700" font-size="9" fill="%23668C4A" fill-opacity="0.08" text-anchor="end" letter-spacing="2">STEM %26 ACADEMICS LABORATORY</text></svg>', 
    category: 'Zera' 
  },
  { 
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675"><defs><linearGradient id="bg-exec" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%2302140A"/><stop offset="100%" stop-color="%230A4F29"/></linearGradient></defs><rect width="1200" height="675" fill="url(%23bg-exec)"/><g stroke="%23F7B917" stroke-width="1" stroke-opacity="0.07" fill="none"><line x1="-100" y1="675" x2="1300" y2="-100" /><line x1="-200" y1="675" x2="1200" y2="-100" /><line x1="0" y1="675" x2="1400" y2="-100" /></g><g fill="%23F7B917" fill-opacity="0.1"><polygon points="300,100 304,110 316,110 306,117 309,128 301,120 293,128 296,117 286,110 298,110" /><polygon points="700,50 703,57 711,57 705,62 707,70 701,65 695,70 697,62 691,57 699,57" /></g><text x="1140" y="605" font-family="system-ui, sans-serif" font-weight="900" font-size="28" fill="%23F7B917" fill-opacity="0.12" text-anchor="end">zera</text><text x="1140" y="625" font-family="system-ui, sans-serif" font-weight="700" font-size="9" fill="%23FFFFFF" fill-opacity="0.15" text-anchor="end" letter-spacing="2.5">EXECUTIVE DESIGN SUITE</text></svg>', 
    thumbnail: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675"><defs><linearGradient id="bg-exec" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%2302140A"/><stop offset="100%" stop-color="%230A4F29"/></linearGradient></defs><rect width="1200" height="675" fill="url(%23bg-exec)"/><g stroke="%23F7B917" stroke-width="1" stroke-opacity="0.07" fill="none"><line x1="-100" y1="675" x2="1300" y2="-100" /><line x1="-200" y1="675" x2="1200" y2="-100" /><line x1="0" y1="675" x2="1400" y2="-100" /></g><g fill="%23F7B917" fill-opacity="0.1"><polygon points="300,100 304,110 316,110 306,117 309,128 301,120 293,128 296,117 286,110 298,110" /><polygon points="700,50 703,57 711,57 705,62 707,70 701,65 695,70 697,62 691,57 699,57" /></g><text x="1140" y="605" font-family="system-ui, sans-serif" font-weight="900" font-size="28" fill="%23F7B917" fill-opacity="0.12" text-anchor="end">zera</text><text x="1140" y="625" font-family="system-ui, sans-serif" font-weight="700" font-size="9" fill="%23FFFFFF" fill-opacity="0.15" text-anchor="end" letter-spacing="2.5">EXECUTIVE DESIGN SUITE</text></svg>', 
    category: 'Zera' 
  },
  { 
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675"><defs><linearGradient id="bg-editorial" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%23F3F7ED"/><stop offset="100%" stop-color="%23E7ECD9"/></linearGradient></defs><rect width="1200" height="675" fill="url(%23bg-editorial)"/><rect x="40" y="40" width="1120" height="595" fill="none" stroke="%23668C4A" stroke-width="1.5" stroke-opacity="0.08" /><line x1="200" y1="40" x2="200" y2="635" stroke="%23668C4A" stroke-width="1" stroke-opacity="0.05" /><text x="1140" y="605" font-family="system-ui, sans-serif" font-weight="900" font-size="28" fill="%230A4F29" fill-opacity="0.08" text-anchor="end">zera</text><text x="1140" y="625" font-family="system-ui, sans-serif" font-weight="700" font-size="9" fill="%23668C4A" fill-opacity="0.08" text-anchor="end" letter-spacing="2">EDITORIAL %26 LITERACY COMPANION</text></svg>', 
    thumbnail: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675"><defs><linearGradient id="bg-editorial" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%23F3F7ED"/><stop offset="100%" stop-color="%23E7ECD9"/></linearGradient></defs><rect width="1200" height="675" fill="url(%23bg-editorial)"/><rect x="40" y="40" width="1120" height="595" fill="none" stroke="%23668C4A" stroke-width="1.5" stroke-opacity="0.08" /><line x1="200" y1="40" x2="200" y2="635" stroke="%23668C4A" stroke-width="1" stroke-opacity="0.05" /><text x="1140" y="605" font-family="system-ui, sans-serif" font-weight="900" font-size="28" fill="%230A4F29" fill-opacity="0.08" text-anchor="end">zera</text><text x="1140" y="625" font-family="system-ui, sans-serif" font-weight="700" font-size="9" fill="%23668C4A" fill-opacity="0.08" text-anchor="end" letter-spacing="2">EDITORIAL %26 LITERACY COMPANION</text></svg>', 
    category: 'Zera' 
  },
  { 
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675"><defs><linearGradient id="bg-dark" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%23052814"/><stop offset="100%" stop-color="%230A4F29"/></linearGradient><linearGradient id="accent-dark" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%23F7B917" stop-opacity="0.06"/><stop offset="100%" stop-color="%23668C4A" stop-opacity="0.02"/></linearGradient></defs><rect width="1200" height="675" fill="url(%23bg-dark)"/><path d="M350,675 Q650,420 1200,520 L1200,675 Z" fill="url(%23accent-dark)"/><path d="M550,675 Q850,520 1200,520 L1200,675 Z" fill="url(%23accent-dark)"/><g stroke="%23F7B917" stroke-width="1" stroke-opacity="0.05" fill="none"><line x1="0" y1="120" x2="1200" y2="120" /><line x1="0" y1="260" x2="1200" y2="260" /><line x1="0" y1="400" x2="1200" y2="400" /><line x1="0" y1="540" x2="1200" y2="540" /></g><text x="1140" y="605" font-family="system-ui, sans-serif" font-weight="900" font-size="28" fill="%23F7B917" fill-opacity="0.14" text-anchor="end">zera</text><text x="1140" y="625" font-family="system-ui, sans-serif" font-weight="700" font-size="9" fill="%23FFFFFF" fill-opacity="0.14" text-anchor="end" letter-spacing="2">INTERNATIONAL SCHOOL</text></svg>', 
    thumbnail: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675"><defs><linearGradient id="bg-dark" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%23052814"/><stop offset="100%" stop-color="%230A4F29"/></linearGradient><linearGradient id="accent-dark" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%23F7B917" stop-opacity="0.06"/><stop offset="100%" stop-color="%23668C4A" stop-opacity="0.02"/></linearGradient></defs><rect width="1200" height="675" fill="url(%23bg-dark)"/><path d="M350,675 Q650,420 1200,520 L1200,675 Z" fill="url(%23accent-dark)"/><path d="M550,675 Q850,520 1200,520 L1200,675 Z" fill="url(%23accent-dark)"/><g stroke="%23F7B917" stroke-width="1" stroke-opacity="0.05" fill="none"><line x1="0" y1="120" x2="1200" y2="120" /><line x1="0" y1="260" x2="1200" y2="260" /><line x1="0" y1="400" x2="1200" y2="400" /><line x1="0" y1="540" x2="1200" y2="540" /></g><text x="1140" y="605" font-family="system-ui, sans-serif" font-weight="900" font-size="28" fill="%23F7B917" fill-opacity="0.14" text-anchor="end">zera</text><text x="1140" y="625" font-family="system-ui, sans-serif" font-weight="700" font-size="9" fill="%23FFFFFF" fill-opacity="0.14" text-anchor="end" letter-spacing="2">INTERNATIONAL SCHOOL</text></svg>', 
    category: 'Zera' 
  },
  { 
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675"><defs><linearGradient id="bg-sage" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%23F4FDF5"/><stop offset="100%" stop-color="%23E2EFE5"/></linearGradient><linearGradient id="lines" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="%23668C4A" stop-opacity="0.07"/><stop offset="100%" stop-color="%230A4F29" stop-opacity="0.02"/></linearGradient></defs><rect width="1200" height="675" fill="url(%23bg-sage)"/><circle cx="100" cy="100" r="300" fill="url(%23lines)" /><circle cx="1100" cy="600" r="350" fill="url(%23lines)" /><text x="1140" y="605" font-family="system-ui, sans-serif" font-weight="900" font-size="28" fill="%230A4F29" fill-opacity="0.08" text-anchor="end">zera</text><text x="1140" y="625" font-family="system-ui, sans-serif" font-weight="700" font-size="9" fill="%23668C4A" fill-opacity="0.08" text-anchor="end" letter-spacing="2">INTERNATIONAL SCHOOL</text></svg>', 
    thumbnail: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675"><defs><linearGradient id="bg-sage" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%23F4FDF5"/><stop offset="100%" stop-color="%23E2EFE5"/></linearGradient><linearGradient id="lines" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="%23668C4A" stop-opacity="0.07"/><stop offset="100%" stop-color="%230A4F29" stop-opacity="0.02"/></linearGradient></defs><rect width="1200" height="675" fill="url(%23bg-sage)"/><circle cx="100" cy="100" r="300" fill="url(%23lines)" /><circle cx="1100" cy="600" r="350" fill="url(%23lines)" /><text x="1140" y="605" font-family="system-ui, sans-serif" font-weight="900" font-size="28" fill="%230A4F29" fill-opacity="0.08" text-anchor="end">zera</text><text x="1140" y="625" font-family="system-ui, sans-serif" font-weight="700" font-size="9" fill="%23668C4A" fill-opacity="0.08" text-anchor="end" letter-spacing="2">INTERNATIONAL SCHOOL</text></svg>', 
    category: 'Zera' 
  },
  { 
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675"><defs><linearGradient id="bg-clean" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%23FFFFFF"/><stop offset="100%" stop-color="%23F9FBF9"/></linearGradient></defs><rect width="1200" height="675" fill="url(%23bg-clean)"/><rect x="30" y="30" width="1140" height="615" rx="16" fill="none" stroke="%230A4F29" stroke-width="2" stroke-opacity="0.06"/><circle cx="1170" cy="645" r="90" fill="%23F7B917" fill-opacity="0.04" /><text x="1140" y="605" font-family="system-ui, sans-serif" font-weight="900" font-size="28" fill="%230A4F29" fill-opacity="0.08" text-anchor="end">zera</text><text x="1140" y="625" font-family="system-ui, sans-serif" font-weight="700" font-size="9" fill="%23668C4A" fill-opacity="0.08" text-anchor="end" letter-spacing="2">INTERNATIONAL SCHOOL</text></svg>', 
    thumbnail: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675"><defs><linearGradient id="bg-clean" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%23FFFFFF"/><stop offset="100%" stop-color="%23F9FBF9"/></linearGradient></defs><rect width="1200" height="675" fill="url(%23bg-clean)"/><rect x="30" y="30" width="1140" height="615" rx="16" fill="none" stroke="%230A4F29" stroke-width="2" stroke-opacity="0.06"/><circle cx="1170" cy="645" r="90" fill="%23F7B917" fill-opacity="0.04" /><text x="1140" y="605" font-family="system-ui, sans-serif" font-weight="900" font-size="28" fill="%230A4F29" fill-opacity="0.08" text-anchor="end">zera</text><text x="1140" y="625" font-family="system-ui, sans-serif" font-weight="700" font-size="9" fill="%23668C4A" fill-opacity="0.08" text-anchor="end" letter-spacing="2">INTERNATIONAL SCHOOL</text></svg>', 
    category: 'Zera' 
  },

  // --- PASTEL --- (generated below — Canva-style soft template backgrounds)

  // --- ABSTRACT --- (generated below — Canva-style bold geometric/fluid art)
];

// ---------------------------------------------------------------------------
// Generated pastel backgrounds — Canva-template-style: soft gradients, corner
// blobs, layered waves, polka dots, rainbow arcs, clouds, scalloped cards,
// memphis confetti, gingham checks and star sprinkles, each rendered across
// six pastel palettes. Self-contained SVG data URIs: crisp at any size, work
// offline, and never break like hotlinked photos.
// ---------------------------------------------------------------------------

interface PastelPalette {
  bg: string; // page background
  a: string; // primary pastel
  b: string; // deeper sister tone
  c: string; // pale wash
}

const PASTEL_PALETTES: PastelPalette[] = [
  { bg: '#FFF5F7', a: '#F9C5D5', b: '#F2A0BE', c: '#FDE2E8' }, // rose
  { bg: '#F8F5FD', a: '#DCC8F2', b: '#BFA0E5', c: '#EDE3FA' }, // lavender
  { bg: '#F2FBF6', a: '#BCE6CF', b: '#8FD4B2', c: '#DDF3E7' }, // mint
  { bg: '#F2F9FE', a: '#BBDEF5', b: '#8FC6EC', c: '#DDEFFA' }, // sky
  { bg: '#FFF8F2', a: '#FAD7B8', b: '#F4B585', c: '#FDE9D7' }, // peach
  { bg: '#FFFDF0', a: '#F7E8A8', b: '#EDD371', c: '#FBF3D2' }, // lemon
];

const SVG_OPEN =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675">';

// Fully percent-encoded so the URI is safe inside CSS url("…"), <img src>
// and React style props (the SVG markup contains quotes and spaces).
const svgToDataUri = (body: string): string =>
  'data:image/svg+xml,' + encodeURIComponent(SVG_OPEN + body + '</svg>');

const pastelBuilders: ((p: PastelPalette) => string)[] = [
  // 1. soft diagonal gradient wash with a dreamy highlight
  (p) =>
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${p.bg}"/><stop offset="55%" stop-color="${p.c}"/><stop offset="100%" stop-color="${p.a}"/></linearGradient></defs>` +
    `<rect width="1200" height="675" fill="url(#g)"/>` +
    `<circle cx="960" cy="90" r="280" fill="#FFFFFF" fill-opacity="0.28"/>` +
    `<circle cx="120" cy="620" r="200" fill="#FFFFFF" fill-opacity="0.18"/>`,
  // 2. big organic corner blobs
  (p) =>
    `<rect width="1200" height="675" fill="${p.bg}"/>` +
    `<circle cx="-70" cy="-50" r="310" fill="${p.a}" fill-opacity="0.85"/>` +
    `<circle cx="1270" cy="720" r="340" fill="${p.b}" fill-opacity="0.55"/>` +
    `<circle cx="1160" cy="70" r="120" fill="${p.c}"/>` +
    `<circle cx="80" cy="610" r="85" fill="${p.c}"/>` +
    `<circle cx="1030" cy="180" r="16" fill="${p.b}" fill-opacity="0.5"/>` +
    `<circle cx="200" cy="490" r="12" fill="${p.b}" fill-opacity="0.4"/>`,
  // 3. layered bottom waves
  (p) =>
    `<rect width="1200" height="675" fill="${p.bg}"/>` +
    `<path d="M0,470 C220,420 420,520 640,480 C860,440 1040,510 1200,470 L1200,675 L0,675 Z" fill="${p.c}"/>` +
    `<path d="M0,530 C240,480 460,580 700,540 C920,505 1080,560 1200,530 L1200,675 L0,675 Z" fill="${p.a}" fill-opacity="0.85"/>` +
    `<path d="M0,595 C260,555 520,635 780,600 C1000,572 1120,615 1200,595 L1200,675 L0,675 Z" fill="${p.b}" fill-opacity="0.8"/>` +
    `<circle cx="1050" cy="120" r="60" fill="${p.a}" fill-opacity="0.5"/>`,
  // 4. polka dot grid
  (p) =>
    `<defs><pattern id="d" width="68" height="68" patternUnits="userSpaceOnUse"><circle cx="14" cy="14" r="9" fill="${p.a}"/><circle cx="48" cy="48" r="5" fill="${p.c}"/></pattern></defs>` +
    `<rect width="1200" height="675" fill="${p.bg}"/>` +
    `<rect width="1200" height="675" fill="url(#d)"/>`,
  // 5. rainbow arc corner
  (p) =>
    `<rect width="1200" height="675" fill="${p.bg}"/>` +
    `<g fill="none" stroke-linecap="round">` +
    `<circle cx="0" cy="675" r="330" stroke="${p.b}" stroke-width="46" stroke-opacity="0.75"/>` +
    `<circle cx="0" cy="675" r="252" stroke="${p.a}" stroke-width="46"/>` +
    `<circle cx="0" cy="675" r="174" stroke="${p.c}" stroke-width="46"/>` +
    `<circle cx="1200" cy="0" r="240" stroke="${p.a}" stroke-width="36" stroke-opacity="0.55"/>` +
    `<circle cx="1200" cy="0" r="160" stroke="${p.c}" stroke-width="36" stroke-opacity="0.8"/>` +
    `</g>` +
    `<circle cx="640" cy="120" r="11" fill="${p.b}" fill-opacity="0.45"/>` +
    `<circle cx="900" cy="540" r="14" fill="${p.a}" fill-opacity="0.6"/>`,
  // 6. pastel sky with clouds and sun
  (p) =>
    `<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${p.a}"/><stop offset="100%" stop-color="${p.bg}"/></linearGradient></defs>` +
    `<rect width="1200" height="675" fill="url(#s)"/>` +
    `<circle cx="1020" cy="110" r="74" fill="#FFE9A8"/>` +
    `<g fill="#FFFFFF" fill-opacity="0.92">` +
    `<ellipse cx="220" cy="160" rx="150" ry="52"/><ellipse cx="330" cy="120" rx="100" ry="40"/>` +
    `<ellipse cx="760" cy="90" rx="120" ry="40"/>` +
    `<ellipse cx="980" cy="560" rx="170" ry="56"/><ellipse cx="860" cy="600" rx="120" ry="44"/>` +
    `<ellipse cx="180" cy="580" rx="130" ry="46"/>` +
    `</g>`,
  // 7. white card on pastel with dotted scallop frame
  (p) =>
    `<rect width="1200" height="675" fill="${p.a}"/>` +
    `<circle cx="60" cy="50" r="90" fill="${p.b}" fill-opacity="0.4"/>` +
    `<circle cx="1150" cy="640" r="110" fill="${p.b}" fill-opacity="0.4"/>` +
    `<rect x="52" y="52" width="1096" height="571" rx="36" fill="#FFFFFF" fill-opacity="0.96"/>` +
    `<rect x="76" y="76" width="1048" height="523" rx="26" fill="none" stroke="${p.b}" stroke-width="9" stroke-dasharray="0.1 26" stroke-linecap="round" stroke-opacity="0.65"/>`,
  // 8. memphis confetti
  (p) =>
    `<rect width="1200" height="675" fill="${p.bg}"/>` +
    `<g fill="none" stroke-linecap="round">` +
    `<path d="M120,110 q18,-26 36,0 q18,26 36,0" stroke="${p.b}" stroke-width="7"/>` +
    `<path d="M950,580 q18,-26 36,0 q18,26 36,0" stroke="${p.a}" stroke-width="7"/>` +
    `<path d="M560,70 l28,28 M588,70 l-28,28" stroke="${p.a}" stroke-width="7"/>` +
    `<path d="M180,560 l24,24 M204,560 l-24,24" stroke="${p.b}" stroke-width="6"/>` +
    `<circle cx="1080" cy="140" r="26" stroke="${p.b}" stroke-width="7"/>` +
    `<circle cx="320" cy="350" r="14" stroke="${p.a}" stroke-width="6"/>` +
    `</g>` +
    `<circle cx="860" cy="80" r="16" fill="${p.a}"/>` +
    `<circle cx="80" cy="320" r="11" fill="${p.b}" fill-opacity="0.7"/>` +
    `<circle cx="1130" cy="420" r="12" fill="${p.a}"/>` +
    `<circle cx="640" cy="610" r="14" fill="${p.b}" fill-opacity="0.6"/>` +
    `<rect x="430" y="540" width="24" height="24" rx="6" fill="${p.a}" transform="rotate(18 442 552)"/>` +
    `<rect x="760" y="300" width="18" height="18" rx="5" fill="${p.c}" transform="rotate(-14 769 309)"/>`,
  // 9. soft gingham check
  (p) =>
    `<defs><pattern id="gg" width="88" height="88" patternUnits="userSpaceOnUse">` +
    `<rect width="44" height="88" fill="${p.a}" fill-opacity="0.4"/>` +
    `<rect width="88" height="44" fill="${p.a}" fill-opacity="0.4"/>` +
    `</pattern></defs>` +
    `<rect width="1200" height="675" fill="${p.bg}"/>` +
    `<rect width="1200" height="675" fill="url(#gg)"/>`,
  // 10. star sprinkles
  (p) =>
    `<rect width="1200" height="675" fill="${p.c}"/>` +
    `<g fill="#FFFFFF" fill-opacity="0.95">` +
    `<path d="M180,120 l10,26 26,10 -26,10 -10,26 -10,-26 -26,-10 26,-10 Z"/>` +
    `<path d="M1010,90 l8,20 20,8 -20,8 -8,20 -8,-20 -20,-8 20,-8 Z"/>` +
    `<path d="M880,560 l9,23 23,9 -23,9 -9,23 -9,-23 -23,-9 23,-9 Z"/>` +
    `<path d="M150,540 l7,18 18,7 -18,7 -7,18 -7,-18 -18,-7 18,-7 Z"/>` +
    `</g>` +
    `<g fill="${p.b}" fill-opacity="0.65">` +
    `<circle cx="430" cy="100" r="7"/><circle cx="700" cy="170" r="5"/>` +
    `<circle cx="1120" cy="320" r="7"/><circle cx="320" cy="380" r="5"/>` +
    `<circle cx="560" cy="600" r="7"/><circle cx="1040" cy="610" r="5"/>` +
    `<circle cx="70" cy="240" r="5"/><circle cx="850" cy="340" r="4"/>` +
    `</g>`,
];

for (const build of pastelBuilders) {
  for (const palette of PASTEL_PALETTES) {
    const url = svgToDataUri(build(palette));
    PRESET_WALLPAPERS.push({ url, thumbnail: url, category: 'Pastel' });
  }
}

// ---------------------------------------------------------------------------
// Generated abstract backgrounds — Canva-template-style: fluid gradient mesh,
// bauhaus arches, liquid blobs, flowing ribbons, geometric corners, contour
// line art, diagonal splits, bold rings, torn side panels and terrazzo bits,
// rendered across six rich palettes. Edges carry the art; the centre stays
// calm so slide text remains readable.
// ---------------------------------------------------------------------------

interface AbstractPalette {
  bg: string; // light neutral page
  p1: string; // bold primary
  p2: string; // bold secondary
  p3: string; // punchy accent
}

const ABSTRACT_PALETTES: AbstractPalette[] = [
  { bg: '#FAF3EC', p1: '#D96F4E', p2: '#E8B468', p3: '#2E3A4E' }, // terracotta
  { bg: '#F0F6F7', p1: '#16697A', p2: '#82C0CC', p3: '#FFA62B' }, // ocean
  { bg: '#F8F3E8', p1: '#E0A933', p2: '#34353A', p3: '#C96342' }, // mustard
  { bg: '#F2F5EE', p1: '#2F5D50', p2: '#A4C3A2', p3: '#E6B655' }, // forest
  { bg: '#F6F1F9', p1: '#6D4C8C', p2: '#B68CD4', p3: '#E8A0BF' }, // violet
  { bg: '#FDF4F0', p1: '#FF7F6A', p2: '#1F3B73', p3: '#F9C846' }, // coral navy
];

const abstractBuilders: ((p: AbstractPalette) => string)[] = [
  // 1. fluid gradient mesh
  (p) =>
    `<defs>` +
    `<radialGradient id="m1"><stop offset="0%" stop-color="${p.p1}"/><stop offset="100%" stop-color="${p.p1}" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="m2"><stop offset="0%" stop-color="${p.p2}"/><stop offset="100%" stop-color="${p.p2}" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="m3"><stop offset="0%" stop-color="${p.p3}"/><stop offset="100%" stop-color="${p.p3}" stop-opacity="0"/></radialGradient>` +
    `</defs>` +
    `<rect width="1200" height="675" fill="${p.bg}"/>` +
    `<circle cx="80" cy="40" r="500" fill="url(#m1)" opacity="0.75"/>` +
    `<circle cx="1180" cy="640" r="540" fill="url(#m2)" opacity="0.8"/>` +
    `<circle cx="1120" cy="60" r="300" fill="url(#m3)" opacity="0.55"/>`,
  // 2. bauhaus concentric arches, bottom-right
  (p) =>
    `<rect width="1200" height="675" fill="${p.bg}"/>` +
    `<circle cx="1200" cy="675" r="520" fill="${p.p2}" fill-opacity="0.55"/>` +
    `<circle cx="1200" cy="675" r="400" fill="${p.p1}"/>` +
    `<circle cx="1200" cy="675" r="285" fill="${p.bg}"/>` +
    `<circle cx="1200" cy="675" r="175" fill="${p.p3}"/>` +
    `<circle cx="90" cy="80" r="46" fill="${p.p3}"/>` +
    `<circle cx="200" cy="50" r="16" fill="${p.p1}" fill-opacity="0.7"/>`,
  // 3. liquid blobs
  (p) =>
    `<rect width="1200" height="675" fill="${p.bg}"/>` +
    `<path d="M870,-160 C1080,-120 1260,30 1230,200 C1200,370 1000,330 880,260 C760,190 660,-200 870,-160 Z" fill="${p.p1}" fill-opacity="0.9"/>` +
    `<path d="M150,790 C-60,740 -40,520 90,460 C220,400 380,470 420,580 C460,690 360,840 150,790 Z" fill="${p.p2}"/>` +
    `<path d="M1110,560 C1190,580 1210,660 1140,700 C1070,740 980,690 1000,620 C1020,550 1030,540 1110,560 Z" fill="${p.p3}" fill-opacity="0.85"/>` +
    `<circle cx="160" cy="170" r="14" fill="${p.p3}"/>`,
  // 4. flowing ribbons
  (p) =>
    `<rect width="1200" height="675" fill="${p.bg}"/>` +
    `<path d="M-50,140 C300,30 560,260 900,150 C1080,95 1180,120 1260,90 L1260,-60 L-50,-60 Z" fill="${p.p2}" fill-opacity="0.5"/>` +
    `<path d="M-50,80 C300,-20 600,190 920,90 C1090,40 1190,70 1260,40 L1260,-60 L-50,-60 Z" fill="${p.p1}" fill-opacity="0.85"/>` +
    `<path d="M-50,610 C260,520 540,690 860,600 C1060,545 1170,590 1260,560 L1260,740 L-50,740 Z" fill="${p.p1}" fill-opacity="0.8"/>` +
    `<path d="M-50,660 C280,580 560,730 880,650 C1070,605 1180,640 1260,615 L1260,740 L-50,740 Z" fill="${p.p3}" fill-opacity="0.65"/>`,
  // 5. geometric corners (quarter discs + ring)
  (p) =>
    `<rect width="1200" height="675" fill="${p.bg}"/>` +
    `<path d="M0,0 L300,0 A300,300 0 0 1 0,300 Z" fill="${p.p1}"/>` +
    `<path d="M1200,675 L900,675 A300,300 0 0 1 1200,375 Z" fill="${p.p2}"/>` +
    `<circle cx="1110" cy="120" r="70" fill="none" stroke="${p.p3}" stroke-width="22"/>` +
    `<path d="M120,675 A90,90 0 0 1 300,675 Z" fill="${p.p3}"/>` +
    `<circle cx="420" cy="90" r="12" fill="${p.p2}"/>`,
  // 6. contour line art
  (p) =>
    `<rect width="1200" height="675" fill="${p.bg}"/>` +
    `<g fill="none" stroke-linecap="round">` +
    `<path d="M-40,520 C240,400 420,640 700,540 C940,455 1080,560 1250,480" stroke="${p.p1}" stroke-width="5"/>` +
    `<path d="M-40,560 C250,445 430,675 710,575 C950,492 1090,595 1250,520" stroke="${p.p1}" stroke-width="3" stroke-opacity="0.55"/>` +
    `<path d="M-40,600 C260,490 440,710 720,612 C960,530 1100,630 1250,560" stroke="${p.p2}" stroke-width="3" stroke-opacity="0.7"/>` +
    `<path d="M-40,130 C300,230 560,40 900,130 C1060,172 1170,140 1250,160" stroke="${p.p2}" stroke-width="4"/>` +
    `<path d="M-40,90 C310,190 570,0 910,92 C1070,135 1180,105 1250,122" stroke="${p.p3}" stroke-width="3" stroke-opacity="0.8"/>` +
    `</g>` +
    `<circle cx="1080" cy="320" r="26" fill="${p.p3}"/>`,
  // 7. diagonal split with overlap circle
  (p) =>
    `<rect width="1200" height="675" fill="${p.bg}"/>` +
    `<path d="M0,675 L0,250 C260,330 420,560 640,675 Z" fill="${p.p1}"/>` +
    `<path d="M0,675 L0,420 C200,480 330,600 470,675 Z" fill="${p.p3}" fill-opacity="0.85"/>` +
    `<circle cx="1060" cy="160" r="120" fill="${p.p2}" fill-opacity="0.9"/>` +
    `<circle cx="950" cy="270" r="38" fill="${p.p1}" fill-opacity="0.65"/>` +
    `<circle cx="160" cy="120" r="10" fill="${p.p1}"/>` +
    `<circle cx="240" cy="80" r="6" fill="${p.p2}"/>`,
  // 8. bold ring offset right
  (p) =>
    `<defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${p.bg}"/><stop offset="100%" stop-color="${p.p2}" stop-opacity="0.3"/></linearGradient></defs>` +
    `<rect width="1200" height="675" fill="url(#rg)"/>` +
    `<circle cx="1230" cy="340" r="270" fill="none" stroke="${p.p1}" stroke-width="80"/>` +
    `<circle cx="1230" cy="340" r="110" fill="${p.p3}"/>` +
    `<circle cx="120" cy="560" r="60" fill="${p.p2}" fill-opacity="0.8"/>` +
    `<circle cx="220" cy="500" r="18" fill="${p.p1}" fill-opacity="0.7"/>`,
  // 9. torn-edge side panel
  (p) =>
    `<rect width="1200" height="675" fill="${p.bg}"/>` +
    `<path d="M0,0 L210,0 C160,110 250,200 195,320 C140,440 240,540 185,675 L0,675 Z" fill="${p.p1}"/>` +
    `<path d="M210,0 C160,110 250,200 195,320 C140,440 240,540 185,675" fill="none" stroke="${p.p3}" stroke-width="7" stroke-opacity="0.85"/>` +
    `<circle cx="1090" cy="560" r="80" fill="${p.p2}" fill-opacity="0.85"/>` +
    `<circle cx="1130" cy="120" r="26" fill="${p.p3}"/>`,
  // 10. terrazzo bits
  (p) =>
    `<rect width="1200" height="675" fill="${p.bg}"/>` +
    `<g fill="${p.p1}">` +
    `<path d="M110,90 q40,-34 70,6 q28,38 -18,56 q-50,18 -52,-62 Z" opacity="0.9"/>` +
    `<path d="M1020,540 q44,-26 68,12 q22,36 -22,52 q-48,16 -46,-64 Z" opacity="0.85"/>` +
    `</g>` +
    `<g fill="${p.p2}">` +
    `<circle cx="1100" cy="110" r="34"/>` +
    `<circle cx="180" cy="580" r="28"/>` +
    `<path d="M620,60 l44,18 -30,36 Z"/>` +
    `</g>` +
    `<g fill="${p.p3}">` +
    `<path d="M340,620 l36,-14 8,34 -36,10 Z"/>` +
    `<path d="M920,90 l30,12 -20,26 Z"/>` +
    `<circle cx="70" cy="320" r="12"/>` +
    `<circle cx="1140" cy="380" r="10"/>` +
    `</g>`,
];

for (const build of abstractBuilders) {
  for (const palette of ABSTRACT_PALETTES) {
    const url = svgToDataUri(build(palette));
    PRESET_WALLPAPERS.push({ url, thumbnail: url, category: 'Abstract' });
  }
}
