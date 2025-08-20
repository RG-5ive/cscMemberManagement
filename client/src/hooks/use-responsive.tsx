import { useState, useEffect } from 'react';

// Breakpoint values matching Tailwind defaults
const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

type Breakpoint = keyof typeof BREAKPOINTS;

interface ResponsiveValues {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isLargeDesktop: boolean;
  screenWidth: number;
  isAtLeast: (breakpoint: Breakpoint) => boolean;
  isBelow: (breakpoint: Breakpoint) => boolean;
  getResponsiveValue: <T>(values: { 
    default: T; 
    sm?: T; 
    md?: T; 
    lg?: T; 
    xl?: T; 
    '2xl'?: T; 
  }) => T;
}

export function useResponsive(): ResponsiveValues {
  const [screenWidth, setScreenWidth] = useState<number>(0);

  useEffect(() => {
    const updateScreenWidth = () => {
      setScreenWidth(window.innerWidth);
    };

    // Set initial width
    updateScreenWidth();

    // Listen for window resize
    window.addEventListener('resize', updateScreenWidth);
    
    return () => window.removeEventListener('resize', updateScreenWidth);
  }, []);

  const isAtLeast = (breakpoint: Breakpoint): boolean => {
    return screenWidth >= BREAKPOINTS[breakpoint];
  };

  const isBelow = (breakpoint: Breakpoint): boolean => {
    return screenWidth < BREAKPOINTS[breakpoint];
  };

  const getResponsiveValue = <T,>(values: { 
    default: T; 
    sm?: T; 
    md?: T; 
    lg?: T; 
    xl?: T; 
    '2xl'?: T; 
  }): T => {
    if (screenWidth >= BREAKPOINTS['2xl'] && values['2xl'] !== undefined) return values['2xl'];
    if (screenWidth >= BREAKPOINTS.xl && values.xl !== undefined) return values.xl;
    if (screenWidth >= BREAKPOINTS.lg && values.lg !== undefined) return values.lg;
    if (screenWidth >= BREAKPOINTS.md && values.md !== undefined) return values.md;
    if (screenWidth >= BREAKPOINTS.sm && values.sm !== undefined) return values.sm;
    return values.default;
  };

  return {
    isMobile: isBelow('md'),
    isTablet: isAtLeast('md') && isBelow('lg'),
    isDesktop: isAtLeast('lg'),
    isLargeDesktop: isAtLeast('xl'),
    screenWidth,
    isAtLeast,
    isBelow,
    getResponsiveValue,
  };
}

// Common responsive layout components
export const ResponsiveContainer = ({ 
  children, 
  className = "" 
}: { 
  children: React.ReactNode; 
  className?: string; 
}) => (
  <div className={`container mx-auto py-3 sm:py-6 px-2 sm:px-4 lg:px-6 ${className}`}>
    {children}
  </div>
);

export const ResponsiveGrid = ({ 
  children, 
  cols = { default: 1, sm: 2, lg: 3 },
  gap = "4",
  className = "" 
}: { 
  children: React.ReactNode; 
  cols?: { default: number; sm?: number; md?: number; lg?: number; xl?: number; };
  gap?: string;
  className?: string;
}) => {
  const gridCols = `grid-cols-${cols.default}`;
  const smCols = cols.sm ? `sm:grid-cols-${cols.sm}` : '';
  const mdCols = cols.md ? `md:grid-cols-${cols.md}` : '';
  const lgCols = cols.lg ? `lg:grid-cols-${cols.lg}` : '';
  const xlCols = cols.xl ? `xl:grid-cols-${cols.xl}` : '';
  
  return (
    <div className={`grid ${gridCols} ${smCols} ${mdCols} ${lgCols} ${xlCols} gap-${gap} ${className}`}>
      {children}
    </div>
  );
};

export const ResponsiveText = ({ 
  children, 
  size = { default: "base", lg: "lg" },
  weight = "normal",
  className = "" 
}: { 
  children: React.ReactNode; 
  size?: { default: string; sm?: string; md?: string; lg?: string; xl?: string; };
  weight?: string;
  className?: string;
}) => {
  const baseSize = `text-${size.default}`;
  const smSize = size.sm ? `sm:text-${size.sm}` : '';
  const mdSize = size.md ? `md:text-${size.md}` : '';
  const lgSize = size.lg ? `lg:text-${size.lg}` : '';
  const xlSize = size.xl ? `xl:text-${size.xl}` : '';
  const fontWeight = `font-${weight}`;
  
  return (
    <span className={`${baseSize} ${smSize} ${mdSize} ${lgSize} ${xlSize} ${fontWeight} ${className}`}>
      {children}
    </span>
  );
};