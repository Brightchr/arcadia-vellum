import type { Metadata } from "next";
import {
  IM_Fell_English,
  Caveat,
  UnifrakturMaguntia,
  Cinzel,
  Cinzel_Decorative,
  Cormorant_Garamond,
  EB_Garamond,
  Pirata_One,
} from "next/font/google";
import "./globals.css";

const fell = IM_Fell_English({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-fell",
});

const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-caveat",
});

const unifraktur = UnifrakturMaguntia({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-unifraktur",
});

const cinzel = Cinzel({
  subsets: ["latin"],
  variable: "--font-cinzel",
});

const cinzelDecorative = Cinzel_Decorative({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-cinzel-deco",
});

const cormorant = Cormorant_Garamond({
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-cormorant",
});

const garamond = EB_Garamond({
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-garamond",
});

const pirata = Pirata_One({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-pirata",
});

export const metadata: Metadata = {
  title: "Arcadia Vellum — your adventure journal as an ancient tome",
  description:
    "Turn your TTRPG campaign journal (Google Doc or upload) into a beautiful page-flipping ancient tome you can share with your table.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${fell.variable} ${caveat.variable} ${unifraktur.variable} ${cinzel.variable} ${cinzelDecorative.variable} ${cormorant.variable} ${garamond.variable} ${pirata.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
