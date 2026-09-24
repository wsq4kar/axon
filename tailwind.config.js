/** Tailwind поверх токенов Mono: цвета и радиусы — CSS-переменные из src/styles/tokens.css */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)', sunken: 'var(--bg-sunken)', panel: 'var(--panel)',
        surface: { DEFAULT: 'var(--surface)', hover: 'var(--surface-hover)', active: 'var(--surface-active)', raised: 'var(--surface-raised)' },
        fg: { DEFAULT: 'var(--text)', 2: 'var(--text-2)', 3: 'var(--text-3)', 4: 'var(--text-4)' },
        line: { DEFAULT: 'var(--border)', hover: 'var(--border-hover)', strong: 'var(--border-strong)' },
        inverse: { DEFAULT: 'var(--inverse)', fg: 'var(--inverse-text)' },
      },
      fontFamily: { sans: 'var(--font-sans)', mono: 'var(--font-mono)' },
      borderRadius: { sm: 'var(--radius-sm)', md: 'var(--radius-md)', lg: 'var(--radius-lg)', xl: 'var(--radius-xl)', '2xl': 'var(--radius-2xl)' },
      transitionTimingFunction: { out: 'var(--ease-out)', in: 'var(--ease-in)', 'in-out': 'var(--ease-in-out)', spring: 'var(--spring)' },
    },
  },
  plugins: [],
};
