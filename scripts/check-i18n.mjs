/**
 * i18n integrity check: key parity, placeholder survival, plural completeness,
 * untranslated leakage and JSON validity across every locale pair.
 *
 * Usage: node scripts/check-i18n.mjs [pathFilter]
 * Exit code 1 when any error is found.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOTS = [
  'dashboard/src/i18n/locales',
  'storefront-themes/_shared/i18n/locales',
  ...fs.readdirSync('storefront-themes')
    .filter((t) => fs.existsSync(path.join('storefront-themes', t, 'src/i18n/locales')))
    .map((t) => path.join('storefront-themes', t, 'src/i18n/locales')),
];

const PLURAL_CATS = ['zero', 'one', 'two', 'few', 'many', 'other'];
// Strings that are legitimately identical in both locales: language names in
// their own script, masked passwords, symbols, and — deliberately — example
// values that illustrate SYNTAX the user must type in Latin (slugs, codes,
// hostnames, email and phone shapes, country-code lists, URL patterns).
const SYNTAX_EXAMPLE = /^(you@example\.com|your@email\.com|colleague@example\.com|store@example\.com|orders@acme\.test|rivera-co|shop\.mystore\.com|summer-sale|my_field|custom|standard|eu|US, CA, MX|\+249 …|\/pages\/\{\{slug\}\}|\{\{from\}\} – \{\{upTo\}\}|vip, wholesale|info@example\.com|ELLE, VOGUE, BAZAAR, FORBES, GRAZIA|HERO 4 SESSION|© \{\{year\}\} \{\{name\}\})$/;
const ALLOW_SAME = /^(English|العربية|#|•+|\s*|[\d\s.,:%+\-/×x]+|[A-Z]{2,5}|Matjar|Face ID|Touch ID|Google|Apple Pay|Shop Pay|PayPal|Stripe|WhatsApp|Instagram|Facebook|TikTok|Bankak|Fawry|OCash|Cashi|Webhooks?|User Agent|SDG|USD|EUR|GBP|COD|SKU|URL|API|CSS|HTML|PDF|CSV|JSON|ID|QR|SMS|OTP|VAT|@\S+|https?:\/\/\S+|\{\{[^}]+\}\})$/;

const flat = (o, p = '') =>
  Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === 'object' && !Array.isArray(v) ? flat(v, `${p}${k}.`) : [[`${p}${k}`, v]]
  );
const tokens = (s) => (String(s).match(/\{\{[^}]+\}\}|<\/?\d+>|\$t\([^)]+\)/g) || []).sort();

const filter = process.argv[2] || '';
let errors = 0;
const err = (m) => { console.log('ERROR ' + m); errors++; };

for (const root of ROOTS) {
  if (filter && !root.includes(filter)) continue;
  const en = path.join(root, 'en');
  const ar = path.join(root, 'ar');
  if (!fs.existsSync(en) || !fs.existsSync(ar)) continue;

  for (const file of fs.readdirSync(en).filter((f) => f.endsWith('.json'))) {
    const ep = path.join(en, file);
    const ap = path.join(ar, file);
    if (!fs.existsSync(ap)) { err(`${ap} missing`); continue; }
    let E, A;
    try { E = JSON.parse(fs.readFileSync(ep, 'utf8')); } catch (e) { err(`${ep} invalid JSON: ${e.message}`); continue; }
    try { A = JSON.parse(fs.readFileSync(ap, 'utf8')); } catch (e) { err(`${ap} invalid JSON: ${e.message}`); continue; }

    const fe = Object.fromEntries(flat(E));
    const fa = Object.fromEntries(flat(A));
    const isPlural = (k) => PLURAL_CATS.some((c) => k.endsWith('_' + c));

    for (const k of Object.keys(fe)) {
      if (!(k in fa) && !isPlural(k)) err(`${ap}: missing key "${k}"`);
    }
    for (const k of Object.keys(fa)) {
      if (!(k in fe) && !isPlural(k)) err(`${ap}: extra key "${k}" not in English`);
    }

    // Placeholder survival (compare against the English base of a plural group too).
    for (const [k, v] of Object.entries(fa)) {
      if (typeof v !== 'string') continue;
      const base = PLURAL_CATS.reduce((acc, c) => (acc.endsWith('_' + c) ? acc.slice(0, -(c.length + 1)) : acc), k);
      const source = fe[k] ?? fe[base] ?? fe[base + '_other'] ?? fe[base + '_one'];
      if (typeof source !== 'string') continue;
      const te = tokens(source), ta = tokens(v);
      // Arabic idiomatically drops the counter in the zero/one/two forms
      // ("no orders", "one order", "two orders" are worded without a digit),
      // so only a MISSING token outside those forms is an error. A token the
      // Arabic invented is always an error.
      const softCat = /_(zero|one|two)$/.test(k);
      const missing = te.filter((t) => !ta.includes(t));
      const invented = ta.filter((t) => !te.includes(t));
      if (invented.length || (missing.length && !softCat)) {
        err(`${ap}: placeholders differ for "${k}" — en[${te}] ar[${ta}]`);
      }
      if (v.trim() && v.trim() === source.trim() && !ALLOW_SAME.test(v.trim()) && !SYNTAX_EXAMPLE.test(v.trim())) {
        err(`${ap}: untranslated "${k}" = "${v.slice(0, 60)}"`);
      }
      if (/[A-Za-z]{4,}/.test(v) && !ALLOW_SAME.test(v.trim())) {
        const latin = (v.match(/[A-Za-z][A-Za-z'’]{3,}/g) || []).filter(
          (w) => !ALLOW_SAME.test(w) && !/^(Matjar|Face|Touch|Google|Apple|Shop|PayPal|Stripe|WhatsApp|Instagram|Facebook|TikTok|Bankak|Fawry|OCash|Cashi|Webhook|Https?)$/i.test(w)
        );
        if (latin.length) console.log(`WARN  ${ap}: latin words in "${k}": ${latin.slice(0, 4).join(', ')}`);
      }
    }

    // Plural completeness (Arabic needs all six).
    const groups = new Map();
    for (const k of Object.keys(fa)) {
      const m = k.match(/^(.*)_(zero|one|two|few|many|other)$/);
      if (m) groups.set(m[1], (groups.get(m[1]) || new Set()).add(m[2]));
    }
    for (const [base, set] of groups) {
      if (set.size !== 6) err(`${ap}: plural "${base}" has [${[...set].join(',')}] — Arabic needs all six`);
    }
  }
}

console.log(errors ? `\n${errors} error(s)` : '\nAll i18n checks passed');
process.exit(errors ? 1 : 0);
