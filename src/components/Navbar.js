import React, { useEffect, useMemo, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useCart } from "../cartContext";
import { useRegion } from "../regionContext";
import { CATEGORIES, normalizeCategory } from "../categories";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const cart = useCart();
  const { region, setRegion } = useRegion();
  const location = useLocation();

  const isHome = location.pathname === "/";
  const homeTop = isHome && !scrolled;

  const activeCategory = useMemo(() => {
    const params = new URLSearchParams(location.search || "");
    return normalizeCategory(params.get("category"));
  }, [location.search]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname, location.search]);

  return (
    <header className={["nav", scrolled ? "scrolled" : "", homeTop ? "home-top" : ""]
      .filter(Boolean)
      .join(" ")}
    >
      <div className="promo-bar" role="region" aria-label="Announcement">
        <div className="container promo-inner">
          <div
            className="promo-marquee"
            aria-label="Free Shipping All Over World. 7 day Return Window All Over World."
          >
            <div className="promo-track" aria-hidden="true">
              <div className="promo-content">
                <span className="promo-item">Free Shipping All Over World</span>
                <span className="promo-sep">•</span>
                <span className="promo-item">7 day Return Window All Over World</span>
                <span className="promo-sep">•</span>
              </div>
              <div className="promo-content">
                <span className="promo-item">Free Shipping All Over World</span>
                <span className="promo-sep">•</span>
                <span className="promo-item">7 day Return Window All Over World</span>
                <span className="promo-sep">•</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container nav-inner">
        <nav className="nav-left nav-left-categories" aria-label="Primary">
          {CATEGORIES.map((c) => {
            const to = `/?category=${encodeURIComponent(c.value)}#arrivals`;
            const isActive = activeCategory === c.value;
            return (
              <Link key={c.value} to={to} className={isActive ? "nav-link active" : "nav-link"}>
                {c.label}
              </Link>
            );
          })}
        </nav>

        <div className="nav-left-actions" aria-label="Mobile actions">
          <button
            className="icon-btn"
            type="button"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((v) => !v)}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                d="M4 7h16M4 12h16M4 17h16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <Link to="/" className="brand" aria-label="ZUBILO Home">
          ZUBILO
        </Link>

        <div className="nav-right" aria-label="Actions">
          <NavLink
            to="/login"
            className={({ isActive }) =>
              isActive ? "nav-link active admin-link" : "nav-link admin-link"
            }
          >
            LOGIN
          </NavLink>

          <label className="sr-only" htmlFor="region-select-top">
            Region
          </label>
          <select
            id="region-select-top"
            className="region-select region-select-top"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            aria-label="Region"
          >
            <option value="IN">India (INR)</option>
            <option value="US">USA (USD)</option>
          </select>

          <Link className="icon-btn" to="/cart" aria-label="Cart">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                d="M7 7h14l-1.3 11H8.3L7 7Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <path
                d="M9 7a3 3 0 0 1 6 0"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
            {cart.count > 0 ? (
              <span className="cart-badge" aria-label={`${cart.count} items in cart`}>
                {cart.count}
              </span>
            ) : null}
          </Link>
        </div>
      </div>

      <div className={mobileMenuOpen ? "mobile-menu open" : "mobile-menu"}>
        <div className="container mobile-menu-inner" aria-label="Menu">
          <div className="mobile-menu-actions">
            <NavLink
              to="/login"
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
            >
              LOGIN
            </NavLink>

            <label className="sr-only" htmlFor="region-select-menu">
              Region
            </label>
            <select
              id="region-select-menu"
              className="region-select"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              aria-label="Region"
            >
              <option value="IN">India (INR)</option>
              <option value="US">USA (USD)</option>
            </select>
          </div>

          <nav className="mobile-menu-links" aria-label="Categories">
            {CATEGORIES.map((c) => {
              const to = `/?category=${encodeURIComponent(c.value)}#arrivals`;
              const isActive = activeCategory === c.value;
              return (
                <Link
                  key={c.value}
                  to={to}
                  className={isActive ? "nav-link active" : "nav-link"}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {c.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
