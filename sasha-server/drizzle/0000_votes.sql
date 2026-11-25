CREATE TABLE votes (
 campaign TEXT NOT NULL,
 voter_id TEXT NOT NULL,
 question_id TEXT NOT NULL,
 revision TEXT NOT NULL,
 vote INTEGER NOT NULL CHECK (vote IN (0,1)),
 name TEXT NOT NULL DEFAULT '',
 comment TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 PRIMARY KEY (campaign,voter_id,question_id,revision)
);
--> statement-breakpoint
CREATE INDEX votes_recent ON votes(campaign,voter_id,updated_at);
--> statement-breakpoint
CREATE TABLE login_limits (client TEXT PRIMARY KEY NOT NULL, window INTEGER NOT NULL, attempts INTEGER NOT NULL);
