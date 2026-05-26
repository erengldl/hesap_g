import { badRequest, unauthorized, serverError, ok } from "@/lib/api-helpers";
import { getAuthenticatedUserFromRequest } from "@/lib/request-auth";
import { createStatelessSupabaseClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseErrorMessage } from "@/lib/supabase/errors";

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    if (!user) return unauthorized();

    const { currentPassword, newPassword } = (await request.json()) as {
      currentPassword?: string;
      newPassword?: string;
    };

    if (!currentPassword || !newPassword) {
      return badRequest("Mevcut sifre ve yeni sifre gerekli.");
    }

    if (newPassword.length < 6) {
      return badRequest("Yeni sifre en az 6 karakter olmalidir.");
    }

    if (currentPassword === newPassword) {
      return badRequest("Yeni sifre mevcut sifre ile ayni olamaz.");
    }

    const verificationClient = createStatelessSupabaseClient();
    const verificationResult = await verificationClient.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });

    if (verificationResult.error) {
      return badRequest("Mevcut sifre hatali.");
    }

    const supabase = await createSupabaseServerClient();
    const updateResult = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateResult.error) {
      return badRequest(getSupabaseErrorMessage(updateResult.error, "Sifre guncellenemedi."));
    }

    return ok(undefined, { message: "Sifre basariyla guncellendi." });
  } catch (error) {
    console.error("Change password error:", error);
    return serverError();
  }
}
