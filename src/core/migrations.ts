import type Database from "better-sqlite3";

// Each entry upgrades the database by one version (tracked in PRAGMA user_version).
// Append only; never edit a migration that has shipped.
export const MIGRATIONS: string[] = [
  `
  CREATE TABLE repos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    remote TEXT,
    created_at TEXT NOT NULL
  );
  CREATE UNIQUE INDEX repos_name_unique ON repos (name);

  CREATE TABLE tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL CHECK (kind IN ('task', 'initiative')),
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    lane TEXT,
    status TEXT NOT NULL,
    priority TEXT NOT NULL,
    due_date TEXT,
    parent_id INTEGER REFERENCES tasks (id) ON DELETE SET NULL,
    repo_id INTEGER REFERENCES repos (id),
    pr_url TEXT,
    claimed_by TEXT,
    claimed_at TEXT,
    claim_expires_at TEXT,
    waiting_note TEXT,
    waiting_since TEXT,
    follow_up_days INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    resolved_at TEXT
  );
  CREATE INDEX tasks_lane_status ON tasks (lane, status);
  CREATE INDEX tasks_parent ON tasks (parent_id);

  CREATE TABLE sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    url TEXT,
    summary TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX sources_url ON sources (url);
  CREATE INDEX sources_task ON sources (task_id);

  CREATE TABLE people (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    handles TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL
  );

  CREATE TABLE task_people (
    task_id INTEGER NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    person_id INTEGER NOT NULL REFERENCES people (id) ON DELETE CASCADE,
    role TEXT,
    PRIMARY KEY (task_id, person_id)
  );

  CREATE TABLE preps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    body TEXT NOT NULL,
    author TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX preps_task ON preps (task_id);

  CREATE TABLE lane_changes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    from_lane TEXT NOT NULL,
    to_lane TEXT NOT NULL,
    reason TEXT NOT NULL,
    actor TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX lane_changes_task ON lane_changes (task_id);

  CREATE TABLE notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    author TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX notes_task ON notes (task_id);
  `,
];

export function migrate(sqlite: Database.Database): void {
  const current = sqlite.pragma("user_version", { simple: true }) as number;
  for (let version = current; version < MIGRATIONS.length; version++) {
    sqlite.transaction(() => {
      sqlite.exec(MIGRATIONS[version]);
      sqlite.pragma(`user_version = ${version + 1}`);
    })();
  }
}
