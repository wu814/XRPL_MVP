/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
    "./app/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        color1: "#1C1729", // Darkest
        color2: "#241F34", // 2nd darkest (div components)
        color3: "#2F2A45", // 3rd darkest
        color4: "#3B3456", // 4th darkest (currency icons bg)
        color5: "#443E5D", // 5th darkest (modal)
        color6: "#4B4762", // 6th darkest (panel)
        pulse: "#514E78", // Animate pulse
        border: "#BDB9C9", // Border color
        mutedText: "#A3A4A7",
        primary: "#A4F2F5", // Primary button
        cancel: "#E1A5FA", // Cancel
      },
    },
  },
  plugins: [],
};
