import CustomerLoginForm from "@/components/auth/CustomerLoginForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = (await searchParams) || {};
  const next =
    typeof resolvedSearchParams.next === "string"
      ? resolvedSearchParams.next
      : typeof resolvedSearchParams.returnUrl === "string"
        ? resolvedSearchParams.returnUrl
        : null;

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-white px-4 py-10 text-slate-900">
      <div className="w-full max-w-md rounded-2xl border border-[var(--yb-border)] bg-white p-8 shadow-sm">
        <h1 className="mb-3 text-3xl font-extrabold tracking-tight text-slate-900">
          Welcome back
        </h1>
        <p className="mb-6 text-slate-600">
          Sign in to your customer account to continue exploring nearby businesses.
        </p>
        <CustomerLoginForm next={next} />
      </div>
    </div>
  );
}
