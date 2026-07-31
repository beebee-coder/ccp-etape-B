import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        "alarm-danger": {
          DEFAULT: "var(--alarm-danger)",
          foreground: "var(--alarm-danger-foreground)",
          bg: "var(--alarm-danger-bg)",
        },
        "alarm-warning": {
          DEFAULT: "var(--alarm-warning)",
          foreground: "var(--alarm-warning-foreground)",
          bg: "var(--alarm-warning-bg)",
        },
        "alarm-info": {
          DEFAULT: "var(--alarm-info)",
          foreground: "var(--alarm-info-foreground)",
          bg: "var(--alarm-info-bg)",
        },
        "alarm-security": {
          DEFAULT: "var(--alarm-security)",
          foreground: "var(--alarm-security-foreground)",
          bg: "var(--alarm-security-bg)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px) rotate(0deg)" },
          "33%": { transform: "translateY(-8px) rotate(0.5deg)" },
          "66%": { transform: "translateY(-4px) rotate(-0.5deg)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "glow-pulse": {
          "0%, 100%": {
            boxShadow: "0 0 10px rgba(99, 102, 241, 0.3), 0 0 20px rgba(99, 102, 241, 0.1)",
          },
          "50%": {
            boxShadow: "0 0 25px rgba(99, 102, 241, 0.6), 0 0 50px rgba(99, 102, 241, 0.25)",
          },
        },
        "slide-in-3d": {
          from: {
            opacity: "0",
            transform: "perspective(600px) translateZ(-60px) translateY(20px)",
          },
          to: {
            opacity: "1",
            transform: "perspective(600px) translateZ(0) translateY(0)",
          },
        },
        "message-in-right": {
          from: {
            opacity: "0",
            transform: "perspective(600px) translateX(30px) translateZ(-20px) scale(0.9)",
          },
          to: {
            opacity: "1",
            transform: "perspective(600px) translateX(0) translateZ(0) scale(1)",
          },
        },
        "message-in-left": {
          from: {
            opacity: "0",
            transform: "perspective(600px) translateX(-30px) translateZ(-20px) scale(0.9)",
          },
          to: {
            opacity: "1",
            transform: "perspective(600px) translateX(0) translateZ(0) scale(1)",
          },
        },
        "typing-bounce": {
          "0%, 60%, 100%": { transform: "translateY(0)" },
          "30%": { transform: "translateY(-6px)" },
        },
        "border-spin": {
          to: { transform: "rotate(360deg)" },
        },
        tilt: {
          "0%, 50%, 100%": { transform: "rotate(0deg)" },
          "25%": { transform: "rotate(0.5deg)" },
          "75%": { transform: "rotate(-0.5deg)" },
        },
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        "float-delayed": "float 6s ease-in-out 2s infinite",
        shimmer: "shimmer 1.8s linear infinite",
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
        "slide-in-3d": "slide-in-3d 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        "message-in-right": "message-in-right 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        "message-in-left": "message-in-left 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        "typing-bounce": "typing-bounce 1.2s ease-in-out infinite",
        "border-spin": "border-spin 4s linear infinite",
        tilt: "tilt 10s ease-in-out infinite",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        "gradient-mesh":
          "linear-gradient(to right, rgba(99,102,241,0.15) 1px, transparent 1px), linear-gradient(to bottom, rgba(99,102,241,0.15) 1px, transparent 1px)",
      },
      boxShadow: {
        "3d-sm": "0 4px 12px rgba(0,0,0,0.15), 0 2px 4px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.1)",
        "3d": "0 8px 25px rgba(0,0,0,0.2), 0 4px 10px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.12)",
        "3d-lg": "0 20px 50px rgba(0,0,0,0.25), 0 8px 20px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.1)",
        "inner-glow": "inset 0 1px 0 rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.1)",
        "primary-glow": "0 0 20px rgba(99, 102, 241, 0.4), 0 4px 12px rgba(99, 102, 241, 0.2)",
      },
    },
  },
  plugins: [],
};
export default config;
