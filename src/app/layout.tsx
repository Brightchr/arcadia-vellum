import type { Metadata } from "next";
import { cookies } from "next/headers";
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
  title: "Vellum — your adventure journal as an ancient tome",
  description:
    "Turn your TTRPG campaign journal (Google Doc or upload) into a beautiful page-flipping ancient tome you can share with your table.",
  manifest: "/manifest.webmanifest",
};

export const viewport = {
  themeColor: "#100d16",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The sidenav's collapsed state is mirrored into a cookie so the server
  // renders html[data-nav-collapsed] itself — hydration then matches exactly
  // and a hard refresh can't flash or animate the rail.
  const cookieJar = await cookies();
  const navCollapsed = cookieJar.get("av-nav-collapsed")?.value === "1";
  const railCollapsed = cookieJar.get("av-rail-collapsed")?.value === "1";
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-nav-collapsed={navCollapsed ? "1" : undefined}
      data-rail-collapsed={railCollapsed ? "1" : undefined}
    >
      <head>
        {/* Fallback for visitors whose preference predates the cookie: apply
            the localStorage state before first paint and backfill the cookie
            so the server gets it right from the next load on. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var v=localStorage.getItem("av-nav-collapsed");if(v==="1")document.documentElement.dataset.navCollapsed="1";else if(v==="0")delete document.documentElement.dataset.navCollapsed;if(v!==null)document.cookie="av-nav-collapsed="+(v==="1"?"1":"0")+";path=/;max-age=31536000;samesite=lax";var r=localStorage.getItem("av-rail-collapsed");if(r==="1")document.documentElement.dataset.railCollapsed="1";else if(r==="0")delete document.documentElement.dataset.railCollapsed;if(r!==null)document.cookie="av-rail-collapsed="+(r==="1"?"1":"0")+";path=/;max-age=31536000;samesite=lax"}catch(e){}`,
          }}
        />
      </head>
      <body
        className={`${fell.variable} ${caveat.variable} ${unifraktur.variable} ${cinzel.variable} ${cinzelDecorative.variable} ${cormorant.variable} ${garamond.variable} ${pirata.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
