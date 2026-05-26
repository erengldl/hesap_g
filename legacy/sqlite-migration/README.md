Bu dizin, SQLite'dan Supabase/Postgres'e tek seferlik veri aktarimi icin saklanan legacy araclari barindirir.

- `import_sqlite_to_supabase.mjs`: SQLite verisini Supabase/Postgres tablolarina batch olarak aktarir.
- `sqlite_to_postgres.py`: SQLite schema/veri ciktilari ureten yardimci exporter.

Aktif uygulama runtime'i bu araclari kullanmaz. Gerekirse elle calistirin:

```bash
node legacy/sqlite-migration/import_sqlite_to_supabase.mjs [sqlite-db-path] [batch-size]
python legacy/sqlite-migration/sqlite_to_postgres.py <database-path> <mode>
```
