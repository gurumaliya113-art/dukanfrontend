import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useCart } from "../cartContext";
import { useRegion } from "../regionContext";
import { formatMoney, getProductUnitMrp, getProductUnitPrice } from "../pricing";
import { apiFetch } from "../api";
import ReviewsSlider from "../components/ReviewsSlider";

const DEFAULT_SIZES = ["XS", "S", "M", "L", "XL"];

function normalizeProductSizes(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean).map((s) => String(s));

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];

    // JSON string like: ["S","M"]
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.filter(Boolean).map((s) => String(s));
      } catch {
        // ignore
      }
    }

    // Postgres array text like: {"0-1 year","S"}
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      const inner = trimmed.slice(1, -1).trim();
      if (!inner) return [];
      return inner
        .split(",")
        .map((s) => s.trim().replace(/^"|"$/g, ""))
        .filter(Boolean);
    }

    // Fallback comma-separated
    return trimmed
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  return [];
}

export default function ProductPage() {
  const { id } = useParams();
  const productId = useMemo(() => Number(id), [id]);

  const [product, setProduct] = useState(null);
  const [error, setError] = useState("");
  const [size, setSize] = useState("");
  const [status, setStatus] = useState("");
  const [activeImage, setActiveImage] = useState("");
  const navigate = useNavigate();
  const cart = useCart();
  const { region } = useRegion();

  useEffect(() => {
    if (Number.isNaN(productId)) {
      setError("Invalid product");
      return;
    }

    apiFetch(`/products/${productId}`)
      .then((res) => {
        if (res.status === 404) throw new Error("Product not found");
        if (!res.ok) throw new Error(`Failed to load product (${res.status})`);
        return res.json();
      })
      .then((data) => {
        setProduct(data);
        setError("");

        const first =
          data?.image1 || data?.image2 || data?.image3 || data?.image4 || "";
        setActiveImage(first);
      })
      .catch((err) => {
        console.error(err);
        setError(err.message);
        setProduct(null);
      });
  }, [productId]);

  const onAddToCart = () => {
    setStatus("");
    if (!size) {
      setStatus("Please select a size");
      return;
    }

    cart.addItem({
      productId,
      name: product?.name,
      price: product?.price,
      price_inr: product?.price_inr,
      price_usd: product?.price_usd,
      image1: product?.image1,
      size,
    });
    setStatus(`Added to cart — Size ${size}`);
  };

  const onBuyNow = () => {
    setStatus("");
    if (!size) {
      setStatus("Please select a size");
      return;
    }
    navigate(`/checkout?productId=${productId}&size=${encodeURIComponent(size)}`);
  };

  if (error) {
    return (
      <div className="detail">
        <div className="container">
          <p className="status">{error}</p>
          <p style={{ marginTop: 10 }}>
            <Link to="/">Back to shop</Link>
          </p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="detail">
        <div className="container">
          <p className="status">Loading…</p>
        </div>
      </div>
    );
  }

  const images = [product.image1, product.image2, product.image3, product.image4].filter(Boolean);
  const mainImage = activeImage || images[0] || "https://via.placeholder.com/900";
  const unit = getProductUnitPrice(product, region);
  const unitMrp = getProductUnitMrp(product, region);

  const productSizes = normalizeProductSizes(product?.sizes);
  const sizes = productSizes.length ? productSizes : DEFAULT_SIZES;
  const showMrp =
    Number(unitMrp?.amount || 0) > 0 &&
    unitMrp?.currency === unit?.currency &&
    Number(unitMrp.amount) > Number(unit.amount || 0);

  let offPercent = 0;
  if (showMrp) {
    const mrp = Number(unitMrp.amount || 0);
    const price = Number(unit.amount || 0);
    if (mrp > 0 && price >= 0 && mrp > price) {
      const pct = Math.round(((mrp - price) / mrp) * 100);
      offPercent = Number.isFinite(pct) && pct > 0 ? Math.min(99, pct) : 0;
    }
  }

  return (
    <div className="detail">
      <div className="container">
        <div className="detail-grid">
          <div>
            <div className="detail-image">
              <img src={mainImage} alt={product.name} />
            </div>

            {images.length > 1 ? (
              <div className="thumbs" aria-label="Product images">
                {images.map((src) => (
                  <button
                    key={src}
                    type="button"
                    className={src === mainImage ? "thumb active" : "thumb"}
                    onClick={() => setActiveImage(src)}
                    aria-label="View image"
                  >
                    <img src={src} alt="" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div>
            <h1 className="detail-title">{product.name}</h1>
            <div className="detail-price-row">
              <span className="detail-price">{formatMoney(unit.amount, unit.currency)}</span>
              {showMrp ? (
                <>
                  <span className="detail-mrp">{formatMoney(unitMrp.amount, unitMrp.currency)}</span>
                  {offPercent ? <span className="detail-off">{offPercent}% OFF</span> : null}
                </>
              ) : null}
            </div>
            {product.description ? (
              <p className="detail-desc">{product.description}</p>
            ) : null}

            <div className="label">Size</div>
            <div className="sizes">
              {sizes.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={s === size ? "size-btn active" : "size-btn"}
                  onClick={() => setSize(s)}
                >
                  {s}
                </button>
              ))}
            </div>

            <button className="primary-btn" type="button" onClick={onAddToCart}>
              Add to Cart
            </button>

            <button
              className="secondary-btn"
              type="button"
              onClick={onBuyNow}
              disabled={!size}
            >
              Buy Now
            </button>
            {status ? <div className="status">{status}</div> : null}

            <p style={{ marginTop: 16, color: "rgba(26,26,26,0.72)" }}>
              <Link to="/">← Back to Latest Arrivals</Link>
            </p>
          </div>
        </div>

        <div style={{ marginTop: 26 }}>
          <ReviewsSlider
            title="Reviews"
            subtitle="Faux Fur Jacket reviews (USA)"
          />
        </div>
      </div>
    </div>
  );
}
