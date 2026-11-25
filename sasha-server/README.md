# Саша, есть минутка? — защищённая игра и разметка

Frontend: GitHub Pages entrypoint redirects to the password-protected server. The server serves HTML and JavaScript only after login. Do not publish plaintext game content on GitHub Pages: it cannot enforce server-side authentication.

Backend: dependency-free Cloudflare Worker + D1, deployed through Sites. Source game payloads in `worker/assets.js` use AES-256-GCM encryption; the decryption key is a runtime secret, never committed. Password verification uses PBKDF2-SHA256 (100,000 iterations, salted). Sessions are HMAC-signed, HttpOnly, Secure, SameSite=Strict cookies valid for seven days. Login attempts are throttled; writes validate Origin, scene ID and revision. This is a small friends-only review tool, not an identity verification system.

## URLs

- `/`: game, 16 decisions per playthrough: 1 trader, 3 iOS developer, 3 development team lead, 3 head of mobile development, 6 B2C product director. Scenes are drawn from reviewed case pools.
- `/?review=1`: all 30 questions, all choices, outcomes and factual context, funny/not funny, optional comment.
- `/?results=1`: owner dashboard; requires a separate owner key in addition to login. JSON/CSV export includes exact scene revisions. CSV neutralizes spreadsheet formula prefixes.

## Data

One vote per browser ID + question ID + content revision. Repeating a vote updates the existing row. A common login does not identify real people: different browsers or cleared storage can produce additional participants. Names are optional. Comments are limited to 500 characters. Failed requests never show success; progress is marked saved only after the server confirms the write.

`votes` stores campaign, anonymous browser ID, hashed question ID, content revision, rating (0/1), optional nickname/comment and timestamps. It does not store Slack messages. `login_limits` stores salted hashes of client IPs and temporary attempt counters. The active bank contains 29 premises reviewed against the owner's DM with Sasha and one owner-confirmed episode. Answer choices and consequences are fictional jokes. Original speakers and uncertainty in the sources are preserved.

## Runtime secrets

Set `LOGIN_USERNAME`, `LOGIN_SALT`, `LOGIN_PASSWORD_HASH`, `SESSION_SECRET`, `CONTENT_KEY`, `ADMIN_SHA256` through Sites environment variables. Keep the plaintext owner key outside the repository. Do not put passwords or decryption keys in HTML/JS, build logs or GitHub Actions variables visible to visitors.

The Worker is bundled to `dist/server/index.js`; `.openai/hosting.json` declares the D1 binding `DB`. Migrations live under `drizzle/` and are applied at deployment. Do not recreate tables in request handlers. Preserve applied migrations and append new ones.

## Owner actions

After login, provide the owner key on the results page. `/api/admin/export` requires the owner bearer key plus a valid game cookie. `/api/admin/clear-my-votes` (POST, same-origin) deletes only votes for the current browser and requires the same owner key; it is used to remove deployment smoke-test records.

To stop the temporary collection, disable `/api/vote` or change the campaign in a new release. Export first; retain the D1 database until the labels have been processed. Do not delete votes as part of routine redeployment.

## Editing

`sasha-game/grounded-scenes.js` is the sole active question bank. Every premise requires a `source` with either a reviewed Slack permalink/message timestamp or an explicit owner confirmation. Quotes must preserve their real speaker. Do not invent concrete incidents to fill career stages. Each answer carries three stat effects: team love, executive respect, and sanity. Resistance earns team love and costs sanity; accepting corporate nonsense earns executive respect. Rest and delegation may restore sanity without executive respect.

`sasha-game/mechanics.js` validates provenance and effects, selects fourteen stable two-question draws, and adds the fixed opening and farewell. The five career stages remain chronological. `build.mjs` reuses only the UI/engine from the historical HTML template and discards its entire old data block. It emits `case-sources.json` for the owner's audit. Historical generic scene modules are not loaded or bundled. Run `node sasha-game/mechanics.test.mjs` after rebuilding the frontend.

Editable plaintext game sources are delivered locally in `sasha-source.zip`. Keep them private. Update scenes, rebuild the HTML and hashed registry, re-encrypt the assets with `CONTENT_KEY`, run the backend/game tests, then publish through Sites. Displayed factual context and quotes are included in the rating revision alongside the question and answers. Older revisions and ratings for retired questions remain in the database/export and are excluded from the active summary; never clear them during an editorial cleanup.

Only this entrypoint and the password-protected server are updated; the unrelated GitHub Pages root site is preserved. The original, previously public game can still exist in Git history; this login protects the new deployment and its new content, not historical public copies.
