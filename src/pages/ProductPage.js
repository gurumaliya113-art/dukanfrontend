import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useCart } from "../cartContext";
import { useRegion } from "../regionContext";
import { formatMoney, getProductUnitPrice } from "../pricing";
import { apiFetch } from "../api";

const SIZES = ["XS", "S", "M", "L", "XL"]; 

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
            <div className="detail-price">{formatMoney(unit.amount, unit.currency)}</div>
            {product.description ? (
              <p className="detail-desc">{product.description}</p>
            ) : null}

            <div className="label">Size</div>
            <div className="sizes">
              {SIZES.map((s) => (
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
      </div>
    </div>
  );
}
