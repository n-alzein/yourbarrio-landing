import { redirect } from "next/navigation";

export default async function SignInPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) || {};
  const next =
    typeof params.next === "string"
      ? `?next=${encodeURIComponent(params.next)}`
      : "";
  redirect(`/login${next}`);
}
