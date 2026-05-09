export interface Wallpaper {
  url: string;
  thumbnail: string;
  category: 'Abstract' | 'Pastel';
}

export const PRESET_WALLPAPERS: Wallpaper[] = [
  // --- PASTEL (Dreamy, Aesthetic, Iridescent) ---
  { url: 'https://images.unsplash.com/photo-1557682250-33bd709cbe85?auto=format&fit=crop&q=80&w=1200', thumbnail: 'https://images.unsplash.com/photo-1557682250-33bd709cbe85?auto=format&fit=crop&q=80&w=150', category: 'Pastel' },
  { url: 'https://images.unsplash.com/photo-1519751138087-5bf79df62d5b?auto=format&fit=crop&q=80&w=1200', thumbnail: 'https://images.unsplash.com/photo-1519751138087-5bf79df62d5b?auto=format&fit=crop&q=80&w=150', category: 'Pastel' },
  { url: 'https://images.unsplash.com/photo-1550684848-811c75c5e8f4?auto=format&fit=crop&q=80&w=1200', thumbnail: 'https://images.unsplash.com/photo-1550684848-811c75c5e8f4?auto=format&fit=crop&q=80&w=150', category: 'Pastel' },
  { url: 'https://images.unsplash.com/photo-1515343483479-44533da6713c?auto=format&fit=crop&q=80&w=1200', thumbnail: 'https://images.unsplash.com/photo-1515343483479-44533da6713c?auto=format&fit=crop&q=80&w=150', category: 'Pastel' },
  { url: 'https://images.unsplash.com/photo-1528459801416-a9e53bbf4e17?auto=format&fit=crop&q=80&w=1200', thumbnail: 'https://images.unsplash.com/photo-1528459801416-a9e53bbf4e17?auto=format&fit=crop&q=80&w=150', category: 'Pastel' },
  { url: 'https://images.unsplash.com/photo-1536431311719-398b6704d4cc?auto=format&fit=crop&q=80&w=1200', thumbnail: 'https://images.unsplash.com/photo-1536431311719-398b6704d4cc?auto=format&fit=crop&q=80&w=150', category: 'Pastel' },
  { url: 'https://images.unsplash.com/photo-1487147264018-f937fba0c817?auto=format&fit=crop&q=80&w=1200', thumbnail: 'https://images.unsplash.com/photo-1487147264018-f937fba0c817?auto=format&fit=crop&q=80&w=150', category: 'Pastel' },
  { url: 'https://images.unsplash.com/photo-1558478551-1a378f63ad28?auto=format&fit=crop&q=80&w=1200', thumbnail: 'https://images.unsplash.com/photo-1558478551-1a378f63ad28?auto=format&fit=crop&q=80&w=150', category: 'Pastel' },
  { url: 'https://images.unsplash.com/photo-1512295767273-ac109ac3acfa?auto=format&fit=crop&q=80&w=1200', thumbnail: 'https://images.unsplash.com/photo-1512295767273-ac109ac3acfa?auto=format&fit=crop&q=80&w=150', category: 'Pastel' },
  { url: 'https://images.unsplash.com/photo-1541450805268-4822a3a774ea?auto=format&fit=crop&q=80&w=1200', thumbnail: 'https://images.unsplash.com/photo-1541450805268-4822a3a774ea?auto=format&fit=crop&q=80&w=150', category: 'Pastel' },
  { url: 'https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&q=80&w=1200', thumbnail: 'https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&q=80&w=150', category: 'Pastel' },
  { url: 'https://images.unsplash.com/photo-1554034483-04fda0d3507b?auto=format&fit=crop&q=80&w=1200', thumbnail: 'https://images.unsplash.com/photo-1554034483-04fda0d3507b?auto=format&fit=crop&q=80&w=150', category: 'Pastel' },
  
  // --- ABSTRACT ---
  { url: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&q=80&w=1200', thumbnail: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&q=80&w=150', category: 'Abstract' },
  { url: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&q=80&w=1200', thumbnail: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&q=80&w=150', category: 'Abstract' },
  { url: 'https://images.unsplash.com/photo-1550684848-Fac1c5b4e853?auto=format&fit=crop&q=80&w=1200', thumbnail: 'https://images.unsplash.com/photo-1550684848-Fac1c5b4e853?auto=format&fit=crop&q=80&w=150', category: 'Abstract' },
  { url: 'https://images.unsplash.com/photo-1550684847-75bdda21cc95?auto=format&fit=crop&q=80&w=1200', thumbnail: 'https://images.unsplash.com/photo-1550684847-75bdda21cc95?auto=format&fit=crop&q=80&w=150', category: 'Abstract' },
  { url: 'https://images.unsplash.com/photo-1563456885-30588661730f?auto=format&fit=crop&q=80&w=1200', thumbnail: 'https://images.unsplash.com/photo-1563456885-30588661730f?auto=format&fit=crop&q=80&w=150', category: 'Abstract' },
  { url: 'https://images.unsplash.com/photo-1557683311-eac922347aa1?auto=format&fit=crop&q=80&w=1200', thumbnail: 'https://images.unsplash.com/photo-1557683311-eac922347aa1?auto=format&fit=crop&q=80&w=150', category: 'Abstract' },
  { url: 'https://images.unsplash.com/photo-1557683304-673a23048d34?auto=format&fit=crop&q=80&w=1200', thumbnail: 'https://images.unsplash.com/photo-1557683304-673a23048d34?auto=format&fit=crop&q=80&w=150', category: 'Abstract' },
  { url: 'https://images.unsplash.com/photo-1567095761054-7a02e69e5c43?auto=format&fit=crop&q=80&w=1200', thumbnail: 'https://images.unsplash.com/photo-1567095761054-7a02e69e5c43?auto=format&fit=crop&q=80&w=150', category: 'Abstract' },
  { url: 'https://images.unsplash.com/photo-1574169208507-84376144848b?auto=format&fit=crop&q=80&w=1200', thumbnail: 'https://images.unsplash.com/photo-1574169208507-84376144848b?auto=format&fit=crop&q=80&w=150', category: 'Abstract' },
  { url: 'https://images.unsplash.com/photo-1542831371-29b0f74f9713?auto=format&fit=crop&q=80&w=1200', thumbnail: 'https://images.unsplash.com/photo-1542831371-29b0f74f9713?auto=format&fit=crop&q=80&w=150', category: 'Abstract' },
];
