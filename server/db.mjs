import { tables } from "./tables.mjs";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
export function openDatabase(dir) {
  mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(resolve(dir, "samplanering.sqlite"));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
${tables}
    PRAGMA user_version=1;`);
  return db;
}
