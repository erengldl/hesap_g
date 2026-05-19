import { NextResponse } from "next/server";

// ─── Standard API Response Types ──────────────────────────────────────

export type ApiSuccess<T = unknown> = {
  success: true;
  data?: T;
  [key: string]: unknown;
};

export type ApiError = {
  success: false;
  error: string;
  details?: Record<string, string[]>;
};

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError;

// ─── Response Helpers ────────────────────────────────────────────────

export function ok<T>(data?: T, extra?: Record<string, unknown>): NextResponse {
  return NextResponse.json({ success: true, ...(data !== undefined ? { data } : {}), ...extra }, { status: 200 });
}

export function created<T>(data?: T): NextResponse {
  return NextResponse.json({ success: true, ...(data !== undefined ? { data } : {}) }, { status: 201 });
}

export function badRequest(error: string): NextResponse {
  return NextResponse.json({ success: false, error }, { status: 400 });
}

export function unauthorized(error = "Yetkisiz erisim."): NextResponse {
  return NextResponse.json({ success: false, error }, { status: 401 });
}

export function forbidden(error = "Bu islem icin yetkiniz yok."): NextResponse {
  return NextResponse.json({ success: false, error }, { status: 403 });
}

export function notFound(error = "Kayit bulunamadi."): NextResponse {
  return NextResponse.json({ success: false, error }, { status: 404 });
}

export function conflict(error: string): NextResponse {
  return NextResponse.json({ success: false, error }, { status: 409 });
}

export function validationError(details: Record<string, string[]>): NextResponse {
  return NextResponse.json({ success: false, error: "Dogrulama hatasi.", details }, { status: 422 });
}

export function serverError(error = "Sunucu hatasi."): NextResponse {
  return NextResponse.json({ success: false, error }, { status: 500 });
}

// ─── Validation Helpers ───────────────────────────────────────────────

export function validateRequired(body: Record<string, unknown>, fields: string[]): Record<string, string[]> | null {
  const errors: Record<string, string[]> = {};

  for (const field of fields) {
    const value = body[field];
    if (value === undefined || value === null || value === "") {
      errors[field] = [`${field} alani zorunludur.`];
    }
  }

  return Object.keys(errors).length > 0 ? errors : null;
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validateMinLength(value: string, min: number, fieldName: string): string | null {
  if (value.length < min) {
    return `${fieldName} en az ${min} karakter olmalidir.`;
  }
  return null;
}

export function validateMaxLength(value: string, max: number, fieldName: string): string | null {
  if (value.length > max) {
    return `${fieldName} en fazla ${max} karakter olabilir.`;
  }
  return null;
}

export function validateNumber(value: unknown, fieldName: string): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return `${fieldName} gecerli bir sayi olmalidir.`;
  }
  return null;
}

export function validatePositive(value: number, fieldName: string): string | null {
  if (value < 0) {
    return `${fieldName} negatif olamaz.`;
  }
  return null;
}
