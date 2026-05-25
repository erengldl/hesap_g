# Supabase Migration

Bu klasor SQLite verisini Supabase Postgres'e tasimak icin iki artifact tutar:

- `migrations/20260525_001_initial_sqlite_migration.sql`
  Yerel SQLite semasinin Postgres karsiligi.
- `seed/20260525_001_sqlite_data.sql`
  Yerel SQLite verisinin SQL dump'i.

## Dogrudan import

Ortamda Supabase baglanti bilgisi varken:

```bash
npm run migrate:sqlite-to-supabase
```

Varsayilan kaynak veritabani:

```text
Veri Merkezi/kategoriagaci.db
```

Istege bagli olarak farkli SQLite dosyasi ve batch boyutu verilebilir:

```bash
node scripts/import_sqlite_to_supabase.mjs "C:/path/to/file.db" 500
```

Script su islemleri yapar:

1. SQLite tablo sirasini foreign key bagimliliklarina gore cikarir.
2. Hedef Supabase tablolarini `TRUNCATE ... RESTART IDENTITY CASCADE` ile temizler.
3. Veriyi batch halinde import eder.
4. Integer primary key sequence'lerini yeniden hizalar.

## Fallback

Supabase uzerine dogrudan yazma mumkun degilse ayni veri SQL Editor uzerinden su dosyayla uygulanabilir:

```text
supabase/seed/20260525_001_sqlite_data.sql
```
