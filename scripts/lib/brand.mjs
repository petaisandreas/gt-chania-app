// HTML template rendering: {{token}} placeholders -> HTML-escaped client values.
// Used by the build and by server.js when serving source HTML in development.

export const escHtml = (v) => String(v).replace(/[&<>"'`]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "`": "&#96;" })[c]);

/** The exact list of tokens HTML files may use. */
export const TOKENS = {
  appName: (c) => c.appName,
  wordmarkMain: (c) => c.wordmark.main,
  wordmarkAccent: (c) => c.wordmark.accent,
  businessName: (c) => c.businessName,
  ownerName: (c) => c.owner.name,
  ownerShort: (c) => c.owner.short,
  ownerInitials: (c) => c.owner.initials,
  email: (c) => c.contact.email,
  instagram: (c) => c.contact.instagram,
  themeColor: (c) => c.theme.themeColor,
  siteTitle: (c) => c.site.title,
  siteDescription: (c) => c.site.description,
  heroLead: (c) => c.site.heroLead,
  promo: (c) => c.site.promo,
};

/** Replaces every {{token}}; throws on an unknown token so typos fail loudly. */
export function renderTemplate(str, client, label = "template") {
  return String(str).replace(/\{\{\s*([^{}]*?)\s*\}\}/g, (_, name) => {
    if (!Object.hasOwn(TOKENS, name)) throw new Error(`${label}: unknown token {{${name}}}. Allowed: ${Object.keys(TOKENS).join(", ")}`);
    return escHtml(TOKENS[name](client));
  });
}
