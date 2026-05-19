import { spawnSync } from "node:child_process";
import "postgres";

export interface RemoteStatementResult<T = Record<string, unknown>> {
  rows: T[];
  count: number;
  changes: number;
  lastInsertRowid: number;
}

export interface RemoteStatementLike {
  all(...params: unknown[]): unknown[];
  get(...params: unknown[]): unknown | undefined;
  run(...params: unknown[]): RemoteStatementResult;
}

export interface RemoteDatabaseLike {
  __remote: true;
  prepare(sql: string): RemoteStatementLike;
  exec(sql: string): void;
  pragma(_sql: string): void;
  transaction<T extends (...args: any[]) => any>(fn: T): T;
}

type RemoteMode = "all" | "get" | "run" | "exec";

type BridgeResponse = {
  rows?: Record<string, unknown>[];
  count?: number;
  changes?: number;
  lastInsertRowid?: number;
  row?: Record<string, unknown> | null;
};

type BridgePayload = {
  mode: RemoteMode;
  sql: string;
  params?: unknown[];
};

const bridgeTimeoutMs = Number(process.env.REMOTE_DB_BRIDGE_TIMEOUT_MS ?? 5000);
let bridgeUnavailable = false;
let bridgeUnavailableMessage: string | null = null;

function isFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value);
}

