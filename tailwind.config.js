/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Primary Colors
        primary: {
          navy: "#2D3E50",
          teal: "#1ABC9C",
          DEFAULT: "#1ABC9C",
        },
        accent: {
          coral: "#FF6B6B",
          DEFAULT: "#FF6B6B",
        },
        // Background Colors
        background: {
          white: "#FAF9F7", // Warm off-white, easier on eyes
          cream: "#FAF9F7",
          softGray: "#F7F9FC",
          lightMist: "#EEF2F7",
          offWhite: "#F8F9FA",
        },
        // Text Colors
        text: {
          primary: "#1A1F2E",
          secondary: "#4A5568",
          tertiary: "#7F8C8D",
          onDark: "#FFFFFF",
        },
        // Border Colors
        border: {
          light: "#E2E8F0",
          medium: "#CBD5E0",
          dark: "#A0AEC0",
        },
        // Status Colors
        status: {
          success: "#10B981",
          "success-light": "#D1FAE5",
          "success-dark": "#047857",
          warning: "#F59E0B",
          "warning-light": "#FEF3C7",
          "warning-dark": "#B45309",
          error: "#EF4444",
          "error-light": "#FEE2E2",
          "error-dark": "#B91C1C",
          info: "#3B82F6",
          "info-light": "#DBEAFE",
          "info-dark": "#1D4ED8",
          // Post Status Colors
          open: "#6B7280",
          "open-bg": "#F3F4F6",
          acknowledged: "#3B82F6",
          "acknowledged-bg": "#DBEAFE",
          "in-progress": "#F59E0B",
          "in-progress-bg": "#FEF3C7",
          "under-review": "#8B5CF6",
          "under-review-bg": "#EDE9FE",
          resolved: "#10B981",
          "resolved-bg": "#D1FAE5",
          closed: "#64748B",
          "closed-bg": "#F1F5F9",
          rejected: "#EF4444",
          "rejected-bg": "#FEE2E2",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "gradient-primary": "linear-gradient(135deg, #2D3E50 0%, #1ABC9C 100%)",
        "gradient-soft": "linear-gradient(135deg, #EBF8FF 0%, #E0F2F1 100%)",
        "gradient-coral": "linear-gradient(135deg, #FF6B6B 0%, #FF8E8E 100%)",
      },
      boxShadow: {
        sm: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
        DEFAULT: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
        md: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
        lg: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
        xl: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
      },
    },
  },
  plugins: [],
};
