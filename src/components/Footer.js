import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Facebook, Instagram, Mail, MapPin, Phone, Twitter, Youtube } from "lucide-react";
import { apiFetch } from "../api";

export default function Footer() {
  const year = new Date().getFullYear();

  const DEFAULT_SETTINGS = useMemo(
    () => ({
      contact_email: "rkgarmentsmeesho@gmail.com",
      contact_phone: "+918053317489",
      contact_address: "West Kasa, United States",
      instagram_url: "",
      facebook_url: "",
      twitter_url: "",
      youtube_url: "",
    }),
    []
  );

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    let cancelled = false;

    apiFetch("/site-settings")
      .then((res) => {
        if (!res.ok) return null;
        return res.json().catch(() => null);
      })
      .then((data) => {
        if (cancelled) return;
        if (!data) return;
        setSettings((prev) => ({ ...prev, ...data }));
      })
      .catch(() => {
        // ignore (fallback to defaults)
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const CONTACT_EMAIL = settings?.contact_email || DEFAULT_SETTINGS.contact_email;
  const CONTACT_PHONE = settings?.contact_phone || DEFAULT_SETTINGS.contact_phone;
  const CONTACT_ADDRESS = settings?.contact_address || DEFAULT_SETTINGS.contact_address;

  const SOCIAL = [
    {
      label: "Instagram",
      href: settings?.instagram_url || "https://instagram.com/",
      Icon: Instagram,
    },
    {
      label: "Facebook",
      href: settings?.facebook_url || "https://facebook.com/",
      Icon: Facebook,
    },
    {
      label: "X (Twitter)",
      href: settings?.twitter_url || "https://twitter.com/",
      Icon: Twitter,
    },
    {
      label: "YouTube",
      href: settings?.youtube_url || "https://youtube.com/",
      Icon: Youtube,
    },
  ];

  const [policies, setPolicies] = useState([]);

  useEffect(() => {
    let cancelled = false;

    apiFetch("/policies")
      .then((res) => {
        if (!res.ok) return [];
        return res.json().catch(() => ([]));
      })
      .then((data) => {
        if (cancelled) return;
        setPolicies(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        // ignore
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const policiesByGroup = useMemo(() => {
    const map = new Map();
    (policies || []).forEach((p) => {
      const g = String(p?.footer_group || "Privacy & Legal").trim() || "Privacy & Legal";
      if (!map.has(g)) map.set(g, []);
      map.get(g).push(p);
    });
    return {
      help: map.get("Help") || [],
      legal: map.get("Privacy & Legal") || [],
      other: map.get("Other Services") || [],
    };
  }, [policies]);

  const [openKey, setOpenKey] = useState("help");
  const toggleOpen = (key) => {
    setOpenKey((prev) => (prev === key ? "" : key));
  };

  return (
    <footer className="site-footer" aria-label="Site footer">
      <div className="container footer-inner">
        <div className="footer-grid">
          <div className="footer-left">
            <div className="footer-title">Zubilo Apparels</div>
            <p className="footer-text">
              From the world's best designer fashion to emerging brand, here Zubilo presents you 100,000 + Styles For Men, Women El Kids. Get ✈️ Express Delivery And free Returns
            </p>

            <div className="footer-links" aria-label="Contact details">
              <a className="footer-link" href={`mailto:${CONTACT_EMAIL}`}>
                <span className="footer-link-row">
                  <Mail size={16} aria-hidden="true" />
                  {CONTACT_EMAIL}
                </span>
              </a>
              <a className="footer-link" href={`tel:${String(CONTACT_PHONE).replace(/[^\d+]/g, "")}`}>
                <span className="footer-link-row">
                  <Phone size={16} aria-hidden="true" />
                  {CONTACT_PHONE}
                </span>
              </a>
              <span className="footer-link">
                <span className="footer-link-row">
                  <MapPin size={16} aria-hidden="true" />
                  {CONTACT_ADDRESS}
                </span>
              </span>
            </div>
          </div>

          <div className="footer-right">
            <div className="footer-social-block">
              <div className="footer-kicker">Our Social Networks</div>
              <div className="footer-social footer-social-row">
                {SOCIAL.map(({ label, href, Icon }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={label}
                    className="footer-social-link"
                  >
                    <Icon size={20} aria-hidden="true" />
                  </a>
                ))}
              </div>
            </div>

            <div className="footer-accordion" aria-label="Footer sections">
              <div className="footer-acc-item">
                <button
                  type="button"
                  className="footer-acc-btn"
                  aria-expanded={openKey === "shop"}
                  onClick={() => toggleOpen("shop")}
                >
                  <span className="footer-acc-title">Shop</span>
                  <ChevronDown size={18} className={openKey === "shop" ? "footer-acc-icon open" : "footer-acc-icon"} />
                </button>
                <div className={openKey === "shop" ? "footer-acc-panel open" : "footer-acc-panel"}>
                  <Link className="footer-link" to="/new-arrivals">New Arrivals</Link>
                  <Link className="footer-link" to="/women">Women</Link>
                  <Link className="footer-link" to="/men">Men</Link>
                  <Link className="footer-link" to="/kids">Kids</Link>
                  <Link className="footer-link" to="/trending">Trending</Link>
                  <Link className="footer-link" to="/blog">Blog</Link>
                </div>
              </div>

              <div className="footer-acc-item">
                <button
                  type="button"
                  className="footer-acc-btn"
                  aria-expanded={openKey === "account"}
                  onClick={() => toggleOpen("account")}
                >
                  <span className="footer-acc-title">My Account</span>
                  <ChevronDown size={18} className={openKey === "account" ? "footer-acc-icon open" : "footer-acc-icon"} />
                </button>
                <div className={openKey === "account" ? "footer-acc-panel open" : "footer-acc-panel"}>
                  <Link className="footer-link" to="/login">Sign-in to your account</Link>
                  <Link className="footer-link" to="/account">Account</Link>
                  <Link className="footer-link" to="/cart">Cart</Link>
                </div>
              </div>

              <div className="footer-acc-item">
                <button
                  type="button"
                  className="footer-acc-btn"
                  aria-expanded={openKey === "help"}
                  onClick={() => toggleOpen("help")}
                >
                  <span className="footer-acc-title">Help</span>
                  <ChevronDown size={18} className={openKey === "help" ? "footer-acc-icon open" : "footer-acc-icon"} />
                </button>
                <div className={openKey === "help" ? "footer-acc-panel open" : "footer-acc-panel"}>
                  {policiesByGroup.help.length ? (
                    policiesByGroup.help.map((p) => (
                      <Link key={p.id || p.slug} className="footer-link" to={`/policy/${p.slug}`}>{p.title}</Link>
                    ))
                  ) : (
                    <>
                      <Link className="footer-link" to="/policy/returns-information">Returns Information</Link>
                      <Link className="footer-link" to="/policy/delivery-information">Delivery Information</Link>
                      <Link className="footer-link" to="/policy/product-recall">Product Recall</Link>
                    </>
                  )}
                  <a className="footer-link" href={`mailto:${CONTACT_EMAIL}`}>Contact Us</a>
                </div>
              </div>

              <div className="footer-acc-item">
                <button
                  type="button"
                  className="footer-acc-btn"
                  aria-expanded={openKey === "legal"}
                  onClick={() => toggleOpen("legal")}
                >
                  <span className="footer-acc-title">Privacy & Legal</span>
                  <ChevronDown size={18} className={openKey === "legal" ? "footer-acc-icon open" : "footer-acc-icon"} />
                </button>
                <div className={openKey === "legal" ? "footer-acc-panel open" : "footer-acc-panel"}>
                  {policiesByGroup.legal.length ? (
                    policiesByGroup.legal.map((p) => (
                      <Link key={p.id || p.slug} className="footer-link" to={`/policy/${p.slug}`}>{p.title}</Link>
                    ))
                  ) : (
                    <>
                      <Link className="footer-link" to="/policy/privacy-cookie-policy">Privacy and Cookie Policy</Link>
                      <Link className="footer-link" to="/policy/terms-conditions">Terms & Conditions</Link>
                      <Link className="footer-link" to="/policy/manage-cookies">Manually Manage Cookies</Link>
                    </>
                  )}
                </div>
              </div>

              <div className="footer-acc-item">
                <button
                  type="button"
                  className="footer-acc-btn"
                  aria-expanded={openKey === "departments"}
                  onClick={() => toggleOpen("departments")}
                >
                  <span className="footer-acc-title">Departments</span>
                  <ChevronDown size={18} className={openKey === "departments" ? "footer-acc-icon open" : "footer-acc-icon"} />
                </button>
                <div className={openKey === "departments" ? "footer-acc-panel open" : "footer-acc-panel"}>
                  <Link className="footer-link" to="/women">Womens</Link>
                  <Link className="footer-link" to="/men">Mens</Link>
                  <Link className="footer-link" to="/kids">Boys</Link>
                  <Link className="footer-link" to="/kids">Girls</Link>
                  <Link className="footer-link" to="/kids">Baby</Link>
                  <Link className="footer-link" to="/">Home</Link>
                </div>
              </div>

              <div className="footer-acc-item">
                <button
                  type="button"
                  className="footer-acc-btn"
                  aria-expanded={openKey === "other"}
                  onClick={() => toggleOpen("other")}
                >
                  <span className="footer-acc-title">Other Services</span>
                  <ChevronDown size={18} className={openKey === "other" ? "footer-acc-icon open" : "footer-acc-icon"} />
                </button>
                <div className={openKey === "other" ? "footer-acc-panel open" : "footer-acc-panel"}>
                  {policiesByGroup.other.length ? (
                    policiesByGroup.other.map((p) => (
                      <Link key={p.id || p.slug} className="footer-link" to={`/policy/${p.slug}`}>{p.title}</Link>
                    ))
                  ) : (
                    <>
                      <Link className="footer-link" to="/policy/media-press">Media & Press</Link>
                      <Link className="footer-link" to="/policy/the-company">The Company</Link>
                      <Link className="footer-link" to="/policy/careers">Careers</Link>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="footer-bottom" aria-label="Footer bottom">
          <div className="footer-bottom-left">© {year} Zubilo Apparels. All rights reserved.</div>
          <div className="footer-bottom-right">
            <Link className="footer-link" to="/blog">Blog</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
