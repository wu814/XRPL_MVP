import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
    "./src/app/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}",
    "./src/utils/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        color1: "#1C1729", // Darkest
        color2: "#241F34", // 2nd darkest (div components)
        color3: "#2F2A45", // 3rd darkest
        color4: "#3B3456", // 4th darkest (currency icons bg)
        color5: "#58536A", // 5th darkest (modal)
        color6: "#5D587A", // 6th darkest (panel)
        pulse: "#514E78", // Animate pulse
        border: "#BDB9C9", // Border color
        mutedText: "#A3A4A7",
        primary: "#8EDFE2", // Primary button
        cancel: "#E1A5FA", // Cancel
      },
    },
  },
  plugins: [],
};

export default config;
