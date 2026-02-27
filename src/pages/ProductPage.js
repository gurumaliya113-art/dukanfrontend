import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useCart } from "../cartContext";
import { useRegion } from "../regionContext";
import { formatMoney, getProductUnitMrp, getProductUnitPrice } from "../pricing";
import { apiFetch } from "../api";
import ReviewsSlider from "../components/ReviewsSlider";
import SeoHead from "../seo/SeoHead";
import { breadcrumbJsonLd, productJsonLd, webPageJsonLd } from "../seo/jsonLd";
import { SITE } from "../seo/siteConfig";

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
  const { slug } = useParams();

  const [product, setProduct] = useState(null);
  const [error, setError] = useState("");
  const [size, setSize] = useState("");
  const [status, setStatus] = useState("");
  const [activeImage, setActiveImage] = useState("");
  const [activeMediaType, setActiveMediaType] = useState("image"); // image | video
  const navigate = useNavigate();
  const cart = useCart();
  const { region } = useRegion();

  useEffect(() => {
    if (!slug) {
      setError("Invalid product");
      return;
    }

    apiFetch(`/products/slug/${encodeURIComponent(slug)}`)
      .then((res) => {
        if (res.status === 404) throw new Error("Product not found");
        if (!res.ok) throw new Error(`Failed to load product (${res.status})`);
        return res.json();
      })
      .then((data) => {
        setProduct(data);
        setError("");

        const hasVideo = !!String(data?.video_url || "").trim();
        setActiveMediaType(hasVideo ? "video" : "image");

        const first =
          data?.image1 || data?.image2 || data?.image3 || data?.image4 || "";
        setActiveImage(first);
      })
      .catch((err) => {
        console.error(err);
        setError(err.message);
        setProduct(null);
      });
  }, [slug]);

  const onAddToCart = () => {
    setStatus("");
    if (!size) {
      setStatus("Please select a size");
      return;
    }

    cart.addItem({
      productId: product?.id,
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
    navigate(`/checkout?productId=${product?.id}&size=${encodeURIComponent(size)}`);
  };

  if (error) {
    return (
      <div className="detail">
        <div className="container">
          <SeoHead
            location={{ pathname: `/product/${encodeURIComponent(slug || "")}`, search: "" }}
            titlePrimary="Product Not Found"
            titleSecondary="Zubilo Apparels"
            description="The product you’re looking for is not available. Browse new arrivals and trending styles on Zubilo Apparels."
            robots="noindex, nofollow"
          />
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
          <SeoHead
            location={{ pathname: `/product/${encodeURIComponent(slug || "")}`, search: "" }}
            titlePrimary="Loading Product"
            titleSecondary="Zubilo Apparels"
            description="Loading product details on Zubilo Apparels."
            robots="noindex, nofollow"
          />
          <p className="status">Loading…</p>
        </div>
      </div>
    );
  }

  const images = [product.image1, product.image2, product.image3, product.image4].filter(Boolean);
  const videoUrl = String(product?.video_url || "").trim();
  const mainImage = activeImage || images[0] || "https://via.placeholder.com/900";
  const isShowingVideo = activeMediaType === "video" && !!videoUrl;
  const unit = getProductUnitPrice(product, region);
  const unitMrp = getProductUnitMrp(product, region);

  const canonicalPath = product?.slug ? `/product/${encodeURIComponent(product.slug)}` : `/product/${encodeURIComponent(slug || "")}`;
  const canonicalUrl = `${SITE.origin}${canonicalPath}`;
  const jsonLd = [
    webPageJsonLd({
      name: `${product.name} | Zubilo Apparels`,
      url: canonicalUrl,
      description: product.description || undefined,
    }),
    breadcrumbJsonLd([
      { name: "Home", item: "/" },
      { name: product.name, item: canonicalPath },
    ]),
    productJsonLd(product, { currency: unit.currency, price: unit.amount }),
  ].filter(Boolean);

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
      <SeoHead
        location={{ pathname: canonicalPath, search: "" }}
        titlePrimary={product.name}
        titleSecondary={"Buy Online"}
        description={product.description}
        descriptionFallback={`Shop ${product.name} on Zubilo Apparels. Secure checkout, worldwide shipping, and 7-day returns.`}
        canonical={canonicalUrl}
        ogImage={product.image1 || SITE.defaultOgImage}
        jsonLd={jsonLd}
      />

      <div className="container">
        <div className="detail-grid">
          <div>
            <div className="detail-image">
              {isShowingVideo ? (
                <video
                  src={videoUrl}
                  controls
                  playsInline
                  preload="metadata"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <img src={mainImage} alt={product.name} loading="eager" decoding="async" />
              )}
            </div>

            {videoUrl || images.length > 1 ? (
              <div className="thumbs" aria-label="Product media">
                {videoUrl ? (
                  <button
                    type="button"
                    className={isShowingVideo ? "thumb active" : "thumb"}
                    onClick={() => setActiveMediaType("video")}
                    aria-label="View video"
                    style={{ display: "grid", placeItems: "center" }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 700 }}>Video</span>
                  </button>
                ) : null}

                {images.map((src) => (
                  <button
                    key={src}
                    type="button"
                    className={activeMediaType === "image" && src === mainImage ? "thumb active" : "thumb"}
                    onClick={() => {
                      setActiveMediaType("image");
                      setActiveImage(src);
                    }}
                    aria-label="View image"
                  >
                    <img src={src} alt="" loading="lazy" decoding="async" />
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
