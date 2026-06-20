// Vite injects import.meta.env at build time; declare it for the typecheck gate.
interface ImportMeta { readonly env: Record<string, string | undefined>; }
