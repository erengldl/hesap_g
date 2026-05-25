import * as XLSX from "xlsx";

import type { Product, ProductUpsertInput } from "@/lib/types";

export const PRODUCT_EXCEL_HEADERS = [
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
] as const;

type ProductExcelHeader = (typeof PRODUCT_EXCEL_HEADERS)[number];

export type SalesRow = {
  order_id: number;
  order_date: string;
  status: string | null;
  external_order_number: string | null;
  external_package_number: string | null;
  marketplace_name: string | null;
  marketplace_slug: string | null;
  product_id: number | null;
  product_name: string | null;
  product_sku: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
};

export type ExcelRowError = {
  rowNumber: number;
  field?: string;
  message: string;
};

export type ParsedProductExcelRow = ProductUpsertInput & {
  rowNumber: number;
  rawChannels: string[];
};

export type ProductExcelParseResult = {
  headers: string[];
  products: ParsedProductExcelRow[];
  preview: ParsedProductExcelRow[];
  errors: ExcelRowError[];
  totalRows: number;
  validRows: number;
  skippedRows: number;
};

const PRODUCT_HEADER_TO_FIELD: Record<ProductExcelHeader, keyof ProductUpsertInput | "description"> = {
  "Ürün Adı": "name",
  SKU: "sku",
  Barkod: "barcode",
  Kategori: "category_path",
  Maliyet: "cost",
  Paketleme: "packaging_cost",
  Desi: "desi",
  "Satış Fiyatı": "sale_price",
  Kanallar: "active_channels",
  Açıklama: "description",
};

const PRODUCT_EXPORT_WIDTHS = [28, 18, 18, 28, 14, 14, 12, 16, 26, 36];
const SALES_EXPORT_WIDTHS = [14, 18, 22, 16, 22, 22, 12, 14, 14, 14];

function sanitizeCellValue(value: unknown) {
  return String(value ?? "").replace(/\uFEFF/g, "").trim();
}

function simplifyText(value: string) {
  return sanitizeCellValue(value)
    .toLocaleLowerCase("tr-TR")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/\s+/g, " ");
}

function getTodayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function ensureBrowserDownload() {
  if (typeof window === "undefined") {
    throw new Error("Excel indirme sadece istemci tarafında kullanılabilir.");
  }
}

function channelLabel(channel: string) {
  switch (channel) {
    case "trendyol":
      return "Trendyol";
    case "hepsiburada":
      return "Hepsiburada";
    case "my_website":
      return "Kendi Websitem";
    default:
      return channel;
  }
}

function parseLocalizedNumber(value: unknown) {
  const text = sanitizeCellValue(value);
  if (!text) {
    return null;
  }

  const cleaned = text.replace(/[^\d,.\-]/g, "");
  if (!cleaned) {
    return null;
  }

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  let normalized = cleaned;

  if (lastComma > lastDot) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma && lastComma !== -1) {
    normalized = cleaned.replace(/,/g, "");
  } else if (lastComma !== -1) {
    normalized = cleaned.replace(",", ".");
  } else {
    const dotMatches = cleaned.match(/\./g) ?? [];
    if (dotMatches.length > 1) {
      const separatorIndex = cleaned.lastIndexOf(".");
      normalized = `${cleaned.slice(0, separatorIndex).replace(/\./g, "")}${cleaned.slice(separatorIndex)}`;
    }
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseChannels(rawValue: unknown) {
  const tokens = sanitizeCellValue(rawValue)
    .split(/[,\n;/|]+/)
    .map((token) => simplifyText(token))
    .filter(Boolean);

  const channels = new Set<ProductUpsertInput["active_channels"][number]>();
  const invalidTokens: string[] = [];

  for (const token of tokens) {
    if (token === "trendyol") {
      channels.add("trendyol");
      continue;
    }

    if (token === "hepsiburada" || token === "hepsi burada") {
      channels.add("hepsiburada");
      continue;
    }

    if (
      token === "my_website" ||
      token === "own_website" ||
      token === "own website" ||
      token === "website" ||
      token === "web site" ||
      token === "kendi websitesi" ||
      token === "kendi websitem" ||
      token === "kendi site" ||
      token === "kendi sitem"
    ) {
      channels.add("my_website");
      continue;
    }

    invalidTokens.push(token);
  }

  return {
    channels: Array.from(channels),
    invalidTokens,
    rawChannels: tokens,
  };
}

function buildWorksheet(rows: Array<Array<string | number>>, widths: number[]) {
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet["!cols"] = widths.map((wch) => ({ wch }));
  if (rows.length > 0 && rows[0].length > 0) {
    worksheet["!autofilter"] = {
      ref: `A1:${XLSX.utils.encode_cell({ c: rows[0].length - 1, r: rows.length - 1 })}`,
    };
  }
  return worksheet;
}

function stripParseMetadata(product: ParsedProductExcelRow): ProductUpsertInput {
  return {
    name: product.name,
    sku: product.sku,
    barcode: product.barcode,
    image_url: product.image_url,
    category_id: product.category_id,
    category_path: product.category_path,
    description: product.description,
    cost: product.cost,
    packaging_cost: product.packaging_cost,
    desi: product.desi,
    sale_price: product.sale_price,
    active_channels: [...product.active_channels],
    status: product.status,
  };
}

async function readExcelFileBuffer(file: File) {
  if (typeof file.arrayBuffer === "function") {
    return file.arrayBuffer();
  }

  return await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error("Excel dosyası okunamadı."));
    reader.readAsArrayBuffer(file);
  });
}

