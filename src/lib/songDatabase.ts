import { Database, RunResult } from "sqlite3";

let database: Database;

export function connect(filename: string) {
  database = new Database(filename);
}

export function runQuery(sql: string, params: unknown[] = []) {
  return new Promise((resolve, reject) => {
    database.prepare(sql).run(params, function (err) {
      if (err) reject(err);
      resolve(this as RunResult);
    })
  })
}

export function insert(table: string, record: Record<string, unknown>) {
  const keys = Object.keys(record);
  const values = Object.values(record);
  return runQuery(`INSERT INTO ${table} (${keys.join(", ")}) VALUES (${keys.map(() => "?").join(", ")})`, values);
}
