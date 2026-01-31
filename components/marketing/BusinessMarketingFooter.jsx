import Link from "next/link";

export default function BusinessMarketingFooter() {
  return (
    <footer className="theme-lock mt-20 bg-[#05010d] border-t border-white/10 py-10 text-white">
      <div className="w-full px-5 sm:px-6 md:px-8 lg:px-12">
        <div className="max-w-[1440px] mx-auto grid grid-cols-1 md:grid-cols-3 gap-10 text-white/80">
          <div>
            <Link href="/" className="text-xl font-bold text-white hover:text-white/90">
              YourBarrio
            </Link>
            <p className="mt-2 text-white/70">
              Grow your local presence with tools built for small businesses.
            </p>
            <div className="mt-4">
              <Link href="/business" className="hover:text-white">
                YourBarrio for Business
              </Link>
            </div>
          </div>

          <div>
            <h4 className="text-lg font-semibold text-white">Navigation</h4>
            <ul className="mt-3 space-y-2">
              <li>
                <Link href="/business/about" className="hover:text-white">
                  About
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-white">
                  Privacy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-white">
                  Terms
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-lg font-semibold text-white">Contact</h4>
            <ul className="mt-3 space-y-2 text-white/70">
              <li>support@yourbarrio.com</li>
              <li>Long Beach, CA</li>
            </ul>
          </div>
        </div>

        <div className="text-center text-white/50 mt-10">
          © {new Date().getFullYear()} YourBarrio — All rights reserved.
        </div>
      </div>
    </footer>
  );
}