function getHeaderIndexMap(headers: string[]) {
  const indexMap = new Map<keyof ProductUpsertInput | "description", number>();
  const entries = Object.entries(PRODUCT_HEADER_TO_FIELD) as Array<[ProductExcelHeader, keyof ProductUpsertInput | "description"]>;

  for (const [header, field] of entries) {
    const headerIndex = headers.findIndex((currentHeader) => simplifyText(currentHeader) === simplifyText(header));
    if (headerIndex >= 0) {
      indexMap.set(field, headerIndex);
    }
  }

  return indexMap;
}

export function validateExcelHeaders(headers: string[]) {
  const normalizedHeaders = headers.map((header) => simplifyText(header));
  const missingHeaders = PRODUCT_EXCEL_HEADERS.filter((header) => !normalizedHeaders.includes(simplifyText(header)));
  const duplicateHeaders = headers.filter((header, index) => {
    const normalizedHeader = simplifyText(header);
    return normalizedHeader.length > 0 && normalizedHeaders.indexOf(normalizedHeader) !== index;
  });
  const errors: string[] = [];

  if (headers.length === 0) {
    errors.push("Başlık satırı bulunamadı.");
  }

  if (missingHeaders.length > 0) {
    errors.push(`Eksik kolonlar: ${missingHeaders.join(", ")}`);
  }

  if (duplicateHeaders.length > 0) {
    errors.push(`Tekrarlanan kolonlar: ${Array.from(new Set(duplicateHeaders)).join(", ")}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function exportProductsToExcel(products: Product[]) {
  ensureBrowserDownload();

  const rows = [
    [...PRODUCT_EXCEL_HEADERS],
    ...products.map((product) => [
      product.name,
      product.sku ?? "",
      product.barcode ?? "",
      product.category_path ?? product.category_name ?? "",
      Number(product.cost ?? 0),
      Number(product.packaging_cost ?? 0),
      Number(product.desi ?? 0),
      Number(product.sale_price ?? 0),
      product.active_channels.map(channelLabel).join(", "),
      product.description ?? "",
    ]),
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, buildWorksheet(rows, PRODUCT_EXPORT_WIDTHS), "Ürünler");
  XLSX.writeFile(workbook, `urunler-${getTodayKey()}.xlsx`, { compression: true });
}

export function exportSalesToExcel(sales: SalesRow[]) {
  ensureBrowserDownload();

  const rows = [
    ["Tarih", "Ürün", "SKU", "Kanal", "Sipariş", "Paket", "Adet", "Birim Fiyat", "Toplam", "Durum"],
    ...sales.map((sale) => [
      sale.order_date,
      sale.product_name ?? "Ürün",
      sale.product_sku ?? "",
      sale.marketplace_name ?? sale.marketplace_slug ?? "Kanal",
      sale.external_order_number ?? `#${sale.order_id}`,
      sale.external_package_number ?? "",
      Number(sale.quantity ?? 0),
      Number(sale.unit_price ?? 0),
      Number(sale.line_total ?? 0),
      sale.status ?? "completed",
    ]),
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, buildWorksheet(rows, SALES_EXPORT_WIDTHS), "Satış Geçmişi");
  XLSX.writeFile(workbook, `satis-gecmisi-${getTodayKey()}.xlsx`, { compression: true });
}

