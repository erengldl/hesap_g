import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let db: Database.Database;

vi.mock("@/lib/db", () => ({
  getDb: () => db,
}));

import {
  getChannelSeoContent,
  listChannelSeoProducts,
  upsertChannelSeoContents,
} from "@/lib/channel-seo/repository";

function createSchema(database: Database.Database) {
  database.exec(`
    CREATE TABLE products (
      product_id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      category_id INTEGER,
      profile_id INTEGER,
      cost REAL,
      packaging_cost REAL,
      desi REAL,
      status TEXT,
      sku TEXT,
      image_url TEXT,
      category_path TEXT,
      barcode TEXT,
      description TEXT
    );
    CREATE TABLE categories (
      category_id INTEGER PRIMARY KEY,
      name TEXT,
      path TEXT
    );
    CREATE TABLE marketplaces (
      marketplace_id INTEGER PRIMARY KEY,
      name TEXT,
      slug TEXT
    );
    CREATE TABLE product_marketplace_settings (
      setting_id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER,
      marketplace_id INTEGER,
      sale_price REAL
    );
    CREATE TABLE inventory_daily (
      inventory_id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER,
      marketplace_id INTEGER,
      inventory_date TEXT,
      stock_qty REAL,
      reserved_qty REAL
    );
    CREATE TABLE product_channel_seo_contents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id TEXT NOT NULL,
      channel TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      seo_score INTEGER,
      warnings_json TEXT,
      notes_json TEXT,
      keywords_json TEXT,
      generated_by TEXT,
      model TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      optimized_at TEXT,
      UNIQUE(product_id, channel)
    );
    CREATE TABLE product_channel_seo_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      status TEXT NOT NULL,
      total_count INTEGER NOT NULL,
      success_count INTEGER NOT NULL DEFAULT 0,
      error_count INTEGER NOT NULL DEFAULT 0,
      skipped_count INTEGER NOT NULL DEFAULT 0,
      model TEXT,
      channels_json TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT
    );
  `);
}

function seedRows(database: Database.Database) {
  database.prepare("INSERT INTO categories (category_id, name, path) VALUES (?, ?, ?)").run(1, "Elektronik", "Elektronik");
  database.prepare("INSERT INTO marketplaces (marketplace_id, name, slug) VALUES (?, ?, ?)").run(3, "Kendi Websitem", "own_website");
  database.prepare(`
    INSERT INTO products (
      product_id, name, category_id, profile_id, cost, packaging_cost, desi, status, sku, image_url, category_path, barcode, description
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(101, "Deneme Ürün A", 1, 1, 100, 12, 1, "active", "SKU-101", null, "Elektronik", "8690000000001", "Mevcut açıklama A");
  database.prepare(`
    INSERT INTO products (
      product_id, name, category_id, profile_id, cost, packaging_cost, desi, status, sku, image_url, category_path, barcode, description
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(102, "Deneme Ürün B", 1, 1, 200, 15, 2, "active", "SKU-102", null, "Elektronik", "8690000000002", "Mevcut açıklama B");
  database.prepare("INSERT INTO product_marketplace_settings (product_id, marketplace_id, sale_price) VALUES (?, ?, ?)").run(101, 3, 149.9);
  database.prepare("INSERT INTO product_marketplace_settings (product_id, marketplace_id, sale_price) VALUES (?, ?, ?)").run(102, 3, 249.9);
  database.prepare("INSERT INTO inventory_daily (product_id, marketplace_id, inventory_date, stock_qty, reserved_qty) VALUES (?, ?, ?, ?, ?)").run(101, 3, "2026-05-18", 30, 2);
  database.prepare("INSERT INTO inventory_daily (product_id, marketplace_id, inventory_date, stock_qty, reserved_qty) VALUES (?, ?, ?, ?, ?)").run(102, 3, "2026-05-18", 12, 0);
}

beforeEach(() => {
  db = new Database(":memory:");
  createSchema(db);
  seedRows(db);
});

afterEach(() => {
  db.close();
});

describe("channel seo repository", () => {
  it("upserts content by product and channel", () => {
    const saved = upsertChannelSeoContents([
      {
        productId: "101",
        channel: "my_website",
        title: "Yeni başlık",
        description: "Yeni açıklama",
        status: "draft",
        seoScore: 81,
        keywords: ["seo"],
        warnings: ["Uyarı"],
        notes: ["Not"],
        generatedBy: "gemini",
        model: "test-model",
      },
    ]);

    expect(saved).toHaveLength(1);
    expect(getChannelSeoContent("101", "my_website")?.title).toBe("Yeni başlık");
  });

  it("updates existing content and lists it with products", () => {
    upsertChannelSeoContents([
      {
        productId: "101",
        channel: "my_website",
        title: "İlk başlık",
        description: "İlk açıklama",
        status: "draft",
        seoScore: 71,
        keywords: ["ilk"],
        warnings: null,
        notes: null,
        generatedBy: "manual",
        model: null,
      },
    ]);

    upsertChannelSeoContents([
      {
        productId: "101",
        channel: "my_website",
        title: "Güncel başlık",
        description: "Güncel açıklama",
        status: "optimized",
        seoScore: 92,
        keywords: ["güncel"],
        warnings: ["Düşük bilgi"],
        notes: ["Not"],
        generatedBy: "gemini",
        model: "test-model",
      },
    ]);

    const detail = getChannelSeoContent("101", "my_website");
    expect(detail?.title).toBe("Güncel başlık");
    expect(detail?.status).toBe("optimized");

    const list = listChannelSeoProducts({
      channel: "my_website",
      page: 1,
      pageSize: 10,
      status: "optimized",
    });

    expect(list.pagination.total).toBeGreaterThanOrEqual(1);
    expect(list.items[0]?.contents.my_website?.title).toBe("Güncel başlık");
  });
});
