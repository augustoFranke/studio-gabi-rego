import localFont from "next/font/local";

const appSansFont = localFont({
  src: [
    {
      path: "../../assets/fonts/sans/geist-latin.woff2",
      weight: "100 900",
      style: "normal",
    },
    {
      path: "../../assets/fonts/sans/geist-latin-ext.woff2",
      weight: "100 900",
      style: "normal",
    },
  ],
  variable: "--font-app-sans",
  display: "swap",
  fallback: [
    "system-ui",
    "Segoe UI",
    "Roboto",
    "Helvetica Neue",
    "Arial",
    "sans-serif",
  ],
});

const appMonoFont = localFont({
  src: [
    {
      path: "../../assets/fonts/mono/geist-mono-latin.woff2",
      weight: "100 900",
      style: "normal",
    },
    {
      path: "../../assets/fonts/mono/geist-mono-latin-ext.woff2",
      weight: "100 900",
      style: "normal",
    },
  ],
  variable: "--font-app-mono",
  display: "swap",
  fallback: [
    "ui-monospace",
    "SFMono-Regular",
    "SF Mono",
    "Menlo",
    "Consolas",
    "Liberation Mono",
    "monospace",
  ],
});

export const appFontsClassName = `${appSansFont.variable} ${appMonoFont.variable}`;
