# Static hosting and rollback

## Resources and boundaries

The source repository is `Globulation2/glob2-online-website`. Repository renames require updating the WIF providers’ allowed `workflow_ref` paths; the repository ID remains the identity anchor. Hosting, bucket, and service-account IDs are stable deployment identifiers with the original `glob2-website` prefix.

GCP project bradley-personal-20261027 contains the dedicated Firebase Hosting site glob2-website-personal-20261027 and public bucket glob2-website-public. Firebase serves only the static Astro build. Multiplayer remains on its existing VM and database; website CI has no VM, database or backend-artifact permissions.

The website identity glob2-website-deploy uses project metadata-read permissions (glob2WebsitePublisher) and Hosting site read and update permissions (glob2WebsiteSitePublisher). Both are unconditional project bindings: Firebase Hosting does not support the resource.name IAM Condition attribute, so a condition naming the site never matches and denies every deploy, and Hosting has no per-site IAM policy. IAM therefore cannot keep this identity off other Hosting sites in the project. The site is pinned by scripts/deploy-static.py and firebase.json, and the WIF provider issues the identity only to this repository's exact main-branch website workflow for push/manual events and rollback workflow for manual events. The provider also requires the numeric repository and organization IDs and the sole maintainer actor ID (`6193625`), the website environment and GitHub-hosted runners. Isolating it further means a dedicated project. The separate glob2-website-feeds identity writes only the public feed bucket. Both use the github-actions WIF pool, with separate glob2-website and glob2-website-feeds providers, restricted to this repository and hosted GitHub runners. No service-account key or long-lived Firebase token is used. Restrict feed deployment environment to main; forks never receive credentials.

Repo variables WIF_PROVIDER, DEPLOY_SERVICE_ACCOUNT, FEED_WIF_PROVIDER, FEED_SERVICE_ACCOUNT, API_ORIGIN and BACKEND_REVISION configure workflows. BACKEND_REVISION must identify the deployed API commit, not the website source. Update it alongside backend releases. API_ORIGIN is https://app.glob2.online.

The apex used to serve the multiplayer app, so firebase.json redirects its old app paths to https://app.glob2.online with path and query kept: /j/*, /matches*, /players/*, /leaderboard*, /maps*, /admin*, /api/*, /auth/* and /signin/* permanently (301), /play and /signin temporarily (302). scripts/smoke.mjs checks them on every preview. The website calls no app API from browsers, so the app needs no CORS entry for it.

Firebase headers enforce CSP, nosniff and a referrer policy. The narrowly allowed wasm-unsafe-eval directive enables Pagefind's local search engine; it does not load the game. The game-specific COOP/COEP headers belong only on the app's /play/ path. There is no SPA fallback: missing public URLs return404.

## Website releases

The Website workflow resolves the latest design-system main SHA once, exports it to all later steps, validates content/types, builds, checks internal links, runs publisher tests and browser journeys, and uploads a checked dist artifact. All PRs run checks and produce build/browser artifacts, without cloud credentials or hosted previews. Browser dependency installation uses Ubuntu’s main archive with bounded network timeouts and retries to avoid stalled runner-mirror downloads. Outside collaborators require approval to run workflows, including returning contributors. Main publishes a candidate, smoke-tests its routes/headers, and promotes exactly that finalized version to live.

Superseded runs are cancelled: a newer push to the same PR or non-main branch cancels the older Website run. Main runs deploy, so they finish once started; GitHub replaces a pending main run with a newer one, so only the newest queued main commit deploys. Rollback, rankings, availability and metadata workflows never cancel in progress. scripts/test_workflows.py enforces this.

The Firebase CLI is available for standard operations using ADC. The checked-in scripts/deploy-static.py offers the same static version/upload/release flow using gcloud's ephemeral identity token; scripts/promote-static.py promotes an existing immutable version. Both are restricted to this site. Release artifacts record the version and previous version for rollback.

For manual deploy, run the standard checks/build first:

```sh
python3 scripts/deploy-static.py --channel review
node scripts/smoke.mjs HTTPS_PREVIEW_URL
python3 scripts/promote-static.py --channel review
```

