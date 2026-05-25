import fs from "node:fs";
import path from "node:path";

import * as XLSX from "xlsx";

const headers = [
  "Ürün Adı",
  "SKU",
  "Barkod",
  "Kategori",
  "Maliyet",
  "Paketleme",
  "Desi",
  "Satış Fiyatı",
  "Kanallar",
  "Açıklama",
];

const workbook = XLSX.utils.book_new();
const worksheet = XLSX.utils.aoa_to_sheet([headers]);
worksheet["!cols"] = [28, 18, 18, 28, 14, 14, 12, 16, 26, 36].map((wch) => ({ wch }));
worksheet["!autofilter"] = { ref: "A1:J1" };
XLSX.utils.book_append_sheet(workbook, worksheet, "Ürünler");

const outputDir = path.join(process.cwd(), "public", "templates");
fs.mkdirSync(outputDir, { recursive: true });
XLSX.writeFile(workbook, path.join(outputDir, "urun_sablonu.xlsx"), { compression: true });
