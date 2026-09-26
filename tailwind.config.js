/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // shadcn/ui semantic names (src/components/ui), mapped onto the nt tokens.
        // Deliberately NOT included from the shadcn setup, because they would
        // change the existing UI: the tailwindcss-animate plugin (it would
        // activate dormant `animate-in fade-in` classes across the app), the
        // radius override (changes rounded-sm) and the global border colour.
        // Add them when the app itself moves onto these components.
        'background': 'oklch(var(--nt-bg) / <alpha-value>)',
        'foreground': 'oklch(var(--nt-ink) / <alpha-value>)',
        'card': 'oklch(var(--nt-surface) / <alpha-value>)',
        'card-foreground': 'oklch(var(--nt-ink) / <alpha-value>)',
        'popover': 'oklch(var(--nt-surface) / <alpha-value>)',
        'popover-foreground': 'oklch(var(--nt-ink) / <alpha-value>)',
        'primary': 'oklch(var(--nt-accent) / <alpha-value>)',
        'primary-foreground': 'oklch(var(--nt-accent-ink) / <alpha-value>)',
        'secondary': 'oklch(var(--nt-raised) / <alpha-value>)',
        'secondary-foreground': 'oklch(var(--nt-ink) / <alpha-value>)',
        'muted': 'oklch(var(--nt-raised) / <alpha-value>)',
        'muted-foreground': 'oklch(var(--nt-ink-3) / <alpha-value>)',
        'accent': 'oklch(var(--nt-raised) / <alpha-value>)',
        'accent-foreground': 'oklch(var(--nt-ink) / <alpha-value>)',
        'destructive': 'oklch(var(--nt-danger) / <alpha-value>)',
        'destructive-foreground': 'oklch(var(--nt-bg) / <alpha-value>)',
        'border': 'oklch(var(--nt-line) / <alpha-value>)',
        'input': 'oklch(var(--nt-line-strong) / <alpha-value>)',
        'ring': 'oklch(var(--nt-focus) / <alpha-value>)',
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

