import type { Config } from 'tailwindcss';

// The artifact ships most of its own styling via inline <style> blocks; Tailwind
// here just needs to scan the utility classes used across the app + components.
const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: { extend: {} },
  plugins: [],
};

export default config;
