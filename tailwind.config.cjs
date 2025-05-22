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
        color1: "#1C2033", // Darkest
        color2: "#242639", // 2nd darkest (div components)
        color3: "#2C2E44", // 3rd darkest
        color4: "#33354D", // 4th darkest (currency icons bg)
        modal: "#3F4359", // 5th darkest (modal)
        pulse: "#4B4F68", // Animate pulse
        border: "#8E909D", // Border color
        mutedText: "#8E909D",
        primary: "#D8B6FF", // Primary button
        cancel: "#FAFDB8", // Cancel
      },
    },
  },
  plugins: [],
};
