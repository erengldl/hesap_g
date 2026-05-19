const FIREBASE_ERROR_MESSAGES: Record<string, string> = {
  "auth/email-already-in-use": "Bu e-posta adresi zaten kayıtlı.",
  "auth/invalid-email": "Geçerli bir e-posta adresi girin.",
  "auth/weak-password": "Şifre en az 6 karakter olmalı.",
  "auth/user-disabled": "Hesabınız devre dışı.",
  "auth/user-not-found": "E-posta veya şifre hatalı.",
  "auth/wrong-password": "E-posta veya şifre hatalı.",
  "auth/invalid-credential": "E-posta veya şifre hatalı.",
  "auth/too-many-requests": "Çok fazla deneme yaptınız. Biraz sonra tekrar deneyin.",
  "auth/network-request-failed": "Ağ bağlantısı sırasında hata oluştu.",
  "auth/requires-recent-login": "Bu işlem için tekrar giriş yapmanız gerekiyor.",
  "auth/configuration-not-found": "Firebase yapılandırması eksik.",
  "auth/operation-not-allowed": "Bu giriş yöntemi Firebase tarafında etkin değil.",
};

type FirebaseErrorLike = {
  code?: string;
};

export function getFirebaseErrorMessage(
  error: unknown,
  fallback = "Sunucu hatası. Lütfen tekrar deneyin."
) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as FirebaseErrorLike).code || "")
      : "";

  return FIREBASE_ERROR_MESSAGES[code] || fallback;
}
