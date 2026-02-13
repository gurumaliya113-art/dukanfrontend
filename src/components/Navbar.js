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
    <header className={scrolled ? "nav scrolled" : "nav"}>
      <div className="promo-bar" role="region" aria-label="Announcement">
        <div className="container promo-inner">
          <span>The Spring Summer'26 Drop is Here!</span>
          <a className="promo-link" href="#arrivals">
            Shop Now
          </a>
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

          <button className="icon-btn" type="button" aria-label="Search">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Zm7.9 1.1-4.1-4.1"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <Link to="/" className="brand" aria-label="KB Home">
          KB
        </Link>

        <div className="nav-right" aria-label="Actions">
          <NavLink
            to="/admin"
            className={({ isActive }) =>
              isActive ? "nav-link active admin-link" : "nav-link admin-link"
            }
          >
            ADMIN
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

          <button className="icon-btn" type="button" aria-label="Wishlist">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                d="M12 20.5s-7.5-4.6-9.4-8.8C1 8.1 3.3 5.5 6.4 5.5c1.7 0 3.2.8 4.1 2 0 0 0 0 0 0 .6-.9 1.4-1.5 2.4-1.8.5-.1 1.1-.2 1.7-.2 3.1 0 5.4 2.6 3.8 6.2C19.5 15.9 12 20.5 12 20.5Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            </svg>
          </button>

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
              to="/admin"
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
            >
              ADMIN
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
