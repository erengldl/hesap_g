import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const DATABASE_URL_ENV_KEYS = [
  "DATABASE_URL",
  "DATABASE_URL_NON_POOLING",
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL_NON_POOLING",
  "SUPABASE_DB_URL",
  "SUPABASE_POSTGRES_URL",
];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const sqliteExporterPath = path.join(repoRoot, "scripts", "sqlite_to_postgres.py");
const defaultSqlitePath = path.join(repoRoot, "Veri Merkezi", "kategoriagaci.db");

function resolveDatabaseUrl() {
  for (const key of DATABASE_URL_ENV_KEYS) {
    const value = process.env[key]?.trim();
    if (value) {
      return value;
    }
  }

  return null;
}

function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function runPython(args) {
  const candidates = [
    { command: process.env.PYTHON_BIN, args: [] },
    { command: "python", args: [] },
    { command: "py", args: ["-3"] },
  ].filter((candidate) => Boolean(candidate.command));

  for (const candidate of candidates) {
    const result = spawnSync(candidate.command, [...candidate.args, sqliteExporterPath, ...args], {
      cwd: repoRoot,
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 64,
    });

    if (result.error) {
      continue;
    }

    if (result.status !== 0) {
      throw new Error(result.stderr || result.stdout || `Python exporter failed with exit code ${result.status}.`);
    }

    return result.stdout;
  }

  throw new Error("Python bulunamadi. PYTHON_BIN ayarlayin veya python/py PATH uzerinde olsun.");
}

function readJson(sqlitePath, mode) {
  return JSON.parse(runPython([sqlitePath, mode]));
}

function readBatchSql(sqlitePath, tableName, offset, limit) {
  return runPython([sqlitePath, "batch", tableName, String(offset), String(limit)]).trim();
}

async function importTable(sql, sqlitePath, table, batchSize) {
  if (table.count <= 0) {
    return;
  }

  console.log(`\n[import] ${table.name}: ${table.count} satir`);

  for (let offset = 0; offset < table.count; offset += batchSize) {
    const batchSql = readBatchSql(sqlitePath, table.name, offset, batchSize);
    if (!batchSql) {
      continue;
    }

    await sql.unsafe(batchSql);
    const imported = Math.min(offset + batchSize, table.count);
    console.log(`[import] ${table.name}: ${imported}/${table.count}`);
  }

  const primaryKey = table.primary_key;
  if (primaryKey && /INT/i.test(primaryKey.type || "")) {
    const tableIdentifier = quoteIdentifier(table.name);
    const columnIdentifier = quoteIdentifier(primaryKey.column);
    await sql.unsafe(
      `SELECT setval(pg_get_serial_sequence('${tableIdentifier}', '${primaryKey.column}'), MAX(${columnIdentifier}), TRUE) FROM ${tableIdentifier} HAVING COUNT(*) > 0;`
    );
  }
}

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log("Usage: node scripts/import_sqlite_to_supabase.mjs [sqlite-db-path] [batch-size]");
    console.log(`Default SQLite path: ${defaultSqlitePath}`);
    return;
  }

  const sqlitePath = process.argv[2] ? path.resolve(process.argv[2]) : defaultSqlitePath;
  const batchSize = Math.max(1, Number.parseInt(process.argv[3] ?? "500", 10) || 500);
  const databaseUrl = resolveDatabaseUrl();

  if (!databaseUrl) {
    throw new Error("DATABASE_URL / POSTGRES_URL / SUPABASE_DB_URL gerekli.");
  }

  const metadata = readJson(sqlitePath, "metadata");
  const importTables = metadata.filter((table) => Number(table.count ?? 0) > 0);

  if (importTables.length === 0) {
    console.log("Import edilecek veri bulunamadi.");
    return;
  }

  console.log(`[import] kaynak: ${sqlitePath}`);
  console.log(`[import] tablo: ${importTables.length}, batch-size: ${batchSize}`);

  const sql = postgres(databaseUrl, {
    max: 1,
    idle_timeout: 0,
    prepare: false,
  });

  try {
    const truncateTargets = importTables
      .map((table) => quoteIdentifier(table.name))
      .reverse()
      .join(", ");

    await sql.begin(async (tx) => {
      await tx.unsafe(`TRUNCATE TABLE ${truncateTargets} RESTART IDENTITY CASCADE;`);

      for (const table of importTables) {
        await importTable(tx, sqlitePath, table, batchSize);
      }
    });
  } finally {
    await sql.end({ timeout: 5 });
  }

  console.log("\n[import] tamamlandi");
}

main().catch((error) => {
  console.error("[import] hata:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
