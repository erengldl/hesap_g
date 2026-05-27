import postgres from "postgres";
import { AsyncLocalStorage } from "node:async_hooks";
import { resolveDatabaseUrl } from "./database-url";
import { getRequestContext } from "./request-context";

// Transaction context — all queries inside db.transaction() use the transactional client
const txStore = new AsyncLocalStorage<postgres.Sql | postgres.TransactionSql>();

let sqlClient: postgres.Sql | null = null;

function getOrCreateClient(): postgres.Sql {
  if (sqlClient) return sqlClient;
  const url = resolveDatabaseUrl();
  if (!url) {
    throw new Error(
      "DATABASE_URL is required. Set SUPABASE_DB_URL (or another PostgreSQL URL env) to a Supabase PostgreSQL connection string."
    );
  }
  const configuredPoolMax = Number(process.env.PG_POOL_MAX ?? 5);
  const poolMax = Number.isFinite(configuredPoolMax) && configuredPoolMax > 0 ? configuredPoolMax : 5;
  sqlClient = postgres(url, { max: poolMax, idle_timeout: 0, prepare: false });
  return sqlClient;
}

function getSql(): postgres.Sql {
  return (txStore.getStore() as postgres.Sql | undefined) ?? getOrCreateClient();
}

async function applySessionConfig(client: postgres.Sql | postgres.TransactionSql) {
  const context = getRequestContext();
  if (!context) {
    return;
  }

  await client.unsafe(
    "SELECT set_config('app.current_auth_user_id', $1, true), set_config('app.current_app_user_id', $2, true)",
    [
      context.authUserId ?? "",
      String(context.userId),
    ] as postgres.ParameterOrJSON<never>[],
  );
}

// SQL translation: ? → $1, $2, ...
function translatePlaceholders(sql: string): string {
  let result = "";
  let placeholderIndex = 1;
  let cursor = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;

  while (cursor < sql.length) {
    const current = sql[cursor];
    const next = sql[cursor + 1];

    if (inSingleQuote) {
      result += current;
      if (current === "'" && next === "'") {
        result += "'";
        cursor += 2;
        continue;
      }
      if (current === "'") inSingleQuote = false;
      cursor += 1;
      continue;
    }

    if (inDoubleQuote) {
      result += current;
      if (current === '"' && next === '"') {
        result += '"';
        cursor += 2;
        continue;
      }
      if (current === '"') inDoubleQuote = false;
      cursor += 1;
      continue;
    }

    if (current === "'") {
      inSingleQuote = true;
      result += current;
      cursor += 1;
      continue;
    }

    if (current === '"') {
      inDoubleQuote = true;
      result += current;
      cursor += 1;
      continue;
    }

    if (current === "?") {
      result += "$" + placeholderIndex;
      placeholderIndex += 1;
      cursor += 1;
      continue;
    }

    result += current;
    cursor += 1;
  }

  return result;
}

const INSERT_REGEX = /^\s*INSERT\s+/i;

function ensureReturningStar(sql: string): string {
  if (!INSERT_REGEX.test(sql)) return sql;
  if (/\bRETURNING\b/i.test(sql)) return sql;
  return sql.replace(/;\s*$/, "") + " RETURNING *";
}

function isFiniteNumber(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value);
}

function extractLastInsertRowId(row: Record<string, unknown> | null | undefined): number {
  if (!row) return 0;

  const preferredKeys = [
    "id", "user_id", "product_id", "order_id", "order_item_id",
    "expense_id", "sync_id", "metric_id", "inventory_id",
    "credential_id", "forecast_id", "run_id", "member_id",
    "organization_id", "audit_id", "job_id",
  ];

  for (const key of preferredKeys) {
    if (Object.prototype.hasOwnProperty.call(row, key) && isFiniteNumber(row[key])) {
      return Number(row[key]);
    }
  }

  for (const [key, value] of Object.entries(row)) {
    if ((key === "id" || key.endsWith("_id")) && isFiniteNumber(value)) {
      return Number(value);
    }
  }

  for (const value of Object.values(row)) {
    if (isFiniteNumber(value)) return Number(value);
  }

  return 0;
}

function normalizeParams(params: unknown[]): unknown[] {
  return params.map((value) => (typeof value === "undefined" ? null : value));
}

class PgStatement<T = Record<string, unknown>> {
  constructor(private rawSql: string) {}

  private async execute(mode: "all" | "get" | "run", params: unknown[]) {
    const client = getSql();
    await applySessionConfig(client);
    const safeParams = normalizeParams(params);
    let sql = translatePlaceholders(this.rawSql);

    if (mode === "run") {
      sql = ensureReturningStar(sql);
    }

    const result = await client.unsafe(sql, safeParams as postgres.ParameterOrJSON<never>[]);
    const rows = Array.isArray(result) ? result : [];

    if (mode === "get") {
      return { row: (rows[0] as T) ?? null };
    }

    if (mode === "all") {
      return { rows: rows as T[] };
    }

    return {
      changes: result.count ?? rows.length,
      lastInsertRowid: extractLastInsertRowId(rows[0] as Record<string, unknown>),
      count: result.count ?? rows.length,
      rows: rows as T[],
    };
  }

  async all(...params: unknown[]): Promise<T[]> {
    const result = await this.execute("all", params);
    return (result as { rows: T[] }).rows;
  }

  async get(...params: unknown[]): Promise<T | undefined> {
    const result = await this.execute("get", params);
    const row = (result as { row: T | null }).row;
    return row ?? undefined;
  }

  async run(...params: unknown[]): Promise<{ changes: number; lastInsertRowid: number }> {
    const result = await this.execute("run", params);
    const r = result as { changes: number; lastInsertRowid: number };
    return { changes: r.changes, lastInsertRowid: r.lastInsertRowid };
  }
}

export interface AppDatabase {
  prepare<T = Record<string, unknown>>(sql: string): PgStatement<T>;
  exec(sql: string): Promise<void>;
  transaction<T>(fn: () => Promise<T>): Promise<T>;
}

class PgDatabase implements AppDatabase {
  prepare<T = Record<string, unknown>>(sql: string): PgStatement<T> {
    return new PgStatement<T>(sql);
  }

  async exec(sql: string): Promise<void> {
    const client = getSql();
    await applySessionConfig(client);
    const translated = translatePlaceholders(sql);
    await client.unsafe(translated);
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    const client = getSql();
    return client.begin(async (tx) => {
      await applySessionConfig(tx);
      return txStore.run(tx, fn);
    }) as Promise<T>;
  }
}

let db: PgDatabase | null = null;

export function getDb(): PgDatabase {
  if (db) return db;
  db = new PgDatabase();
  return db;
}

export async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  return getDb().prepare<T>(sql).all(...params);
}

export async function getOne<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  const result = await getDb().prepare<T>(sql).get(...params);
  return result ?? null;
}

export function getDatabaseMode(): string {
  return "supabase-postgres";
}
