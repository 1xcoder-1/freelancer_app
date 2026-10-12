/* ------------------------------------------------------------------
   Site config — one place for the public-facing identity of the
   marketing site. The footer and the contact page read from here,
   so swapping in live social profiles means editing this file only.
------------------------------------------------------------------ */

export const site = {
  name: "Freelance Book",
  url: process.env.NEXT_PUBLIC_APP_URL || "https://freelance-book.app",
  contactEmail: "1xcoder@proton.me",
  socials: {
    // TODO: point these at the real profiles once they exist —
    // the footer renders them verbatim with target="_blank".
    github: "https://github.com",
    x: "https://x.com",
    linkedin: "https://linkedin.com",
  },
} as const;
