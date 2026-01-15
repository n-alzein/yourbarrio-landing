import Link from "next/link";

export default function BusinessLoginLanding() {
  return (
    <div className="min-h-screen text-white relative pt-24 px-6 pb-24">
      <div className="max-w-3xl mx-auto text-center">
        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight">
          Sign in to manage your business
        </h1>
        <p className="mt-4 text-lg text-white/80">
          Access your dashboard, listings, and customer messages.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/business-auth/login"
            className="px-8 py-4 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-600 via-pink-500 to-rose-500 shadow-lg hover:brightness-110 active:scale-95 transition"
          >
            Business Login
          </Link>
          <Link
            href="/business-auth/register"
            className="px-8 py-4 rounded-xl font-semibold text-white/90 border border-white/20 hover:bg-white/10 transition"
          >
            Create Account
          </Link>
        </div>
      </div>
    </div>
  );
}
