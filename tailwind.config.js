/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        nt: {
          'bg': 'oklch(var(--nt-bg) / <alpha-value>)',
          'surface': 'oklch(var(--nt-surface) / <alpha-value>)',
          'raised': 'oklch(var(--nt-raised) / <alpha-value>)',
          'line': 'oklch(var(--nt-line) / <alpha-value>)',
          'line-strong': 'oklch(var(--nt-line-strong) / <alpha-value>)',
          'ink': 'oklch(var(--nt-ink) / <alpha-value>)',
          'ink-2': 'oklch(var(--nt-ink-2) / <alpha-value>)',
          'ink-3': 'oklch(var(--nt-ink-3) / <alpha-value>)',
          'accent': 'oklch(var(--nt-accent) / <alpha-value>)',
          'accent-ink': 'oklch(var(--nt-accent-ink) / <alpha-value>)',
          'focus': 'oklch(var(--nt-focus) / <alpha-value>)',
          'danger': 'oklch(var(--nt-danger) / <alpha-value>)',
          'success': 'oklch(var(--nt-success) / <alpha-value>)',
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}

