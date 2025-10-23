/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: 'var(--card)',
        'card-foreground': 'var(--card-foreground)',
        popover: 'var(--popover)',
        'popover-foreground': 'var(--popover-foreground)',
        primary: 'var(--primary)',
        'primary-foreground': 'var(--primary-foreground)',
        secondary: 'var(--secondary)',
        'secondary-foreground': 'var(--secondary-foreground)',
        muted: 'var(--muted)',
        'muted-foreground': 'var(--muted-foreground)',
        accent: 'var(--accent)',
        'accent-foreground': 'var(--accent-foreground)',
        destructive: 'var(--destructive)',
        'destructive-foreground': 'var(--destructive-foreground)',
        success: 'var(--success)',
        'success-foreground': 'var(--success-foreground)',
        error: 'var(--error)',
        'error-foreground': 'var(--error-foreground)',
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        neutral: {
          950: '#19191C',
        },
        figma: {
          heading: '#19191C',
          paragraph: '#717182',
          primary: '#030213',
          input: '#f3f3f5',
          tableHeader: 'rgba(236,236,240,0.3)',
          border: 'rgba(0,0,0,0.1)',
          badgeActiveBg: '#dcfce7', // Tailwind green-100
          badgeActiveText: '#166534', // Tailwind green-800
          badgeInactiveBg: '#fef2f2', // Tailwind red-50
          badgeInactiveText: '#dc2626', // Tailwind red-600
        },
      },
      fontFamily: {
        sans: ["Arial", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      fontSize: {
        base: '14px',
        lg: '24px',
        sm: '12px',
      },
      borderRadius: {
        md: '8px',
        lg: '10px',
      },
      boxShadow: {
        figma: '0px 1px 3px 0px rgba(0,0,0,0.1),0px 1px 2px -1px rgba(0,0,0,0.1)',
      },
    },
  },
  plugins: [],
}