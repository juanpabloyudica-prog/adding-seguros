import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // DM Mono for data/numbers, DM Sans for UI text
        sans:  ['DM Sans', 'system-ui', 'sans-serif'],
        mono:  ['DM Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        // Brand
        brand: {
          DEFAULT: '#1B4FD8',  // deep blue — trust, clarity
          light:   '#EEF3FF',
          dark:    '#0F2E8A',
        },
        // Neutral scale — cool-tinted grays
        surface: {
          DEFAULT: '#FFFFFF',
          subtle:  '#F7F8FA',
          muted:   '#EEF0F4',
          border:  '#DDE1E9',
          'border-strong': '#B8BFCC',
        },
        ink: {
          DEFAULT: '#111827',
          secondary: '#4B5563',
          tertiary:  '#9CA3AF',
          disabled:  '#D1D5DB',
        },
        // Semantic
        success: { DEFAULT: '#059669', bg: '#ECFDF5', text: '#065F46' },
        warning: { DEFAULT: '#D97706', bg: '#FFFBEB', text: '#92400E' },
        danger:  { DEFAULT: '#DC2626', bg: '#FEF2F2', text: '#991B1B' },
        info:    { DEFAULT: '#2563EB', bg: '#EFF6FF', text: '#1E40AF' },
        // Policy status
        status: {
          active:    { DEFAULT: '#059669', bg: '#ECFDF5' },
          expiring:  { DEFAULT: '#D97706', bg: '#FFFBEB' },
          expired:   { DEFAULT: '#6B7280', bg: '#F3F4F6' },
          cancelled: { DEFAULT: '#DC2626', bg: '#FEF2F2' },
          draft:     { DEFAULT: '#2563EB', bg: '#EFF6FF' },
        },
      },
      fontSize: {
        '2xs': ['0.65rem', { lineHeight: '1rem' }],
      },
      spacing: {
        sidebar: '240px',
        'sidebar-collapsed': '64px',
      },
      boxShadow: {
        'card':  '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.04)',
        'card-md': '0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.05)',
        'dropdown': '0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.05)',
      },
      borderRadius: {
        card: '10px',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.18s ease-out',
        shimmer:   'shimmer 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}

export default config
