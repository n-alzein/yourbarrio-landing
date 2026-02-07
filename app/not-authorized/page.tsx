import Link from "next/link";

export default function NotAuthorizedPage() {
  return (
    <section className="mx-auto max-w-2xl px-6 py-16 text-center text-white">
      <h1 className="text-3xl font-bold">Not authorized</h1>
      <p className="mt-3 text-white/80">
        You are signed in, but your account does not have admin access.
      </p>
      <div className="mt-6">
        <Link href="/" className="rounded border border-white/25 px-4 py-2 text-sm hover:border-white/50">
          Return home
        </Link>
      </div>
    </section>
  );
}
