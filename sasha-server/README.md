# Саша, есть минутка? — защищённая игра

The released game contains 35 decisions in one ordered timeline. The public GitHub Pages entrypoint redirects to the password-protected Site. HTML, scripts and images are served only after login; game assets in the source repository are encrypted with AES-256-GCM.

## Release state

The funny/not-funny controls, comments, review links, review/results screens and tester shortcut have been removed from the delivered client. Legacy URLs using review, results or start query parameters redirect to the ordinary game. There is no URL or client method to skip the introductory board-game joke.

The old voting JavaScript and CSS are not bundled or served. The vote submission endpoint and former test-vote deletion endpoint return HTTP 410, including for stale clients that are still open. Existing votes, comments, campaign IDs and content revisions remain in D1 without deletion or migration. The owner-only read endpoint /api/admin/export remains available with a valid game session and owner key so archived labels can still be processed. No results interface is exposed in the game.

Login keeps the existing shared username and password. The review-only nickname field is gone. Logout, restart at the top of the page, restart at the end, saved progress and the complete introductory joke remain available. The game save key and timeline have not changed in this release.

## Game

The first question is the owner-proposed fictional NVIDIA story, followed by the existing question order. Career mapping, choices, stats and ending rules are unchanged by this release. The deliberate padel-partner dependency is retained. The Revolut early ending can be resumed.

Breaks remain after questions 8, 16 and 24: a rigged ten-sector wheel, a 30-second banner-hammer game on the supplied app screenshot, and a 40-second snowboard runner with collectible brains. Both action games share 19 supplied meme images. The wheel cycles the three gag prizes, includes the near-miss animation and celebrates with confetti. Minigame scores do not affect the three meters.

## Hosting and data

The Cloudflare Worker is built to dist/server/index.js. The existing .openai/hosting.json Site ID and D1 binding DB are retained. D1 stores login throttling and archived review labels. Migrations live under drizzle; do not recreate tables in request handlers or delete the existing labels during publication.

Runtime values LOGIN_USERNAME, LOGIN_SALT, LOGIN_PASSWORD_HASH, SESSION_SECRET, CONTENT_KEY, ADMIN_SHA256 and the rotated CONTENT_KEY_V3 remain secret. Asset decryption prefers CONTENT_KEY_V3, then CONTENT_KEY_V2, then CONTENT_KEY. Never commit plaintext credentials, the owner key, or plaintext game content to the public mirror.

Authentication uses salted PBKDF2-SHA256, HMAC-signed HttpOnly Secure SameSite=Strict sessions, login throttling and Origin checks. The current audience and login requirements are preserved.

## Editing and verification

sasha-game/grounded-scenes.js remains the sole active question bank. Preserve supplied wording, real source attribution, the distinction between real and owner-proposed fictional incidents, and the requested treatment of named colleagues. Evidence is not rendered in the game. Source metadata and historical feedback stay in the private local source bundle.

Rebuild the frontend, run its mechanics and release tests, encrypt the current assets with the existing runtime content key, build the Worker and run its backend tests. Backend tests verify that new votes are rejected while archived labels remain readable only by the owner. Publish through Sites and mirror only the encrypted server source to GitHub. Preserve unrelated GitHub Pages files.
