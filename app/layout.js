// app/layout.js
// Root layout for OrderFlow Lab. Wraps every route in the App Router.
// Keep this minimal: global styles, metadata, and shared chrome (e.g. nav/footer)
// can be added here later as the dashboard grows.

import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Type system: Space Grotesk for headings (a little technical, a little
// friendly), Inter for body copy (highly legible for a beginner audience),
// JetBrains Mono for numeric figures (fixed-width digits make scores and
// prices easier to scan and compare at a glance).
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display-family",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body-family",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-figure-family",
  display: "swap",
});

export const metadata = {
  title: "OrderFlow Lab",
  description: "Order flow imbalance signal dashboard (skeleton project).",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-screen bg-paper font-body text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