export function translateQuestionPlaceholders(sql: string) {
  let result = "";
  let placeholderIndex = 1;
  let cursor = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inLineComment = false;
  let inBlockComment = false;

  while (cursor < sql.length) {
    const current = sql[cursor];
    const next = sql[cursor + 1];

    if (inLineComment) {
      result += current;
      if (current === "\n") {
        inLineComment = false;
      }
      cursor += 1;
      continue;
    }

    if (inBlockComment) {
      result += current;
      if (current === "*" && next === "/") {
        result += "/";
        cursor += 2;
        inBlockComment = false;
        continue;
      }
      cursor += 1;
      continue;
    }

    if (inSingleQuote) {
      result += current;
      if (current === "'" && next === "'") {
        result += "'";
        cursor += 2;
        continue;
      }
      if (current === "'") {
        inSingleQuote = false;
      }
      cursor += 1;
      continue;
    }

    if (inDoubleQuote) {
      result += current;
      if (current === "\"" && next === "\"") {
        result += "\"";
        cursor += 2;
        continue;
      }
      if (current === "\"") {
        inDoubleQuote = false;
      }
      cursor += 1;
      continue;
    }

    if (current === "-" && next === "-") {
      result += current + next;
      cursor += 2;
      inLineComment = true;
      continue;
    }

    if (current === "/" && next === "*") {
      result += current + next;
      cursor += 2;
      inBlockComment = true;
      continue;
    }

    if (current === "'") {
      inSingleQuote = true;
      result += current;
      cursor += 1;
      continue;
    }

    if (current === "\"") {
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

export function normalizeSqlForPostgres(sql: string) {
  let normalized = sql;

  normalized = normalized.replace(/\binsert\s+or\s+ignore\s+into\b/gi, "INSERT INTO");
  normalized = normalized.replace(/\bdatetime\(\s*'now'\s*\)/gi, "CURRENT_TIMESTAMP");
  normalized = normalized.replace(/\bdate\(\s*'now'\s*,\s*([^)]+?)\s*\)/gi, "(CURRENT_DATE + ($1)::interval)::date");
  normalized = normalized.replace(/\binteger\s+primary\s+key\s+autoincrement\b/gi, "SERIAL PRIMARY KEY");
  normalized = normalized.replace(/\bdatetime\b/gi, "TIMESTAMP");

  return normalized;
}

export function splitSqlStatements(sql: string) {
  const statements: string[] = [];
  let currentStatement = "";
  let cursor = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inLineComment = false;
  let inBlockComment = false;

  while (cursor < sql.length) {
    const current = sql[cursor];
    const next = sql[cursor + 1];

    if (inLineComment) {
      currentStatement += current;
      if (current === "\n") {
        inLineComment = false;
      }
      cursor += 1;
      continue;
    }

    if (inBlockComment) {
      currentStatement += current;
      if (current === "*" && next === "/") {
        currentStatement += "/";
        cursor += 2;
        inBlockComment = false;
        continue;
      }
      cursor += 1;
      continue;
    }

    if (inSingleQuote) {
      currentStatement += current;
      if (current === "'" && next === "'") {
        currentStatement += "'";
        cursor += 2;
        continue;
      }
      if (current === "'") {
        inSingleQuote = false;
      }
      cursor += 1;
      continue;
    }

    if (inDoubleQuote) {
      currentStatement += current;
      if (current === "\"" && next === "\"") {
        currentStatement += "\"";
        cursor += 2;
        continue;
      }
      if (current === "\"") {
        inDoubleQuote = false;
      }
      cursor += 1;
      continue;
    }

    if (current === "-" && next === "-") {
      currentStatement += current + next;
      cursor += 2;
      inLineComment = true;
      continue;
    }

    if (current === "/" && next === "*") {
      currentStatement += current + next;
      cursor += 2;
      inBlockComment = true;
      continue;
    }

    if (current === "'") {
      inSingleQuote = true;
      currentStatement += current;
      cursor += 1;
      continue;
    }

    if (current === "\"") {
      inDoubleQuote = true;
      currentStatement += current;
      cursor += 1;
      continue;
    }

    if (current === ";") {
      const trimmed = currentStatement.trim();
      if (trimmed.length > 0) {
        statements.push(trimmed);
      }
      currentStatement = "";
      cursor += 1;
      continue;
    }

    currentStatement += current;
    cursor += 1;
  }

  const tail = currentStatement.trim();
  if (tail.length > 0) {
    statements.push(tail);
  }

  return statements;
}

export function extractLastInsertRowId(row: Record<string, unknown> | null | undefined) {
  if (!row) {
    return 0;
  }

  const preferredKeys = [
    "id",
    "user_id",
    "product_id",
    "order_id",
    "order_item_id",
    "expense_id",
    "sync_id",
    "metric_id",
    "inventory_id",
    "credential_id",
    "forecast_id",
    "run_id",
    "member_id",
    "organization_id",
    "audit_id",
    "job_id",
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
    if (isFiniteNumber(value)) {
      return Number(value);
    }
  }

  return 0;
}

function buildBridgeSource() {
  return String.raw`
import postgres from 'postgres';

const translateQuestionPlaceholders = ${translateQuestionPlaceholders.toString()};
const normalizeSqlForPostgres = ${normalizeSqlForPostgres.toString()};
const splitSqlStatements = ${splitSqlStatements.toString()};
const extractLastInsertRowId = ${extractLastInsertRowId.toString()};

async function readAllStdin() {
  process.stdin.setEncoding('utf8');
  let input = '';
  for await (const chunk of process.stdin) {
    input += chunk;
  }
  return input;
}

function trimTrailingSemicolon(text) {
  return text.replace(/;\s*$/, '');
}

function ensureReturningStar(text) {
  if (!/^\s*insert\b/i.test(text) || /\breturning\b/i.test(text)) {
    return text;
  }

  return trimTrailingSemicolon(text) + ' RETURNING *';
}

function extractPragmaTableName(text) {
  const match = text.match(/^\s*PRAGMA\s+table_info\s*\(\s*([^)]+?)\s*\)\s*;?\s*$/i);
  if (!match) {
    return null;
  }

  return match[1].replace(/^["'\[]|["'\]]$/g, '');
}

async function executeSingle(sqlClient, rawSql, params, mode) {
  const trimmed = String(rawSql || '').trim();
  const safeParams = Array.isArray(params)
    ? params.map((value) => (typeof value === 'undefined' ? null : value))
    : [];

  if (trimmed.length === 0) {
    return { rows: [], count: 0, changes: 0, lastInsertRowid: 0 };
  }

  if (/^\s*PRAGMA\s+foreign_keys\s*=\s*ON\b/i.test(trimmed)) {
    return { rows: [], count: 0, changes: 0, lastInsertRowid: 0 };
  }

  const pragmaTableName = extractPragmaTableName(trimmed);
  if (pragmaTableName) {
    const rows = await sqlClient.unsafe(
      'select column_name as name from information_schema.columns where table_schema = $1 and table_name = $2 order by ordinal_position',
      ['public', pragmaTableName],
      { prepare: false }
    );

    return {
      rows: Array.isArray(rows) ? rows : [],
      count: Number(rows?.count ?? rows?.length ?? 0),
      changes: Number(rows?.count ?? rows?.length ?? 0),
      lastInsertRowid: 0,
    };
  }

  if (/sqlite_master/i.test(trimmed)) {
    const tableName = String(safeParams[0] ?? '').trim();
    const rows = await sqlClient.unsafe('select to_regclass($1)::text as name', [tableName], { prepare: false });
    return {
      rows: Array.isArray(rows) ? rows : [],
      count: Number(rows?.count ?? rows?.length ?? 0),
      changes: Number(rows?.count ?? rows?.length ?? 0),
      lastInsertRowid: 0,
    };
  }

  let normalized = normalizeSqlForPostgres(trimmed);
  normalized = translateQuestionPlaceholders(normalized);

  if (mode === 'exec' && normalized.indexOf(';') !== -1) {
    const statements = splitSqlStatements(normalized);
    let lastResult = { rows: [], count: 0, changes: 0, lastInsertRowid: 0 };

    for (const statement of statements) {
      lastResult = await executeSingle(sqlClient, statement, [], 'exec');
    }

    return lastResult;
  }

  const statement = mode === 'run' ? ensureReturningStar(normalized) : normalized;
  const result = await sqlClient.unsafe(statement, safeParams, { prepare: false });
  const rows = Array.isArray(result) ? result : [];
  const count = Number(result?.count ?? rows.length ?? 0);

  if (mode === 'get') {
    return {
      rows,
      count,
      changes: count,
      lastInsertRowid: 0,
    };
  }

  if (mode === 'all') {
    return {
      rows,
      count,
      changes: count,
      lastInsertRowid: 0,
    };
  }

  return {
    rows,
    count,
    changes: count,
    lastInsertRowid: extractLastInsertRowId(rows[0]),
  };
}

const connectionString =
  process.env.DATABASE_URL ||
  process.env.DATABASE_URL_NON_POOLING ||
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.SUPABASE_DB_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.SUPABASE_POSTGRES_URL;

if (!connectionString) {
  throw new Error('Missing DATABASE_URL');
}

const sqlClient = postgres(connectionString, {
  max: 1,
  prepare: false,
  idle_timeout: 0,
});

const payload = JSON.parse(await readAllStdin() || '{}');
const mode = payload.mode || 'all';
const response = await executeSingle(sqlClient, payload.sql || '', payload.params || [], mode);

if (mode === 'get') {
  process.stdout.write(JSON.stringify({ row: response.rows[0] || null }));
} else if (mode === 'all') {
  process.stdout.write(JSON.stringify({ rows: response.rows }));
} else if (mode === 'run') {
  process.stdout.write(JSON.stringify({
    rows: response.rows,
    count: response.count,
    changes: response.changes,
    lastInsertRowid: response.lastInsertRowid
  }));
} else {
  process.stdout.write(JSON.stringify({
    rows: response.rows,
    count: response.count,
    changes: response.changes,
    lastInsertRowid: response.lastInsertRowid
  }));
}
`;
}

function runBridge(payload: BridgePayload): BridgeResponse {
  if (bridgeUnavailable) {
    throw new Error(bridgeUnavailableMessage ?? "Remote database bridge unavailable");
  }

  const bridgeSource = buildBridgeSource();
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", bridgeSource],
    {
      input: JSON.stringify(payload),
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
      env: process.env,
      timeout: bridgeTimeoutMs,
      killSignal: "SIGKILL",
    }
  );

  if (result.error) {
    const message = String(result.error.message || result.stderr || result.stdout || "Remote database bridge failed").trim();
    if (process.env.NODE_ENV === "production") {
      bridgeUnavailable = true;
      bridgeUnavailableMessage = message || "Remote database bridge failed";
    }
    throw new Error(message || "Remote database bridge failed");
  }

  if (result.status !== 0) {
    const message = String(result.stderr || result.stdout || "Remote database bridge failed").trim();
    if (process.env.NODE_ENV === "production") {
      bridgeUnavailable = true;
      bridgeUnavailableMessage = message || "Remote database bridge failed";
    }
    throw new Error(message || "Remote database bridge failed");
  }

  const output = String(result.stdout || "").trim();
  if (!output) {
    return {};
  }

  return JSON.parse(output) as BridgeResponse;
}

class RemoteStatement implements RemoteStatementLike {
  constructor(private readonly sql: string) {}

  all(...params: unknown[]) {
    const response = runBridge({ mode: "all", sql: this.sql, params });
    return Array.isArray(response.rows) ? response.rows : [];
  }

  get(...params: unknown[]) {
    const response = runBridge({ mode: "get", sql: this.sql, params });
    return response.row ?? (Array.isArray(response.rows) ? response.rows[0] : undefined);
  }

  run(...params: unknown[]) {
    const response = runBridge({ mode: "run", sql: this.sql, params });
    return {
      changes: Number(response.changes ?? response.count ?? 0),
      count: Number(response.count ?? response.changes ?? 0),
      lastInsertRowid: Number(response.lastInsertRowid ?? 0),
      rows: Array.isArray(response.rows) ? response.rows : [],
    };
  }
}

class RemoteDatabase implements RemoteDatabaseLike {
  __remote = true as const;

  prepare(sql: string) {
    return new RemoteStatement(sql);
  }

  exec(sql: string) {
    runBridge({ mode: "exec", sql, params: [] });
  }

  pragma(_sql: string) {
    return;
  }

  transaction<T extends (...args: any[]) => any>(fn: T) {
    return fn;
  }
}

export function isRemoteDatabase(value: unknown): value is RemoteDatabaseLike {
  return Boolean(value && typeof value === "object" && (value as RemoteDatabaseLike).__remote === true);
}

export function createRemoteDatabase() {
  return new RemoteDatabase();
}
