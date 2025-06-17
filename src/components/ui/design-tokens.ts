
// Freshness Checker Design System
// This file documents all available design tokens to ensure consistency

export const designTokens = {
  // Brand Colors
  colors: {
    fresh: {
      50: 'hsl(var(--fresh-50))',
      100: 'hsl(var(--fresh-100))',
      200: 'hsl(var(--fresh-200))',
      300: 'hsl(var(--fresh-300))',
      400: 'hsl(var(--fresh-400))',
      500: 'hsl(var(--fresh-500))', // Primary purple
      600: 'hsl(var(--fresh-600))',
      700: 'hsl(var(--fresh-700))',
      800: 'hsl(var(--fresh-800))',
      900: 'hsl(var(--fresh-900))',
    },
    quality: {
      50: 'hsl(var(--quality-50))',
      100: 'hsl(var(--quality-100))',
      200: 'hsl(var(--quality-200))',
      300: 'hsl(var(--quality-300))',
      400: 'hsl(var(--quality-400))',
      500: 'hsl(var(--quality-500))', // Fresh green
      600: 'hsl(var(--quality-600))',
      700: 'hsl(var(--quality-700))',
      800: 'hsl(var(--quality-800))',
      900: 'hsl(var(--quality-900))',
    },
    speed: {
      50: 'hsl(var(--speed-50))',
      100: 'hsl(var(--speed-100))',
      200: 'hsl(var(--speed-200))',
      300: 'hsl(var(--speed-300))',
      400: 'hsl(var(--speed-400))',
      500: 'hsl(var(--speed-500))', // Speed orange
      600: 'hsl(var(--speed-600))',
      700: 'hsl(var(--speed-700))',
      800: 'hsl(var(--speed-800))',
      900: 'hsl(var(--speed-900))',
    }
  },

  // Available CSS Classes
  gradients: {
    primary: 'bg-gradient-primary', // Purple gradient
    fresh: 'bg-gradient-fresh',     // Green gradient
    text: 'text-gradient'           // Text gradient
  },

  shadows: {
    fresh: 'shadow-fresh',          // Standard fresh shadow
    freshLg: 'shadow-fresh-lg',     // Large fresh shadow
    hoverFresh: 'hover:shadow-fresh' // Hover fresh shadow
  },

  animations: {
    fadeInUp: 'animate-fade-in-up',
    slideInRight: 'animate-slide-in-right',
    pulseSubtle: 'animate-pulse-subtle',
    delay100: 'animate-delay-100',
    delay200: 'animate-delay-200'
  },

  typography: {
    headingPrimary: 'text-heading-primary',
    headingSecondary: 'text-heading-secondary',
    headingTertiary: 'text-heading-tertiary',
    bodyPrimary: 'text-body-primary',
    bodySecondary: 'text-body-secondary',
    bodyMuted: 'text-body-muted',
    caption: 'text-caption',
    micro: 'text-micro'
  },

  borders: {
    subtle: 'border-subtle',
    medium: 'border-medium',
    strong: 'border-strong'
  }
} as const;

// Type definitions for design tokens
export type FreshColor = keyof typeof designTokens.colors.fresh;
export type QualityColor = keyof typeof designTokens.colors.quality;
export type SpeedColor = keyof typeof designTokens.colors.speed;
export type Gradient = keyof typeof designTokens.gradients;
export type Shadow = keyof typeof designTokens.shadows;
export type Animation = keyof typeof designTokens.animations;
export type Typography = keyof typeof designTokens.typography;
export type Border = keyof typeof designTokens.borders;
