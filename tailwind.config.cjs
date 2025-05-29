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
        color3: "#2A253D", // 3rd darkest
        color4: "#332E4A", // 4th darkest (currency icons bg)
        modal: "#403A58", // 5th darkest (modal)
        color5: "#4B4762", // 6th darkest (panel)
        pulse: "#514E78", // Animate pulse
        border: "#D1E8E2", // Border color
        mutedText: "#A3A4A7",
        primary: "#A4F2F5", // Primary button
        cancel: "#FAFAB2", // Cancel
      },
    },
  },
  plugins: [],
};