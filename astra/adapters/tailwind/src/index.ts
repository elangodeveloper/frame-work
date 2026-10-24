export const TAILWIND_CONFIG_ENTRY = {
  content: ['./src/**/*.{html,ts}', './examples/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        jarvis: '#10b981'
      }
    }
  }
};

export function tailwindJarvisLayer(): string {
  return '@layer primeng, tailwind;';
}
