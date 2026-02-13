import React from "react";

export default function Footer() {
  const onSubmit = (e) => {
    e.preventDefault();
  };

  return (
    <footer className="site-footer" aria-label="Site footer">
      <div className="container footer-inner">
        <div className="footer-grid">
          <div className="footer-left">
            <div className="footer-title">RK Apparels</div>
            <p className="footer-text">
              Redefining contemporary fashion with minimalist aesthetics and
              premium materials.
            </p>
          </div>

          <div className="footer-right">
            <div className="footer-kicker">Newsletter</div>
            <form className="footer-form" onSubmit={onSubmit}>
              <label className="footer-label">
                <span className="sr-only">Email Address</span>
                <input
                  className="footer-input"
                  placeholder="Email Address"
                  type="email"
                  autoComplete="email"
                />
              </label>
              <button className="footer-btn" type="submit">
                Subscribe
              </button>
            </form>
          </div>
        </div>
      </div>
    </footer>
  );
}
