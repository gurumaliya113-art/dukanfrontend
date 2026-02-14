import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useRegion } from "../regionContext";
import { formatMoney, getProductUnitPrice } from "../pricing";
import { getCategoryLabel, normalizeCategory } from "../categories";
import { apiFetch } from "../api";
import HeroSlider from "../components/HeroSlider";
import ReviewsSlider from "../components/ReviewsSlider";

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
              return (
                <Link
                  key={product.id}
                  to={`/product/${product.id}`}
                  className="product-card"
                >
                  <div className="product-image-wrap">
                    <img
                      className="product-image"
                      src={product.image1 || "https://via.placeholder.com/600"}
                      alt={product.name}
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
    </div>
  );
}
