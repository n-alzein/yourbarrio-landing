export default function Footer() {
  return (
    <footer className="mt-20 bg-white border-t border-slate-200 py-10">
      <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-10 text-slate-700">

        {/* BRAND COLUMN */}
        <div>
          {/* 🔥 YourBarrio title now acts as a link */}
          <a href="/" className="text-xl font-bold text-indigo-600 hover:text-indigo-700">
            YourBarrio
          </a>

          <p className="mt-2 text-slate-500">
            Discover your neighborhood like never before.
          </p>

          {/* Business home link */}
          <div className="mt-4">
            <a href="/business" className="hover:text-indigo-600">
              YourBarrio for Business
            </a>
          </div>
        </div>

        {/* NAVIGATION COLUMN */}
        <div>
          <h4 className="text-lg font-semibold">Navigation</h4>
          <ul className="mt-3 space-y-2">
            <li><a href="/businesses" className="hover:text-indigo-600">Businesses</a></li>
            <li><a href="/about" className="hover:text-indigo-600">About</a></li>
            <li><a href="/login" className="hover:text-indigo-600">Login</a></li>
          </ul>
        </div>

        {/* CONTACT COLUMN */}
        <div>
          <h4 className="text-lg font-semibold">Contact</h4>
          <ul className="mt-3 space-y-2">
            <li>support@yourbarrio.com</li>
            <li>Long Beach, CA</li>
          </ul>
        </div>
      </div>

      <div className="text-center text-slate-500 mt-10">
        © {new Date().getFullYear()} YourBarrio — All rights reserved.
      </div>
    </footer>
  );
}