Restore a recorded version using the Restore website release workflow, or:

```sh
python3 scripts/promote-static.py --version sites/glob2-website-personal-20261027/versions/VERSION_ID
```

Verify routes and app links after restoration. Website rollback does not roll back DNS or multiplayer configuration; retain the prior Cloud DNS records and platform environment separately for a domain-cutover rollback.

## Repository security controls

GitHub Actions defaults to a read-only token and cannot approve pull requests. The scheduled download-metadata workflow produces a reviewed-download-metadata artifact; a maintainer downloads it, reviews the change, and opens a normal PR. It does not write branches or create PRs. All actions must be pinned to full commit SHAs. Main requires the up-to-date Website `verify` check from GitHub Actions and resolved conversations, and disallows force pushes and deletion. Only `genixpro` is permitted to update main; administrators are subject to that restriction. No approving review is required while the website has a sole maintainer. CODEOWNERS records that maintainer for security-sensitive files without requiring a second reviewer. Organization owners inherit repository administration and can change these GitHub rules; repository settings cannot revoke that organization-level authority.

The website deployment environment permits only main. It has no additional manual deployment approval: production still deploys automatically after a maintainer merge passes its checks. Cloud trust independently denies PR events, even if a PR modifies its workflow conditions. Website, rollback, feed and media authentication also require the sole maintainer actor ID; a GitHub organization owner cannot authenticate these identities as themselves. Authenticated jobs also require `github.triggering_actor` to be `genixpro`. Cloud trust permits only first attempts (`run_attempt` 1), preventing another administrator from rerunning an old maintainer-origin workflow with its original identity. Retry failed deployment/publication through a fresh manual workflow dispatch on main, rather than GitHub’s Re-run jobs button. Scheduled feed runs use the actor associated with the schedule and must retain the maintainer actor. See [GitHub’s OIDC claims](https://docs.github.com/en/actions/reference/security/oidc) and [rerun behavior](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/re-run-workflows-and-jobs). Existing PR-hosted preview channels may remain until they expire; new PRs cannot publish them. Review PR artifacts locally with `npm run preview`.

Production and preview credentials must remain separate if hosted PR previews are restored. The current production identity can update Hosting throughout this project, so a separate project is required for a strong preview/production boundary. Repository protections cannot prevent a deliberately approved malicious merge or a compromised dependency in the production build; review workflow and dependency changes carefully.

## Rankings

The publisher uses the existing public modern platform leaderboard, avoiding new private APIs or account-store access. Its GitHub schedule is nominally five minutes but best effort; delayed jobs are visible through the snapshot timestamp and stale state. Failures preserve the prior object. The dedicated bucket permits anonymous object reads and production-origin GET CORS, while write permission belongs to the feed identity. PR browser tests use intercepted fixtures for ratings tests rather than expanding production CORS for every preview origin.

## Domain cutover

The canonical website is `glob2.online`, with valid TLS on both the apex and `www`; the application host is `app.glob2.online`. Keep the former website and its certificates working until the qualified website release is deployed and permanent redirects are verified. Website releases use the immutable preview/test/promotion process above.

The application host already has valid TLS, the new canonical HTTPS/WSS origins, a verified existing-account Google sign-in and successful WebSocket upgrades for both former/new host and Origin combinations. Both origin allowlists and former API/recovery endpoints remain available. Browser saves and cookies remain origin-bound. The edge uses its existing image plus a temporary read-only Caddy configuration mount for restart safety; remove that override when a separately qualified edge image contains the maintained migration settings. See the [operations handoff](https://github.com/Globulation2/glob2-marketing/blob/main/planning/domain-migration-operations.md) for the exact bridge, runtime settings and cleanup checks. Website deployments do not change multiplayer infrastructure; check for active games before any separately authorized relay transition.

Cloud DNS delegation and the new records are published. After a qualified immutable website release is tested and promoted, configure `glob2online.com` and `www.glob2online.com` as permanent redirects to `https://glob2.online`, preserving paths and query strings. Verify HTTP/HTTPS, apex/WWW and deep-link behavior separately from the deployment. The former application hostname currently redirects only GET `/signin` and OAuth `/auth/*/start` requests; callbacks, POSTs, APIs, browser play and recovery paths retain compatibility. Do not replace that compatibility with a blanket application redirect before qualifying shipped clients. Keep working TLS on every redirecting hostname. Keep old-domain path migration separate from the legacy wiki, whose domain is not administered here.

Availability checks, scheduled feed freshness verification and project billing alerts cover operations. Inspect GitHub failure notifications when publication fails, and check GCP budgets without changing budgets for unrelated project services.

## Operational checks

Website availability runs every 15 minutes, offset from the ratings publisher. It checks the public homepage/CSP, app instance's canonical HTTPS/WSS origin, browser isolation headers and the public snapshot's schema/timestamp. An empty current ladder is healthy; a snapshot older than 8 hours fails, because GitHub runs the 5-minute ratings schedule only every few hours. Requests have 15-second deadlines, bounded response bodies and no redirects. This workflow has no cloud credentials, creates no accounts, and never starts a game.

Run `node --test scripts/test_monitor.mjs` to verify its failure handling, then `node scripts/monitor.mjs` to check production. A failed Website availability run is the operational alert; maintainers should enable GitHub Actions failure notifications. GitHub schedules are best effort, so this is not an exact 15-minute detection guarantee. Inspect Publish player ratings first for a stale snapshot; restore website versions for static regressions and use the independent backend deployment process for app failures. No monitoring credential or external notification service is required.

The website, multiplayer VM, storage and availability monitoring bill to personal project `bradley-personal-20261027`. Manage project-scoped budget alerts for these services in the Billing console.

GCP Cloud Monitoring also checks availability independently of GitHub runner scheduling. The replacement **Glob2 public website** check `glob2-public-website-0-k989RRMuM` requests `https://glob2.online/`; its existing availability policy `824494495873556283` was retargeted with the same settings after the HTTPS check passed. The replacement **Glob2 multiplayer app** check `glob2-multiplayer-app-B2WF84Y7Drw` requests `https://app.glob2.online/api/v1/instance`, and its existing availability policy follows that check. The former website and app checks remain as **Glob2 website legacy compatibility** and **Glob2 app legacy compatibility**. The canonical checks validate HTTPS certificates, run every five minutes from the three USA probe locations, and use a ten-second request timeout. Their enabled availability policies count failing probes and open an incident when at least two probes keep failing for five minutes. See the [project uptime dashboard](https://console.cloud.google.com/monitoring/uptime?project=bradley-personal-20261027) and [alert policies](https://console.cloud.google.com/monitoring/alerting?project=bradley-personal-20261027). These HTTP checks complement the GitHub schema, freshness and browser-header checks; they do not verify gameplay.

Initially the GCP availability policies have no notification channels: failures create dashboard incidents, but do not send email or other messages. Attach the operator's chosen notification channel to both policies once the recipient is supplied and verified. Review Firebase Hosting, public bucket and monitoring usage alongside the multiplayer service in the existing [Cloud Billing budget](https://console.cloud.google.com/billing/budgets). Budget alerts report spending; they do not stop resources automatically.

## Shared theme build identity

`npm ci` installs the manifest's baseline design-system SHA without lifecycle scripts.
Run `npm run design:sync` before checks; it installs current main separately without
changing other locked dependencies. `GLOB2_DESIGN_SYSTEM_SHA` selects a full candidate,
reproduction or rollback revision. Astro also bootstraps on direct development/build
invocations. Resolution/install errors fail closed. The compiled artifact contains
`design-system.json`, so preview verification and live promotion use identical theme
bytes as well as identical page bytes. Keep the recorded SHA with release evidence;
do not re-resolve or rebuild between testing and promoting the immutable artifact.

All package fonts, CSS, JavaScript and selected media are served by this site. The
external `/theme.js` bootstrap remains compatible with the existing same-origin CSP.
The functional preference cookie on HTTPS production uses Domain=glob2.online (or
Domain=glob2online.com on the former hostname during transition),
Path=/, SameSite=Lax, Secure and a one-year lifetime; it is shared with the online app.
No account or analytics integration is added. The privacy page documents the preference.
