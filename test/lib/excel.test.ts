import * as XLSX from "xlsx";

import {
  PRODUCT_EXCEL_HEADERS,
  parseProductsFromExcel,
  parseProductsFromExcelDetailed,
  validateExcelHeaders,
} from "@/lib/excel";

function buildExcelFile(rows: Array<Array<string | number>>) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Ürünler");
  const output = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  return new File([output], "urunler.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

describe("excel helpers", () => {
  it("validates product template headers", () => {
    const result = validateExcelHeaders([...PRODUCT_EXCEL_HEADERS]);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("parses products from excel with Turkish number formats", async () => {
    const file = buildExcelFile([
      [...PRODUCT_EXCEL_HEADERS],
      ["Kupa Bardak", "SKU-001", "869000000001", "Ev > Mutfak", "125,50", "12,75", "1,25", "249,90", "Trendyol, Kendi Websitem", "Özel seri"],
    ]);

    const products = await parseProductsFromExcel(file);

    expect(products).toHaveLength(1);
    expect(products[0]).toMatchObject({
      name: "Kupa Bardak",
      sku: "SKU-001",
      barcode: "869000000001",
      category_id: null,
      category_path: "Ev > Mutfak",
      cost: 125.5,
      packaging_cost: 12.75,
      desi: 1.25,
      sale_price: 249.9,
      active_channels: ["trendyol", "my_website"],
      status: "active",
    });
  });

  it("collects row validation errors without blocking valid rows", async () => {
    const file = buildExcelFile([
      [...PRODUCT_EXCEL_HEADERS],
      ["Geçerli Ürün", "SKU-101", "869000000101", "Moda > Tişört", "220", "15", "1", "399,90", "Hepsiburada", ""],
      ["Hatalı Ürün", "", "", "", "0", "-1", "-2", "0", "Bilinmeyen Kanal", ""],
    ]);

    const result = await parseProductsFromExcelDetailed(file);

    expect(result.validRows).toBe(1);
    expect(result.products).toHaveLength(1);
    expect(result.preview).toHaveLength(1);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rowNumber: 3, field: "Kategori" }),
        expect.objectContaining({ rowNumber: 3, field: "Maliyet" }),
        expect.objectContaining({ rowNumber: 3, field: "Kanallar" }),
      ])
    );
  });
});
