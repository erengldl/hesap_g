import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const DATABASE_URL_ENV_KEYS = [
  "SUPABASE_DB_URL",
  "SUPABASE_POSTGRES_URL",
  "DATABASE_URL_NON_POOLING",
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL_NON_POOLING",
  "DATABASE_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL",
];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const sqliteExporterPath = path.join(__dirname, "sqlite_to_postgres.py");
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
    console.log("Usage: node legacy/sqlite-migration/import_sqlite_to_supabase.mjs [sqlite-db-path] [batch-size]");
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

  // Ensure "users" is imported first to avoid RLS/trigger issues and allow merging
  const usersIndex = importTables.findIndex((t) => t.name === "users");
  if (usersIndex !== -1) {
    const [usersTable] = importTables.splice(usersIndex, 1);
    importTables.unshift(usersTable);
  }

  console.log(`[import] kaynak: ${sqlitePath}`);
  console.log(`[import] tablo: ${importTables.length}, batch-size: ${batchSize}`);

  const sql = postgres(databaseUrl, {
    max: 1,
    idle_timeout: 0,
    prepare: false,
  });

  try {
    // Save existing user mappings with auth_user_id to restore them after truncate
    const existingUsers = await sql`SELECT * FROM public.users WHERE auth_user_id IS NOT NULL`;
    console.log(`[import] Saved ${existingUsers.length} existing users with auth_user_id.`);
    const defaultAuthUser = existingUsers.find((u) => u.auth_user_id)?.auth_user_id;

    const truncateTargets = importTables
      .map((table) => quoteIdentifier(table.name))
      .reverse()
      .join(", ");

    await sql.begin(async (tx) => {
      if (defaultAuthUser) {
        console.log(`[import] Setting session app.current_auth_user_id to ${defaultAuthUser}`);
        await tx`SELECT set_config('app.current_auth_user_id', ${defaultAuthUser}, true)`;
      }

      await tx.unsafe(`TRUNCATE TABLE ${truncateTargets} RESTART IDENTITY CASCADE;`);

      for (const table of importTables) {
        await importTable(tx, sqlitePath, table, batchSize);

        if (table.name === "users" && existingUsers.length > 0) {
          console.log(`[import] Restoring auth_user_id mapping for ${existingUsers.length} users...`);
          for (const u of existingUsers) {
            const match = await tx`SELECT user_id FROM public.users WHERE email = ${u.email}`;
            if (match.length > 0) {
              await tx`UPDATE public.users SET auth_user_id = ${u.auth_user_id} WHERE email = ${u.email}`;
              console.log(`[import] Updated ${u.email} auth_user_id to ${u.auth_user_id}`);
            } else {
              const columns = Object.keys(u).filter((key) => u[key] !== undefined && u[key] !== null);
              const colNames = columns.map((c) => quoteIdentifier(c)).join(", ");
              const placeholders = columns.map((_, idx) => `$${idx + 1}`).join(", ");
              const values = columns.map((c) => u[c]);
              await tx.unsafe(
                `INSERT INTO public.users (${colNames}) VALUES (${placeholders})`,
                values
              );
              console.log(`[import] Restored user ${u.email} (auth_user_id: ${u.auth_user_id})`);
            }
          }
          // Sync sequence for users table
          await tx.unsafe(
            `SELECT setval(pg_get_serial_sequence('users', 'user_id'), MAX(user_id), TRUE) FROM public.users HAVING COUNT(*) > 0;`
          );
        }
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
