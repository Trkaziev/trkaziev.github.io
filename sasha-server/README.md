# Саша, есть минутка? — защищённая игра и разметка

Frontend: GitHub Pages entrypoint redirects to the password-protected server. The server serves HTML and JavaScript only after login. Do not publish plaintext game content on GitHub Pages: it cannot enforce server-side authentication.

Backend: dependency-free Cloudflare Worker + D1, deployed through Sites. Source game payloads in `worker/assets.js` use AES-256-GCM encryption; the decryption key is a runtime secret, never committed. Password verification uses PBKDF2-SHA256 (100,000 iterations, salted). Sessions are HMAC-signed, HttpOnly, Secure, SameSite=Strict cookies valid for seven days. Login attempts are throttled; writes validate Origin, scene ID and revision. This is a small friends-only review tool, not an identity verification system.

## URLs

- `/`: game, 32 decisions per playthrough: every active scene exactly once in a single ordered timeline. Personal scenarios are interleaved with work. Trading and iOS-development remain in the introductory career biography. Ordinary analytics episodes were retired after review feedback.
- `/?review=1`: all 32 questions, all choices and outcomes, funny/not funny, optional comment.
- `/?results=1`: owner dashboard; requires a separate owner key in addition to login. JSON/CSV export includes exact scene revisions. CSV neutralizes spreadsheet formula prefixes.

## Data

One vote per browser ID + question ID + content revision. Repeating a vote updates the existing row. A common login does not identify real people: different browsers or cleared storage can produce additional participants. Names are optional. Comments are limited to 500 characters. Failed requests never show success; progress is marked saved only after the server confirms the write.

`votes` stores campaign, anonymous browser ID, hashed question ID, content revision, rating (0/1), optional nickname/comment and timestamps. It does not store Slack messages. `login_limits` stores salted hashes of client IPs and temporary attempt counters. The active bank contains 20 premises reviewed against the owner's DM with Sasha and twelve owner-proposed questions. Answer choices and consequences are fictional jokes. Original speakers and uncertainty in the sources are preserved.

## Runtime secrets

Set `LOGIN_USERNAME`, `LOGIN_SALT`, `LOGIN_PASSWORD_HASH`, `SESSION_SECRET`, `CONTENT_KEY`, `ADMIN_SHA256` through Sites environment variables. The current asset payload uses the rotated `CONTENT_KEY_V2` secret, which takes priority over `CONTENT_KEY`. Login, owner access and sessions retain their existing secrets. Keep the plaintext owner key outside the repository. Do not put passwords or decryption keys in HTML/JS, build logs or GitHub Actions variables visible to visitors.

The Worker is bundled to `dist/server/index.js`; `.openai/hosting.json` declares the D1 binding `DB`. Migrations live under `drizzle/` and are applied at deployment. Do not recreate tables in request handlers. Preserve applied migrations and append new ones.

## Owner actions

After login, provide the owner key on the results page. `/api/admin/export` requires the owner bearer key plus a valid game cookie. `/api/admin/clear-my-votes` (POST, same-origin) deletes only votes for the current browser and requires the same owner key; it is used to remove deployment smoke-test records.

To stop the temporary collection, disable `/api/vote` or change the campaign in a new release. Export first; retain the D1 database until the labels have been processed. Do not delete votes as part of routine redeployment.

## Editing

`sasha-game/grounded-scenes.js` is the sole active question bank. Every premise requires a `source` with either a reviewed Slack permalink/message timestamp or an explicit owner-proposed question. Distinguish hypothetical scenarios from confirmed facts. The AI privacy incident is explicitly fictional. Quotes must preserve their real speaker. Do not invent concrete incidents to fill career stages. Each answer carries three stat effects: team love, executive respect, and sanity. Resistance earns team love and costs sanity; accepting corporate nonsense earns executive respect. Rest and delegation may restore sanity without executive respect.

Question descriptions use full sentences: who brought the task, what happened, what is contradictory, and what decision is needed. The situation itself supplies the absurdity; do not depend on cryptic headlines, missing context or elaborate metaphors. Familiar words such as SERP and event are retained. Ordinary work episodes without a clear conflict are retired instead of padded with jokes. The eight team-lead questions concern hiring; the owner's critical-interview question is always included in the mobile-head stage.

`sasha-game/mechanics.js` validates provenance and effects and plays the complete fixed `timeline`, including all working and personal questions exactly once. No random pools, career selection or alternative-career restart is exposed. The five career stages remain chronological, starting with biography rather than a fictional trading question. A real farewell note is used in endings. `build.mjs` reuses only the UI/engine from the historical HTML template and discards its entire old data block. It emits `case-sources.json` for the owner's audit. Historical generic scene modules are not loaded or bundled. Run `node sasha-game/mechanics.test.mjs` after rebuilding the frontend.

Editable plaintext game sources are delivered locally in `sasha-source.zip`. Keep them private. Update scenes, rebuild the HTML and hashed registry, re-encrypt the assets with `CONTENT_KEY`, run the backend/game tests, then publish through Sites. Evidence and verbatim Slack quotes stay in source metadata and the private source catalog. They are not rendered on question, outcome or rating screens. Existing revision hashes retain evidence for compatibility. Older revisions and ratings for retired questions remain in the database/export and are excluded from the active summary; never clear them during an editorial cleanup.

Only this entrypoint and the password-protected server are updated; the unrelated GitHub Pages root site is preserved. The original, previously public game can still exist in Git history; this login protects the new deployment and its new content, not historical public copies.

Review feedback: preserve the absurd real premise and make each choice respond to it. Avoid padding with two textbook management answers. Keep choices specifically praised by the owner. Do not depict Liza Demchenko, Denis Dobrynin, Dasha Reshetova or Nastya Beneva negatively. Ratings and comments for all retired questions remain stored.

Processed owner comments are archived locally with exact question revisions before cleanup. The UI moves only exact reviewed comment fingerprints to a browser-local archive and blanks those comment fields once, preserving votes, revisions, other participants and newer notes. Existing D1 rows remain available in the owner export.

Endings are selected by the final three meters, with eight regular outcomes: all meters >=75, sanity <=20, each high-meter pair, or the dominant meter (love then executive respect break ties). Each ending displays its rule and final scores. The Revolut answer has one resumable early ending, which does not consume the interview question or change stats. Partner tags unlock the subsequent loyalty choices; the Misha path also requires sanity >=5, restored by that match. Disabled choices cannot be selected through keyboard input, the game engine or tampered saved progress. Tests cover save/restore, all four partner routes and return from the early ending.
