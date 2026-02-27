import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useRegion } from "../regionContext";
import { formatMoney, getProductUnitPrice } from "../pricing";
import { getCategoryLabel, normalizeCategory } from "../categories";
import { apiFetch } from "../api";
import HeroSlider from "../components/HeroSlider";
import ReviewsSlider from "../components/ReviewsSlider";
import BestSelling2026Scroller from "../components/BestSelling2026Scroller";
import SeoHead from "../seo/SeoHead";
import { breadcrumbJsonLd, faqJsonLd, webPageJsonLd } from "../seo/jsonLd";
import { canonicalFromLocation } from "../seo/seoUtils";

export default function ShopPage() {
  const [products, setProducts] = useState([]);
  const [error, setError] = useState("");
  const { region } = useRegion();
  const location = useLocation();
  const arrivalsRef = useRef(null);

  const sliderImages = useMemo(
    () => [
      {
        src: "/slider/slide-1.jpg",
        alt: "Featured collection",
        kicker: "HANDCRAFT WITH LOVE",
        headline: "FLAT 949",
      },
      {
        src: "/slider/slide-2.jpg",
        alt: "New arrivals",
        kicker: "ONLINE EXCLUSIVE SALE",
        headline: "UPTO 60 % OFF",
      },
      {
        src: "/slider/slide-3.jpg",
        alt: "Seasonal picks",
        kicker: "KIDS WINTER COLLECTION IS LIVE",
        headline: "CHECK OUT NOW",
        // Slide 3 has a longer top line; keep it a bit lower to avoid overlapping the header.
        textTop: "10vh",
        textTopMobile: "92px",
      },
    ],
    []
  );

  const tiles = useMemo(
    () => [
      { label: "Men", category: "men", image: "/slider/tile-1.jpg" },
      { label: "Women", category: "women", image: "/slider/tile-2.jpg" },
      { label: "Kids", category: "kids", image: "/slider/tile-3.jpg" },
      { label: "Party Wear", category: "women", image: "/slider/tile-4.jpg" },
    ],
    []
  );

  const activeCategory = useMemo(() => {
    const params = new URLSearchParams(location.search || "");
    return normalizeCategory(params.get("category"));
  }, [location.search]);

  const categoryLabel = getCategoryLabel(activeCategory);

  const faqs = useMemo(
    () => [
      {
        q: "Do you ship worldwide?",
        a: "Yes. Zubilo Apparels ships worldwide. Shipping time and charges may vary by destination and are shown at checkout.",
      },
      {
        q: "What is the return window?",
        a: "We offer a 7-day return window for eligible items. Please check the Returns policy page for exclusions and steps.",
      },
      {
        q: "How do I track my order?",
        a: "After placing an order, you can view order status and tracking updates in My Account once you are logged in.",
      },
      {
        q: "Which payment options are available?",
        a: "Payment options depend on your region. India supports Razorpay/UPI and COD where available; other regions may see additional options at checkout.",
      },
    ],
    []
  );

  const canonicalUrl = canonicalFromLocation(location);
  const jsonLd = useMemo(() => {
    const crumbs = breadcrumbJsonLd([
      { name: "Home", item: "/" },
      activeCategory && activeCategory !== "new" ? { name: categoryLabel, item: `/?category=${encodeURIComponent(activeCategory)}` } : null,
    ].filter(Boolean));

    return [
      webPageJsonLd({
        name: `${categoryLabel} | ${"Zubilo Apparels"}`,
        url: canonicalUrl,
        description: `Browse ${categoryLabel} on Zubilo Apparels. Worldwide shipping and 7-day returns.`,
      }),
      crumbs,
      faqJsonLd(faqs),
    ].filter(Boolean);
  }, [activeCategory, categoryLabel, canonicalUrl, faqs]);

  useEffect(() => {
    const url = `/products?category=${encodeURIComponent(activeCategory)}`;
    apiFetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load products (${res.status})`);
        return res.json();
      })
      .then((data) => {
        setProducts(Array.isArray(data) ? data : []);
        setError("");
      })
      .catch((err) => {
        console.error(err);
        setProducts([]);
        setError("Products load nahi ho rahe. Backend (5000) chal raha hai?");
      });
  }, [activeCategory]);

  // Ensure category tiles always scroll to product list (even if hash scrolling is missed).
  useEffect(() => {
    if (location.hash !== "#arrivals") return;

    const behavior = window?.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
      ? "auto"
      : "smooth";

    const scroll = () => {
      try {
        arrivalsRef.current?.scrollIntoView?.({ behavior, block: "start" });
      } catch {
        // ignore
      }
    };

    // One immediate attempt + one delayed attempt (after render/data).
    scroll();
    const t = setTimeout(scroll, 50);
    return () => clearTimeout(t);
  }, [location.hash, activeCategory, products.length]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.IntersectionObserver !== "function") {
      return;
    }

    const nodes = Array.from(document.querySelectorAll(".category-tile"));
    if (nodes.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add("in-view");
          observer.unobserve(e.target);
        }
      },
      { root: null, rootMargin: "0px 0px -10% 0px", threshold: 0.12 }
    );

    for (const n of nodes) observer.observe(n);
    return () => observer.disconnect();
  }, [tiles]);

  return (
    <div>
      <SeoHead
        location={location}
        titlePrimary={
          activeCategory && activeCategory !== "new"
            ? `${categoryLabel} Clothing & New Arrivals`
            : "New Arrivals for Men, Women & Kids"
        }
        titleSecondary="Worldwide Shipping"
        description={
          activeCategory && activeCategory !== "new"
            ? `Shop ${categoryLabel} clothing at Zubilo Apparels. New arrivals, trending styles, secure checkout, worldwide shipping, and 7-day returns.`
            : "Shop new arrivals for men, women & kids at Zubilo Apparels. Trending styles, secure checkout, worldwide shipping, and 7-day returns."
        }
        canonical={canonicalUrl}
        jsonLd={jsonLd}
      />

      <h1 className="sr-only">
        {activeCategory && activeCategory !== "new"
          ? `${categoryLabel} — Zubilo Apparels`
          : "Zubilo Apparels — New Arrivals"}
      </h1>

      <section className="hero hero-fullbleed hero-home">
        <HeroSlider images={sliderImages} />
      </section>

      <section className="first-on" aria-label="First on ZUBILO">
        <div className="container">
          <div className="first-on-inner">FIRST ON ZUBILO</div>
        </div>
      </section>

      <section className="category-tiles" aria-label="Browse collections">
        <div className="container">
          <div className="category-tiles-grid">
            {tiles.map((t) => (
              <Link
                key={t.label}
                to={`/?category=${encodeURIComponent(t.category)}#arrivals`}
                className="category-tile"
                style={{ backgroundImage: `url(${t.image})` }}
                aria-label={t.label}
              >
                <span className="category-tile-title">{t.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <ReviewsSlider
        title="Reviews"
        subtitle="Faux Fur Jacket feedback from USA customers"
        mix
      />

      <BestSelling2026Scroller region={region} onViewAllHref="#arrivals" />

      <section className="section" id="arrivals" ref={arrivalsRef}>
        <div className="container">
          <div className="section-head">
            <h2 className="section-title">{getCategoryLabel(activeCategory)}</h2>
            <div className="section-count">{products.length} ITEMS</div>
          </div>
          {error ? <p className="status">{error}</p> : null}

          <div className="product-grid">
            {products.map((product) => {
              const unit = getProductUnitPrice(product, region);
              // Only use slug for product links
              if (!product.slug) return null;
              return (
                <Link
                  key={product.id}
                  to={`/product/${product.slug}`}
                  className="product-card"
                >
                  <div className="product-image-wrap">
                    <img
                      className="product-image"
                      src={product.image1 || "https://via.placeholder.com/600"}
                      alt={product.name}
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                  <div className="product-meta">
                    <div className="product-name">{product.name}</div>
                    <div className="product-price">
                      {formatMoney(unit.amount, unit.currency)}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section" aria-label="About Zubilo Apparels">
        <div className="container" style={{ maxWidth: 920 }}>
          <h2 className="section-title">About the Brand</h2>
          <p className="section-subtitle">
            Zubilo Apparels is an online fashion store offering curated styles for men, women, and kids with worldwide shipping and a 7-day return window.
          </p>
          <div style={{ marginTop: 10, lineHeight: 1.85, display: "grid", gap: 10 }}>
            <p>
              Looking for everyday essentials, seasonal picks, or standout outfits? Browse new arrivals by category, open any product to view details, and checkout securely. Prices adapt to your selected region so you can shop with clarity.
            </p>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li>New arrivals and trending collections across categories</li>
              <li>Region-based pricing for a smoother checkout experience</li>
              <li>Worldwide shipping and an easy 7-day return window</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="section" aria-label="Frequently asked questions">
        <div className="container" style={{ maxWidth: 920 }}>
          <h2 className="section-title">FAQs</h2>
          <p className="section-subtitle">Quick answers to common questions.</p>

          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            {faqs.map((f) => (
              <details key={f.q} className="cart-card" style={{ padding: 14 }}>
                <summary style={{ cursor: "pointer", fontWeight: 700 }}>{f.q}</summary>
                <p style={{ marginTop: 10, lineHeight: 1.8 }}>{f.a}</p>
              </details>
            ))}
          </div>

          <p className="summary-meta" style={{ marginTop: 14 }}>
            Helpful links: <Link to="/blog" className="nav-link" style={{ padding: 0 }}>Blog</Link>
            {" · "}
            <Link to="/policy/returns-information" className="nav-link" style={{ padding: 0 }}>Returns</Link>
            {" · "}
            <Link to="/policy/delivery-information" className="nav-link" style={{ padding: 0 }}>Delivery</Link>
          </p>
        </div>
      </section>
    </div>
  );
}
