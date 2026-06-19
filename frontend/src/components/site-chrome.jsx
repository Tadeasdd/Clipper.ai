/* U2.1 — site chrome split into focused modules under ./chrome/. This file is now
   a barrel that re-exports every name, so every call site (App + the marketing
   pages) imports the same symbols unchanged. The components moved verbatim —
   no JSX or behavior changed. SiteShell still renders AmbientChrome + CommandPalette
   (it imports them directly from the sibling modules). */
export { AmbientChrome } from './chrome/AmbientChrome.jsx';
export { CommandPalette } from './chrome/CommandPalette.jsx';
export { SiteShell } from './chrome/SiteShell.jsx';
export { PageHero } from './chrome/PageHero.jsx';
export { LegalSection } from './chrome/LegalSection.jsx';
export { FAQ, FAQItem } from './chrome/FAQ.jsx';
export { CTABand } from './chrome/CTABand.jsx';
