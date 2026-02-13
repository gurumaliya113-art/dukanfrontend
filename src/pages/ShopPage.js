import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useRegion } from "../regionContext";
import { formatMoney, getProductUnitPrice } from "../pricing";
import { getCategoryLabel, normalizeCategory } from "../categories";
import { apiFetch } from "../api";
import HeroSlider from "../components/HeroSlider";

export default function ShopPage() {
  const [products, setProducts] = useState([]);
  const [error, setError] = useState("");
  const { region } = useRegion();
  const location = useLocation();

  const sliderImages = useMemo(
    () => [
      { src: "/slider/slide-1.jpg", alt: "Featured collection" },
      { src: "/slider/slide-2.jpg", alt: "New arrivals" },
      { src: "/slider/slide-3.jpg", alt: "Seasonal picks" },
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
      <section className="hero hero-fullbleed">
        <HeroSlider images={sliderImages} />
      </section>

      <section className="first-on" aria-label="First on KB">
        <div className="container">
          <div className="first-on-inner">FIRST ON KB.in</div>
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

      <section className="section">
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
