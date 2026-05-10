import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "Offline | YourBarrio",
};

export default function OfflinePage() {
  return (
    <section className="min-h-screen bg-[#f6f7fb] px-6 py-16 text-[#0f0f10]">
      <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col items-center justify-center text-center">
        <Image
          src="/logo-off.png"
          alt="YourBarrio"
          width={96}
          height={96}
          priority
          className="mb-6 rounded-2xl"
        />
        <h1 className="text-2xl font-semibold">You&apos;re offline.</h1>
        <p className="mt-3 text-base text-[#374151]">
          Reconnect to continue using YourBarrio.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex min-h-11 items-center justify-center rounded-lg bg-[#6e34ff] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#5f2ee0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6e34ff]"
        >
          Retry
        </Link>
      </div>
    </section>
  );
}
