function readErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }
  }

  return "";
}

export function getSupabaseErrorMessage(error: unknown, fallback = "Sunucu hatasi. Lutfen tekrar deneyin.") {
  const rawMessage = readErrorMessage(error);
  const normalized = rawMessage.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "E-posta veya sifre hatali.";
  }

  if (normalized.includes("email not confirmed")) {
    return "E-posta adresinizi dogrulamaniz gerekiyor.";
  }

  if (normalized.includes("user already registered")) {
    return "Bu e-posta adresi zaten kayitli.";
  }

  if (normalized.includes("password should be at least")) {
    return "Sifre en az 6 karakter olmali.";
  }

  if (normalized.includes("signup is disabled")) {
    return "Yeni kayit su anda kapali.";
  }

  if (normalized.includes("supabase auth yapilandirmasi eksik")) {
    return "Supabase auth yapilandirmasi eksik.";
  }

  return rawMessage || fallback;
}