export async function parseProductsFromExcelDetailed(file: File): Promise<ProductExcelParseResult> {
  const buffer = await readExcelFileBuffer(file);
  const workbook = XLSX.read(buffer, { type: "array", dense: true });
  const firstSheetName = workbook.SheetNames[0];
  const firstSheet = firstSheetName ? workbook.Sheets[firstSheetName] : null;

  if (!firstSheet) {
    return {
      headers: [],
      products: [],
      preview: [],
      errors: [{ rowNumber: 1, message: "Excel dosyasında okunabilir bir sayfa bulunamadı." }],
      totalRows: 0,
      validRows: 0,
      skippedRows: 0,
    };
  }

  const matrix = XLSX.utils.sheet_to_json<Array<string | number | boolean | null>>(firstSheet, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  });

  const headers = (matrix[0] ?? []).map((value) => sanitizeCellValue(value));
  const headerValidation = validateExcelHeaders(headers);

  if (!headerValidation.valid) {
    return {
      headers,
      products: [],
      preview: [],
      errors: headerValidation.errors.map((message) => ({ rowNumber: 1, message, field: "Başlık" })),
      totalRows: Math.max(0, matrix.length - 1),
      validRows: 0,
      skippedRows: 0,
    };
  }

  const headerIndexMap = getHeaderIndexMap(headers);
  const products: ParsedProductExcelRow[] = [];
  const errors: ExcelRowError[] = [];
  let totalRows = 0;
  let skippedRows = 0;

  for (let rowIndex = 1; rowIndex < matrix.length; rowIndex += 1) {
    const row = matrix[rowIndex] ?? [];
    const rowNumber = rowIndex + 1;

    if (row.every((cell) => sanitizeCellValue(cell).length === 0)) {
      skippedRows += 1;
      continue;
    }

    totalRows += 1;

    const getValue = (field: keyof ProductUpsertInput | "description") => {
      const columnIndex = headerIndexMap.get(field);
      return typeof columnIndex === "number" ? row[columnIndex] : "";
    };

    const name = sanitizeCellValue(getValue("name"));
    const sku = sanitizeCellValue(getValue("sku")) || undefined;
    const barcode = sanitizeCellValue(getValue("barcode")) || undefined;
    const categoryPath = sanitizeCellValue(getValue("category_path"));
    const description = sanitizeCellValue(getValue("description")) || undefined;
    const cost = parseLocalizedNumber(getValue("cost"));
    const packagingCost = parseLocalizedNumber(getValue("packaging_cost"));
    const desi = parseLocalizedNumber(getValue("desi"));
    const salePrice = parseLocalizedNumber(getValue("sale_price"));
    const channelResult = parseChannels(getValue("active_channels"));
    const rowErrors: ExcelRowError[] = [];

    if (!name) {
      rowErrors.push({ rowNumber, field: "Ürün Adı", message: "Ürün adı boş bırakılamaz." });
    }

    if (!categoryPath) {
      rowErrors.push({ rowNumber, field: "Kategori", message: "Kategori boş bırakılamaz." });
    }

    if (cost == null || cost <= 0) {
      rowErrors.push({ rowNumber, field: "Maliyet", message: "Maliyet 0'dan büyük bir sayı olmalıdır." });
    }

    if (packagingCost == null || packagingCost < 0) {
      rowErrors.push({ rowNumber, field: "Paketleme", message: "Paketleme 0 veya daha büyük bir sayı olmalıdır." });
    }

    if (desi == null || desi < 0) {
      rowErrors.push({ rowNumber, field: "Desi", message: "Desi 0 veya daha büyük bir sayı olmalıdır." });
    }

    if (salePrice == null || salePrice <= 0) {
      rowErrors.push({ rowNumber, field: "Satış Fiyatı", message: "Satış fiyatı 0'dan büyük bir sayı olmalıdır." });
    }

    if (channelResult.channels.length === 0) {
      rowErrors.push({ rowNumber, field: "Kanallar", message: "En az bir geçerli satış kanalı belirtin." });
    }

    if (channelResult.invalidTokens.length > 0) {
      rowErrors.push({
        rowNumber,
        field: "Kanallar",
        message: `Tanınmayan kanal değerleri: ${Array.from(new Set(channelResult.invalidTokens)).join(", ")}`,
      });
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      continue;
    }

    products.push({
      rowNumber,
      name,
      sku,
      barcode,
      image_url: undefined,
      category_id: null,
      category_path: categoryPath,
      description,
      cost: cost ?? 0,
      packaging_cost: packagingCost ?? 0,
      desi: desi ?? 0,
      sale_price: salePrice ?? 0,
      active_channels: channelResult.channels,
      status: "active",
      rawChannels: channelResult.rawChannels,
    });
  }

  return {
    headers,
    products,
    preview: products.slice(0, 5),
    errors,
    totalRows,
    validRows: products.length,
    skippedRows,
  };
}

export async function parseProductsFromExcel(file: File): Promise<ProductUpsertInput[]> {
  const result = await parseProductsFromExcelDetailed(file);
  return result.products.map(stripParseMetadata);
}
