import { describe, expect, it } from "vitest";
import {
  extractLastInsertRowId,
  normalizeSqlForPostgres,
  splitSqlStatements,
  translateQuestionPlaceholders,
} from "@/lib/remote-db";

describe("remote db bridge helpers", () => {
  it("translates question mark placeholders without touching quoted text", () => {
    const sql = "select * from users where email = ? and note = '?' -- ?";
    expect(translateQuestionPlaceholders(sql)).toBe("select * from users where email = $1 and note = '?' -- ?");
  });

  it("normalizes sqlite date and autoincrement syntax", () => {
    const sql = "create table test (id integer primary key autoincrement, created_at datetime default current_timestamp); select datetime('now');";
    const normalized = normalizeSqlForPostgres(sql);

    expect(normalized).toContain("SERIAL PRIMARY KEY");
    expect(normalized).toContain("TIMESTAMP default current_timestamp");
    expect(normalized).toContain("CURRENT_TIMESTAMP");
  });

  it("splits multi statement exec payloads", () => {
    const statements = splitSqlStatements("create table a(id int); create table b(id int);");
    expect(statements).toEqual(["create table a(id int)", "create table b(id int)"]);
  });

  it("extracts the inserted row id from common primary key shapes", () => {
    expect(extractLastInsertRowId({ user_id: 14, email: "a" })).toBe(14);
    expect(extractLastInsertRowId({ id: 9, name: "b" })).toBe(9);
    expect(extractLastInsertRowId(undefined)).toBe(0);
  });
});
