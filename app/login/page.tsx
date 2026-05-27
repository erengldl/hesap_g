import LoginPageClient from "@/components/auth/LoginPageClient";

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const requestedRedirect = readParam(resolvedSearchParams.redirect) || "/dashboard";
  const redirectPath = requestedRedirect.startsWith("/") ? requestedRedirect : "/dashboard";
  const showRegistrationNotice = readParam(resolvedSearchParams.registered) === "1";
  const showCallbackError = readParam(resolvedSearchParams.authError) === "callback";

  return (
    <LoginPageClient
      redirectPath={redirectPath}
      showRegistrationNotice={showRegistrationNotice}
      showCallbackError={showCallbackError}
    />
  );
}
