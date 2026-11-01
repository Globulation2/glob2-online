# Globulation 2 Online

The public, static Astro website for Globulation 2 Online. The game and online platform are maintained independently in [Globulation2/glob2](https://github.com/Globulation2/glob2).

- Public website: https://glob2.online
- Online hub: https://app.glob2.online
- Browser play: https://app.glob2.online/play/
- Sign in: https://app.glob2.online/signin

## Develop and verify

Use Node 24.14 or newer. Dependencies are pinned in package-lock.json.

```sh
npm ci
npm run design:sync
npm run dev
npm run check
npm run build
node scripts/check-links.mjs
node --test scripts/test_monitor.mjs
python3 -m unittest discover -s scripts -p 'test_*.py' -v
npx playwright install --with-deps chromium firefox webkit
npm test
```

`npm run preview` serves the compiled pages with Pagefind search. Development mode does not build the search index. Browser tests serve the compiled site with Firebase security headers on port4322 to exercise the production CSP.

The site uses Astro content collections for guides, news, history and source-linked archive entries. `src/data/events.json` contains validated, reviewed human-community events; an empty collection is intentional until organizers announce something. `src/data/site.ts` holds community URLs. Configure only verified Discord invitations. `src/data/release-metadata.json` records a qualified all-platform manifest; `scripts/sync-releases.mjs` verifies immutable public release assets and production store links. Node 24.14+ is required for the shared TypeScript schema.

The selected design is Colony, using the shared Meadow and Night colony themes. `/design/colony/` and `/design/field-guide/` remain noindexed review references. Search distinguishes current guidance from history. The legacy migration manifest records sources, revisions, attribution, language, rights and verification status. Original wiki prose and media remain source-linked where republication rights are unverified.

## New-player introduction

The homepage introduces the game through a real colony, decisions about work,
food and flags, and the first-session guide. Shared editorial copy lives in
`src/data/marketing.ts`; player instructions live in `src/content/guides`.
The main navigation prioritizes the game, learning and community; competition
and news remain available in the footer and at their original URLs.

See [content verification](docs/website-content-verification.md) for the game
revision, public-app observations and limits behind the current introduction.
Source implementation and deployed availability are separate evidence. Recheck
both before adding promises about devices, accounts or online features.

Review a production build with `npm run preview`. Browser checks use the built
site with Firebase headers via `node tests/server.mjs`; use `SITE_URL` to reuse
an already running test server. Keep visual review captures in `artifacts/`,
and complete two rendered review rounds before publishing substantial changes.
With that test server running, `node scripts/review-site.mjs 1` and
`node scripts/review-site.mjs 2` capture the five core pages in both themes at
360, 768 and 1440px, check accessibility and 200% text reflow on the homepage,
game explanation and first-session guide, and save ignored review artifacts.
These checks complement human inspection of hierarchy,
captions and contrast over artwork.

See [article authoring and interaction](docs/article-experience.md) for the shared
reading layouts, Markdown callouts/media groups, library integration and full
article review matrix.

## Marketing languages

The four main marketing pages have static localized routes matching the game language roster. See [localization and review](docs/localization.md) for source catalogs, independent review fingerprints, English-only article boundaries and rendered validation.

## Integrations and operations

See [hosting and rollback](docs/hosting.md), [content maintenance](docs/content.md), and [player-rating snapshot contract](scripts/RANKINGS.md). Public pages use no account cookies or analytics, and do not initiate gameplay. The rankings widget requests a sanitized public snapshot; it never queries account persistence or uses authenticated APIs.

Code is GPL-3.0-or-later. Game media attribution is listed on `/credits/`; legacy source links retain their original authorship and do not imply transfer of rights.

The shared [Glob2 design system](https://github.com/Globulation2/glob2-design-system)
owns portable tokens, typography, controls, icons, theme persistence, fonts, wordmark,
favicons and colony recording/posters. This site owns editorial layouts and content.
Do not copy theme definitions or reusable brand assets into this repository.
Import shared CSS before local layout styles and opt into components with `.g2-ui`.

`npm run design:sync` and Astro's config bootstrap resolve design-system `main` once
per invocation and install that exact revision in isolation. Other dependencies retain
their lockfile versions. Set `GLOB2_DESIGN_SYSTEM_SHA` to a full published commit SHA
before checks/builds to reproduce a release or test a candidate. Resolution failures
stop the build. `.cache/design-system.json` records the installed revision and file
fingerprint; `/design-system.json` records the revision in the immutable static artifact.
CI resolves once and shares the SHA throughout verification and packaging.

The shared same-origin external bootstrap applies the preference before paint.
Production HTTPS sites share the functional `glob2-theme` cookie across the apex and
app subdomain (one year, Secure, SameSite=Lax, Path=/); local/third-party previews use
origin-local storage. The privacy page describes this preference. Both themes respect
reduced motion and forced colors. The colony has a poster fallback and pauses when
hidden/offscreen, with a keyboard-accessible user control.

To regenerate reusable artwork, use the game's artwork/colony tooling targeting the
design-system checkout, update asset provenance there, and publish a new revision.
Downstream builds stage only the required shared assets, including license notices;
the package's independent HTML, Astro and React examples document new consumers.
