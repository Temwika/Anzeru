import type { MetadataRoute } from "next";

/** Lets staff install the app to a phone home screen or desktop dock, with shortcuts to the daily jobs. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Chilimbitso Money Lending",
    short_name: "Chilimbitso",
    description: "Loans, borrowers, repayments and arrears for microfinance teams — in the office or in the field.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#1c100b",
    theme_color: "#1c100b",
    categories: ["finance", "business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "New loan", url: "/applications/new", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Due today", url: "/loans/due-today", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Arrears", url: "/loans/arrears", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Borrowers", url: "/customers", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
