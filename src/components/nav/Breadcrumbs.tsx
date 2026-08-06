"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRightIcon } from "@/components/icons";

interface Crumb {
  label: string;
  href: string;
}

/** "the-journal-of-eveline-veyr" → "The Journal Of Eveline Veyr" */
function prettify(slug: string): string {
  return decodeURIComponent(slug)
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** The trail from the homepage to the current path. */
function crumbsFor(path: string, signedIn: boolean): Crumb[] {
  const out: Crumb[] = [
    { label: "Home", href: signedIn ? "/dashboard" : "/" },
  ];
  const seg = path.split("/").filter(Boolean);
  const [a, b, c] = seg;
  switch (a) {
    case undefined:
      break;
    case "dashboard":
      if (b === "listen") out.push({ label: "Your Audiobooks", href: path });
      break;
    case "browse":
      out.push({ label: "Browse", href: "/browse" });
      break;
    case "saved":
      out.push({ label: "Saved", href: "/saved" });
      break;
    case "friends":
      out.push({ label: "Friends", href: "/friends" });
      break;
    case "settings":
      out.push({ label: "Settings", href: "/settings" });
      break;
    case "welcome":
      out.push({ label: "Welcome", href: "/welcome" });
      break;
    case "u":
      if (b) out.push({ label: `@${decodeURIComponent(b)}`, href: `/u/${b}` });
      break;
    case "book":
      out.push({ label: "Browse", href: "/browse" });
      if (b) out.push({ label: prettify(b), href: `/book/${b}` });
      break;
    case "series":
      out.push({ label: "Browse", href: "/browse" });
      if (b) out.push({ label: prettify(b), href: `/series/${b}` });
      break;
    case "s":
    case "j":
      if (b) out.push({ label: prettify(b), href: `/${a}/${b}` });
      if (c === "listen") out.push({ label: "Listen", href: path });
      break;
    case "playlists":
      if (b) out.push({ label: "Playlist", href: `/playlists/${b}` });
      if (c === "listen") out.push({ label: "Listen", href: path });
      break;
    case "journal":
      if (b === "new") {
        out.push({ label: "New Journal", href: "/journal/new" });
      } else if (c === "write") {
        out.push({ label: "Write", href: path });
      } else if (c === "settings") {
        out.push({ label: "Journal Settings", href: path });
      }
      break;
    default:
      seg.forEach((s, i) =>
        out.push({ label: prettify(s), href: `/${seg.slice(0, i + 1).join("/")}` })
      );
  }
  return out;
}

/**
 * Breadcrumb trail in the topbar: always anchored at Home, so any page —
 * Settings included — is one click from where it belongs. Hidden on the
 * homepage itself and on mobile (the topbar tabs cover navigation there).
 */
export function Breadcrumbs({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname() ?? "/";
  const crumbs = crumbsFor(pathname, signedIn);
  if (crumbs.length < 2) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className="hidden sm:flex items-center gap-1 min-w-0 shrink-0 max-w-[45%]"
    >
      {crumbs.map((crumb, i) => {
        const last = i === crumbs.length - 1;
        return (
          <span key={crumb.href} className="flex items-center gap-1 min-w-0">
            {i > 0 && (
              <ChevronRightIcon className="h-3 w-3 text-ink-dim/60 shrink-0" />
            )}
            {last ? (
              <span
                aria-current="page"
                className="text-sm font-heading text-ink truncate max-w-44"
              >
                {crumb.label}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="text-sm font-heading text-ink-dim hover:text-arcane-bright transition-colors truncate max-w-36"
              >
                {crumb.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
