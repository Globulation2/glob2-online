# Marketing website localization

The homepage, game explanation, downloads and community pages use 45 static locale variants: English and the game's 44 non-English locales. English keeps its existing URLs. Translations use `/<locale>/`, `/<locale>/game/`, `/<locale>/downloads/` and `/<locale>/community/`.

`src/i18n/en.json` is the 194-field English translation source. Translations live in `src/i18n/locales/<locale>.json`. Locale names, codes and direction come from `src/i18n/locales.ts`, matching the game roster observed at revision `8d5293c436` on November 1, 2026. Arabic, Persian and Urdu use RTL text; gameplay images and the wordmark retain their original orientation. No visitor location detection, account data or new preference cookie is used. The native language menu works without JavaScript and preserves the current marketing page; from English-only pages it opens the selected language's homepage.

The catalog includes visible marketing copy, navigation, footer, screenshot captions and descriptions, download instructions, accessible labels and client-side theme/animation controls. The underlying release metadata, download URLs, package checksums, commands, filenames, brand names and existing artwork are preserved. Reviews must preserve exact installer commands and named screenshot UI counters.

The player handbook, history, news, competition, archive, search, credits and legal pages remain English. Links from localized pages visibly identify those English destinations. Existing legal source synchronization remains authoritative. Translation of marketing pages does not establish translation of those articles, support for a device, or availability of a new product release.

## Translation maintenance

Keep catalog identifiers unchanged. Values are plain text, never HTML. Preserve every `{placeholder}` exactly; word order may change. The Flatpak setup sentence uses `{setup}` to place its existing link safely in the correct position. UI rendering escapes translated text.

Review records live in `src/i18n/reviews/<locale>.json`. They distinguish translator and independent reviewer and bind the raw English and translated UTF-8 files by SHA-256. Any source or catalog edit invalidates its review. The initial catalogs use machine-translation drafts, agent corrections and separate AI review; this does not claim human or native-speaker validation.

`npm run check:i18n` checks complete keys, nonempty strings, placeholder parity, protected command/counter literals, independent current review fingerprints and drift between the website's established English marketing data and the translation source. The ordinary check and build commands enforce this gate. The final build also checks all 180 marketing routes for language/direction, exact canonical and same-page alternate URLs, localized navigation and unresolved placeholders.

```sh
npm run check
npm run build
node --test scripts/test_i18n.mjs
```

For rendered review, serve a production build with Firebase headers, then run both rounds:

```sh
TEST_PORT=4323 node tests/server.mjs
SITE_URL=http://127.0.0.1:4323 node scripts/review-i18n.mjs 1
SITE_URL=http://127.0.0.1:4323 node scripts/review-i18n.mjs 2
```

Each round checks English, German, Arabic, Japanese and Tamil home/download pages at 360px and 1440px, accessibility, horizontal overflow, native language-menu keyboard activation and page-preserving menu targets. Screenshots and machine reports go under ignored `artifacts/i18n/`; inspect them independently before publication. Also run the repository's complete required checks from `AGENTS.md`. Source completion, passing checks, merged source and live deployment are separate states.
