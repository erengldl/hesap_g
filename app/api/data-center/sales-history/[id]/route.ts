import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { primeRequestContextFromApiContext, requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth(request);
  if (session instanceof NextResponse) return session;
  const authUserId = session.authUserId?.trim() || "";
  if (!authUserId) {
    return NextResponse.json({ success: false, error: "Oturum kullanıcı kimliği alınamadı." }, { status: 500 });
  }
  primeRequestContextFromApiContext(session);

  try {
    const { id } = await params;
    const orderItemId = Number.parseInt(id, 10);
    if (!Number.isFinite(orderItemId)) {
      return NextResponse.json({ success: false, error: "Geçersiz ID" }, { status: 400 });
    }

    const db = getDb();
    if (!db) {
      return NextResponse.json({ success: false, error: "Veritabanı bağlantısı yok" }, { status: 500 });
    }

    let deleted = false;
    await db.transaction(async () => {
      // Find the associated order_id
      const item = await db.prepare("SELECT order_id FROM order_items WHERE order_item_id = ?").get(orderItemId) as { order_id: number } | undefined;
      if (!item) return;

      const orderId = item.order_id;

      // Delete the item
      await db.prepare("DELETE FROM order_items WHERE order_item_id = ?").run(orderItemId);

      // Check if any items remain for this order
      const remaining = await db.prepare("SELECT COUNT(*) as count FROM order_items WHERE order_id = ?").get(orderId) as { count: number } | undefined;

      if (!remaining || Number(remaining.count ?? 0) === 0) {
        // Delete the parent order
        await db.prepare("DELETE FROM orders WHERE order_id = ?").run(orderId);
      }

      deleted = true;
    });

    if (!deleted) {
      return NextResponse.json({ success: false, error: "Kayıt bulunamadı veya silinemedi." }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Order DELETE error:", error);
    return NextResponse.json({ success: false, error: "Silme işlemi sırasında hata oluştu." }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth(request);
  if (session instanceof NextResponse) return session;
  const authUserId = session.authUserId?.trim() || "";
  if (!authUserId) {
    return NextResponse.json({ success: false, error: "Oturum kullanıcı kimliği alınamadı." }, { status: 500 });
  }
  primeRequestContextFromApiContext(session);

  try {
    const { id } = await params;
    const orderItemId = Number.parseInt(id, 10);
    if (!Number.isFinite(orderItemId)) {
      return NextResponse.json({ success: false, error: "Geçersiz ID" }, { status: 400 });
    }

    const body = await request.json();
    const {
      order_date,
      product_id,
      marketplace_id,
      quantity,
      unit_price,
      status,
      external_order_number,
      external_package_number,
      merchant_sku,
    } = body;

    if (!order_date || !product_id || !marketplace_id || !quantity || unit_price == null) {
      return NextResponse.json({ success: false, error: "Eksik parametreler" }, { status: 400 });
    }

    const db = getDb();
    if (!db) {
      return NextResponse.json({ success: false, error: "Veritabanı bağlantısı yok" }, { status: 500 });
    }

    let updated = false;
    await db.transaction(async () => {
      const item = await db.prepare("SELECT order_id FROM order_items WHERE order_item_id = ?").get(orderItemId) as { order_id: number } | undefined;
      if (!item) return;

      const orderId = item.order_id;

      // Update parent order
      await db.prepare(`
        UPDATE orders SET
          product_id = ?,
          marketplace_id = ?,
          order_date = ?,
          quantity = ?,
          unit_price = ?,
          status = ?,
          external_order_number = ?,
          external_package_number = ?,
          merchant_sku = ?
        WHERE order_id = ?
      `).run(
        product_id,
        marketplace_id,
        order_date,
        quantity,
        unit_price,
        status || 'completed',
        external_order_number || null,
        external_package_number || null,
        merchant_sku || null,
        orderId
      );

      // Update order item
      await db.prepare(`
        UPDATE order_items SET
          product_id = ?,
          quantity = ?,
          unit_price = ?,
          line_total = ?,
          merchant_sku = ?,
          marketplace_order_number = ?,
          package_number = ?
        WHERE order_item_id = ?
      `).run(
        product_id,
        quantity,
        unit_price,
        quantity * unit_price,
        merchant_sku || null,
        external_order_number || null,
        external_package_number || null,
        orderItemId
      );

      updated = true;
    });

    if (!updated) {
      return NextResponse.json({ success: false, error: "Kayıt bulunamadı veya güncellenemedi." }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Order PUT error:", error);
    return NextResponse.json({ success: false, error: "Güncelleme işlemi sırasında hata oluştu." }, { status: 500 });
  }
}
