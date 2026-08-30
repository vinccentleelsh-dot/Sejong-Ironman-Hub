// dev.db 전체를 SQL 덤프(.sql)로 뽑아내는 일회성 스크립트 — sqlite3 CLI가 없는 환경에서도
// (이미 설치된) better-sqlite3만으로 `sqlite3 .dump`와 동등한 결과를 만들기 위함.
// 용도: Turso DB 생성 시 `turso db create --from-dump <이 파일>` 로 그대로 이관.
const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");

const dbPath = process.argv[2] ?? path.join(__dirname, "..", "dev.db");
const outPath = process.argv[3] ?? path.join(__dirname, "..", "dev-dump.sql");

const db = new Database(dbPath, { readonly: true });

function sqlQuote(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return String(v);
  if (Buffer.isBuffer(v)) return "X'" + v.toString("hex") + "'";
  // 문자열 — 작은따옴표 이스케이프
  return "'" + String(v).replace(/'/g, "''") + "'";
}

const lines = [];
lines.push("PRAGMA foreign_keys=OFF;");
lines.push("BEGIN TRANSACTION;");

const objects = db
  .prepare(
    `SELECT type, name, sql FROM sqlite_master
     WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'
     ORDER BY (type = 'table') DESC, rootpage`
  )
  .all();

const tables = objects.filter((o) => o.type === "table");
const others = objects.filter((o) => o.type !== "table"); // index, trigger, view 등

for (const t of tables) {
  lines.push(t.sql + ";");
}

for (const t of tables) {
  const cols = db.prepare(`PRAGMA table_info(${JSON.stringify(t.name).replace(/"/g, '"')})`).all();
  const colNames = cols.map((c) => c.name);
  const rows = db.prepare(`SELECT * FROM "${t.name}"`).all();
  for (const row of rows) {
    const values = colNames.map((c) => sqlQuote(row[c]));
    lines.push(
      `INSERT INTO "${t.name}" (${colNames.map((c) => `"${c}"`).join(",")}) VALUES (${values.join(",")});`
    );
  }
}

for (const o of others) {
  lines.push(o.sql + ";");
}

lines.push("COMMIT;");

fs.writeFileSync(outPath, lines.join("\n"), "utf8");
console.log(`덤프 완료: ${outPath} (${lines.length}줄, 테이블 ${tables.length}개)`);
db.close();
