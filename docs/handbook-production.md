# Player handbook production

The handbook teaches the public browser game through illustrated, actionable lessons. Research and captures support editorial review; articles remain focused on playing. The website stays static, and creator programming and map editing are outside this handbook.

## Research and ownership

Before an article is commissioned, map its player concepts to the matching engine source, AI configuration and visible game behavior. Use the deployed build's source revision, not an arbitrary development checkout. Record the served package checksum and verify the deployment record matches it. Reconcile source differences before reusing research for a later build.

The coordinator maintains `src/data/guide-coverage.json`. Each concept has an article destination or an explicit reason for exclusion/deferment. Research briefs, experimental observations and temporary review notes live in ignored `artifacts/handbook/`. Assign disjoint article and artifact directories to authors. After the pilot workflow passes, authors may produce independent groups in parallel. Reviewers must not review their own articles.

## Article conventions

Guides live in `src/content/guides/`. Keep established slugs. Frontmatter `group` assigns a handbook section, `order` orders chapters within it, and `prerequisites` lists existing guide slugs. `reviewedAgainst` identifies the source revision. Sources use immutable revision links.

Teach actions, observations and recovery. Use substantial sections rather than disconnected tips. Put each `[[media:asset-id]]` marker on its own paragraph at the step it explains. The marker resolves through `src/data/guide-media.json` to a responsive figure or user-controlled clip. Alt text describes the relevant game state; captions explain what the player should notice. Use actual player-perspective captures. Pair full scenes with genuine detail crops whenever readers must identify a control label or number at mobile width. Annotated media must preserve the underlying game state. Silent clips need an equivalent written explanation; speech would require captions and a transcript.

## Capture

`scripts/capture-guide.mjs` runs trusted author scenarios against the public browser game in an isolated profile. A scenario exports an async function receiving the page, real control and keyboard helpers, screenshots, diagnostic state, tick waits and an action log:

```sh
node scripts/capture-guide.mjs artifacts/handbook/scenarios/lesson.mjs artifacts/handbook/lesson
```

Keep the fixed capture viewport, renderer, game revision, package checksum, map/start save, seed where known, rules and resolved AI strategy in the private capture package. Save initial and useful milestone states using the game controls. Retain original screenshots, full footage, action notes, exported saves/replays and observed ticks. Replay compatibility depends on the matching game build. Do not promise exact-tick seeking.

The capture harness closes the live game page before waiting for recording finalization. Export required native saves and recordings before returning from the scenario; retain any cleanup limits in its private record.

Use the game's recorder when available or browser video recording, then select short explanatory MP4 clips and WebP screenshots. Capture the initial situation, relevant action/panel and resulting change. A screenshot quota does not replace coverage of the actual lesson.

## Media storage and reproducible builds

Approved media lives in the existing public bucket `glob2-website-public`, under versioned `guide-media/` paths. Raw recordings and review artifacts stay ignored or in external evidence storage. Never put private account data in the public bucket.

The tracked manifest records IDs, public object URLs, same-origin website paths, SHA-256 hashes, byte lengths, dimensions, kind, alt text, captions and video poster IDs. Paths are immutable: create a new version for corrected media. Stage approved files under an ignored source directory matching their manifest paths, then publish:

```sh
python3 scripts/upload-guide-media.py --source-dir artifacts/handbook/approved
```

Use Node 24.14+ on PATH. The local publisher impersonates `glob2-website-media@bradley-personal-20261027.iam.gserviceaccount.com` with a short-lived token. Its custom role permits only object creation and reading under `guide-media/`; it cannot replace/delete objects. `scripts/guide-media-role.yaml` is the enduring role definition. The feed publisher retains its separate ratings-only permissions. The bucket IAM condition is `resource.name.startsWith("projects/_/buckets/glob2-website-public/objects/guide-media/")`.

Upload new reviewed media locally before opening its article PR, so the PR build can download the manifest’s assets. The verified website workflow produces a `guide-media` artifact from staged media; it is available for subsequent publication verification or recovery.

The `Publish approved guide media` workflow uses WIF and the `website-media` environment on main. Its provider admits only this repository's exact main-branch workflow on GitHub-hosted runners. It downloads an approved `guide-media` artifact from a selected same-repository Actions run, validates every object against the main manifest and uploads only matching bytes. It does not take credentials from the artifact.

`npm run build` downloads/checks media, reuses only verified cached bytes in ignored artifacts, and stages assets into `dist/guide-media/`. Readers load them from the website origin. Missing, corrupt or mismatched files fail the build. Media are included in the same immutable Hosting version as the article.

## Review and publication

Complete the first-colony pilot before expanding the queue. For each article, independent reviewers check mechanics, reproduce the walkthrough, inspect design/accessibility and verify integration. Substantial visual changes require two rendered rounds, with revisions between them. Keep review screenshots and reports ignored. Fix factual findings and recapture media when steps change.

Run all AGENTS.md checks plus `npm run check:media`. Browser tests must exercise illustrated articles, grouped navigation, prerequisite/contents/adjacent links, mobile/zoom layouts, light/dark themes, media failures and content without JavaScript. Record commands and actual limits in PR evidence.

Publish each accepted article through a trusted same-repository PR preview. Main promotes the tested immutable Hosting version. Do not deploy game services or change multiplayer infrastructure as part of handbook publication.

Release smoke checks retry required page and media responses only for temporary 404/503 statuses, with five attempts and 37 seconds cumulative backoff. Invalid successful HTML, missing chapter navigation, redirects, permanent errors and mismatched media bytes still fail. The intentional 404 and old application redirect checks are not retried. Each fetch is separately bounded; 37 seconds is not a total wall-time limit.
