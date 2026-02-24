import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api";
import { formatMoney, getProductUnitPrice } from "../pricing";

export default function BestSelling2026Scroller({ region, onViewAllHref = "#arrivals" }) {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    apiFetch("/best-selling-2026")
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load best selling (${res.status})`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setItems(Array.isArray(data) ? data : []);
        setError("");
      })
      .catch(() => {
        if (cancelled) return;
        setItems([]);
        setError("");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!items.length && !error) return null;

  return (
    <section className="section best-selling-2026" aria-label="Best Selling Of 2026">
      <div className="container">
        <div className="section-head">
          <h2 className="section-title">Best Selling Of 2026</h2>
        </div>

        {error ? <p className="status">{error}</p> : null}

        <div className="best-selling-track" role="list">
          {items.map((product) => {
            if (!product?.slug) return null;
            const unit = getProductUnitPrice(product, region);
            return (
              <Link
                key={product.id}
                to={`/product/${product.slug}`}
                className="product-card best-selling-card"
                role="listitem"
              >
                <div className="product-image-wrap">
                  <img
                    className="product-image"
                    src={product.image1 || "https://via.placeholder.com/600"}
                    alt={product.name}
                    loading="lazy"
                  />
                </div>
                <div className="product-meta">
                  <div className="product-name">{product.name}</div>
                  <div className="product-price">{formatMoney(unit.amount, unit.currency)}</div>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="best-selling-actions">
          <a className="best-selling-viewall" href={onViewAllHref}>
            VIEW ALL
          </a>
        </div>
      </div>
    </section>
  );
}
