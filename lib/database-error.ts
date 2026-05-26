type DatabaseErrorInfo = {
  code: string;
  message: string;
};

export function classifyDatabaseError(error: unknown): DatabaseErrorInfo {
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
      ? (error as { code: string }).code.trim()
      : "";

  const rawMessage =
    error instanceof Error && typeof error.message === "string" ? error.message.trim() : "";
  const message = rawMessage.toLowerCase();

  if (rawMessage.includes("DATABASE_URL is required")) {
    return {
      code: "missing_database_url",
      message: "Supabase PostgreSQL baglanti degiskeni eksik.",
    };
  }

  if (code === "28P01" || message.includes("password authentication failed")) {
    return {
      code: "db_auth_failed",
      message: "Supabase veritabani kimlik dogrulamasi basarisiz.",
    };
  }

  if (code === "ENOTFOUND" || message.includes("getaddrinfo enotfound")) {
    return {
      code: "db_dns_failed",
      message: "Supabase veritabani sunucusu cozumlenemedi.",
    };
  }

  if (code === "ETIMEDOUT" || code === "ECONNREFUSED" || message.includes("connect timeout")) {
    return {
      code: "db_connection_failed",
      message: "Supabase veritabani baglantisi kurulamadi.",
    };
  }

  if (code === "57P01" || code === "57P03") {
    return {
      code: "db_unavailable",
      message: "Supabase veritabani su anda erisilebilir degil.",
    };
  }

  return {
    code: code || "db_query_failed",
    message: "Supabase veritabani sorgusu basarisiz.",
  };
}
