# Hesap G Marketplace Integration Service

FastAPI tabanlı Trendyol ve Hepsiburada çift yönlü entegrasyon servisi.

## Ne yapar

- `marketplace_credentials` tablosunda API anahtarlarını Fernet ile şifreli saklar.
- Trendyol siparişlerini `getShipmentPackagesStream` ile cursor tabanlı olarak çeker.
- Hepsiburada siparişlerini sipariş listeleme API'si ile çeker.
- Trendyol settlement / cargo invoice verilerinden gerçek komisyon ve kargo maliyetlerini `cost_results` içine yazar.
- Hepsiburada muhasebe servisinden gelen finansal kayıtlarla `cost_results` snapshot'larını günceller.
- Trendyol `updatePriceAndInventory` ve Hepsiburada `price-uploads` / `stock-uploads` ile fiyat ve stok yayınlar.
- 429 / 5xx / timeout durumlarında `tenacity` ile exponential backoff uygular.

## Varsayılan veritabanı

Ana SQLite dosyası:

`../../Veri Merkezi/kategoriagaci.db`

## Tek Seferlik Migration

- `migrations/20260516_demand_forecasts_horizon.sql`
- Bu dosya `demand_forecasts` tablosunu final şemaya taşır ve horizon-aware unique index'i kurar.
- `app/database.py` ve `lib/db.ts` içindeki startup bootstrap, yeni veritabanları için aynı şemayı korur.
- Çalıştırmak için: `python scripts/apply-demand-forecast-migration.py`

## Gerekli environment değişkenleri

- `MARKETPLACE_CREDENTIALS_FERNET_KEY`
- `DATABASE_URL` (opsiyonel)
- `MARKETPLACE_INTEGRATION_SERVICE_URL` (Next.js tarafındaki proxy için)
- `MARKETPLACE_INTEGRATION_SERVICE_TOKEN`
- `TRENDYOL_API_BASE_URL` (opsiyonel, varsayılan `https://apigw.trendyol.com`)
- `HEPSIBURADA_ORDER_BASE_URL` (opsiyonel, varsayılan `https://oms-external-sit.hepsiburada.com`)
- `HEPSIBURADA_LISTING_BASE_URL` (opsiyonel, varsayılan `https://listing-external-sit.hepsiburada.com`)
- `HEPSIBURADA_FINANCE_BASE_URL` (opsiyonel, varsayılan `https://mpfinance-external-sit.hepsiburada.com`)

## Kurulum

```bash
cd backend/marketplace-integration-service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

## Çalıştırma

```bash
uvicorn app.main:app --reload --port 8003
```

## Endpointler

- `GET /health`
- `GET /api/v1/integrations/status`
- `PUT /api/v1/integrations/credentials`
- `POST /api/v1/integrations/sync`
- `POST /api/v1/integrations/prices`
