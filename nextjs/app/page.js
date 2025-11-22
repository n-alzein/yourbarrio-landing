"use client";

export default function Home() {
  return (
    <html lang="en">
      <body>
        <div className="app-root">
          <header>
            <div className="nav-container">
              <div className="logo">
                <div className="logo-icon">YB</div>
                <div>
                  <div className="logo-text-main">YourBarrio</div>
                  <div className="logo-text-sub">Your neighborhood. Delivered.</div>
                </div>
              </div>
              <nav className="nav-links">
                <a href="#how-it-works">How it works</a>
                <a href="#merchants">For merchants</a>
                <a href="#about">About</a>
              </nav>
              <button className="nav-cta">Open a store</button>
            </div>
          </header>

          <main>
            <section className="hero">
              <div>
                <h1 className="hero-title">
                  Shop your <span className="hero-highlight">neighborhood</span> the modern way.
                </h1>
                <p className="hero-subtitle">
                  Discover nearby shops, order in seconds, and choose fast pickup or delivery — all in one clean,
                  simple experience.
                </p>
                <form
                  className="hero-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    // TODO: handle ZIP submit (later)
                  }}
                >
                  <input
                    className="hero-input"
                    type="text"
                    placeholder="Enter your ZIP (e.g. 90802)"
                  />
                  <button type="submit" className="hero-cta">
                    Check availability
                  </button>
                </form>
                <p className="hero-note">
                  Launching first in select neighborhoods. Be the first to know when YourBarrio goes live near you.
                </p>
                <div className="hero-badges">
                  <div className="badge">Support local businesses</div>
                  <div className="badge">Transparent pricing</div>
                  <div className="badge">Pickup or delivery</div>
                </div>
              </div>

              <div className="hero-card">
                <div className="hero-card-tag">Demo view</div>
                <h3 className="hero-card-title">Long Beach · YourBarrio</h3>
                <p className="hero-card-subtitle">Today’s local highlights</p>
                <div className="hero-metrics">
                  <div className="metric-box">
                    <div className="metric-label">Shops online</div>
                    <div className="metric-value">32</div>
                  </div>
                  <div className="metric-box">
                    <div className="metric-label">Avg. pickup time</div>
                    <div className="metric-value">18 min</div>
                  </div>
                  <div className="metric-box">
                    <div className="metric-label">Fees</div>
                    <div className="metric-value">Clear &amp; upfront</div>
                  </div>
                  <div className="metric-box">
                    <div className="metric-label">Neighborhood rating</div>
                    <div className="metric-value">4.8 ★</div>
                  </div>
                </div>
                <div className="hero-heat" />
              </div>
            </section>

            <section className="section" id="how-it-works">
              <h2 className="section-title">How YourBarrio works</h2>
              <p className="section-subtitle">Local shopping in three simple steps.</p>
              <div className="cards">
                <div className="card">
                  <div className="pill">1 · Discover</div>
                  <div className="card-title">Browse nearby shops</div>
                  <p className="card-body">
                    Enter your ZIP code to see local stores, cafes, florists and more — all verified and mapped to your
                    neighborhood.
                  </p>
                </div>
                <div className="card">
                  <div className="pill">2 · Order</div>
                  <div className="card-title">Add items in seconds</div>
                  <p className="card-body">
                    Choose pickup or delivery, see clear fees, and place your order with a single, modern checkout flow.
                  </p>
                </div>
                <div className="card">
                  <div className="pill">3 · Enjoy</div>
                  <div className="card-title">Pickup or get it delivered</div>
                  <p className="card-body">
                    Get real-time updates as your order is prepared. Swing by for pickup or relax while YourBarrio
                    handles delivery.
                  </p>
                </div>
              </div>
            </section>

            <section className="section" id="merchants">
              <div className="two-column">
                <div>
                  <h2 className="section-title">For local merchants</h2>
                  <p className="section-subtitle">
                    Turn your shop into a modern local destination without learning new software or hiring a tech team.
                  </p>
                  <ul className="list">
                    <li>Launch your storefront in days, not months.</li>
                    <li>Show up where nearby customers are already searching.</li>
                    <li>Offer pickup and delivery without changing your workflow.</li>
                    <li>Transparent, merchant-friendly fees and fast payouts.</li>
                  </ul>
                </div>
                <div className="card">
                  <div className="pill">Merchant snapshot</div>
                  <div className="card-title">What YourBarrio adds to your store</div>
                  <p className="card-body">
                    <strong>Online presence:</strong> A clean, branded store page for your shop.
                    <br />
                    <br />
                    <strong>Orders that fit your day:</strong> Configure prep times, hours, and blackout dates so you
                    stay in control.
                    <br />
                    <br />
                    <strong>Insights:</strong> See what sells, when, and to which neighborhoods.
                  </p>
                  <div style={{ marginTop: '14px' }}>
                    <button className="hero-cta" type="button">
                      Open a YourBarrio store
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section className="section" id="about">
              <h2 className="section-title">Why YourBarrio</h2>
              <p className="section-subtitle">
                Because your neighborhood deserves the same convenience as big-box stores — without losing what makes it
                special.
              </p>
              <ul className="list">
                <li>
                  <strong>Local first:</strong> We highlight independent shops and neighborhood staples.
                </li>
                <li>
                  <strong>Modern experience:</strong> Clean design, transparent pricing, no dark patterns.
                </li>
                <li>
                  <strong>Community impact:</strong> Every order keeps more money in your local economy.
                </li>
              </ul>
            </section>
          </main>

          <footer>
            © {new Date().getFullYear()} YourBarrio. Your neighborhood. Delivered.
          </footer>
        </div>
      </body>
    </html>
  );
}
