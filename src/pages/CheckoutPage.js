import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useCart } from "../cartContext";
import { useRegion } from "../regionContext";
import { formatMoney, getCartItemUnitPrice, getProductUnitPrice } from "../pricing";
import { apiFetch } from "../api";

const initialForm = {
  fullName: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
};

export default function CheckoutPage() {
  const [params] = useSearchParams();
  const fromCart = params.get("fromCart") === "1";

  const productIdParam = params.get("productId");
  const productId = useMemo(() => Number(productIdParam), [productIdParam]);
  const size = params.get("size") || "";

  const cart = useCart();
  const { region } = useRegion();

  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState("");

  const cartMode = fromCart || !productIdParam;

  const cartTotal = useMemo(() => {
    return cart.items.reduce(
      (sum, item) => {
        const unit = getCartItemUnitPrice(item, region);
        return sum + (Number(unit.amount) || 0) * (Number(item.qty) || 0);
      },
      0
    );
  }, [cart.items, region]);

  const cartTotalCurrency = useMemo(() => {
    const first = cart.items.find((x) => (Number(getCartItemUnitPrice(x, region).amount) || 0) > 0);
    return first ? getCartItemUnitPrice(first, region).currency : (region === "US" ? "USD" : "INR");
  }, [cart.items, region]);

  useEffect(() => {
    if (cartMode) {
      setProduct(null);
      setError("");
      return;
    }

    if (Number.isNaN(productId)) {
      setError("Invalid checkout link");
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
      })
      .catch((err) => {
        console.error(err);
        setError(err.message);
        setProduct(null);
      });
  }, [cartMode, productId]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const canSubmit =
    form.fullName.trim() &&
    form.phone.trim() &&
    form.address.trim() &&
    form.city.trim() &&
    form.state.trim() &&
    form.pincode.trim();

  const onPayNow = (e) => {
    e.preventDefault();
    setStatus("");

    if (!cartMode && !size) {
      setStatus("Please go back and select a size");
      return;
    }

    if (cartMode && cart.items.length === 0) {
      setStatus("Your cart is empty");
      return;
    }

    if (!canSubmit) {
      setStatus("Please fill all required details");
      return;
    }

    if (cartMode) {
      navigate("/payment?fromCart=1", { state: { form, cartItems: cart.items } });
      return;
    }

    navigate(`/payment?productId=${productId}&size=${encodeURIComponent(size)}`,
      { state: { form } }
    );
  };

  if (error) {
    return (
      <div className="section">
        <div className="container">
          <h1 className="section-title">Checkout</h1>
          <p className="status">{error}</p>
          <p style={{ marginTop: 12 }}>
            <Link to="/">Back to shop</Link>
          </p>
        </div>
      </div>
    );
  }

  if (!cartMode && !product) {
    return (
      <div className="section">
        <div className="container">
          <h1 className="section-title">Checkout</h1>
          <p className="status">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="section">
      <div className="container">
        <h1 className="section-title">Payment Details</h1>
        <p className="section-subtitle">
          Confirm your selection and enter delivery details.
        </p>

        <div className="checkout-grid">
          <div className="checkout-summary">
            {cartMode ? (
              <>
                <div className="summary-title">Order Summary</div>
                <div className="summary-meta">{cart.items.length} items</div>

                <div className="summary-lines" role="list">
                  {cart.items.map((item) => (
                    <div
                      key={`${item.productId}_${item.size}`}
                      className="summary-line"
                      role="listitem"
                    >
                      <div className="summary-line-left">
                        <div className="summary-line-name">{item.name}</div>
                        <div className="summary-line-meta">
                          Size {item.size} · Qty {item.qty}
                        </div>
                      </div>
                      <div className="summary-line-right">
                        {(() => {
                          const unit = getCartItemUnitPrice(item, region);
                          return formatMoney(unit.amount, unit.currency);
                        })()}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="summary-total">
                  <div className="summary-meta">Total</div>
                  <div className="summary-total-value">{formatMoney(cartTotal, cartTotalCurrency)}</div>
                </div>

                <p style={{ marginTop: 14 }}>
                  <Link to="/cart">← Back to cart</Link>
                </p>
              </>
            ) : (
              <>
                <div className="detail-image" style={{ marginBottom: 12 }}>
                  <img
                    src={product.image1 || "https://via.placeholder.com/900"}
                    alt={product.name}
                  />
                </div>

                <div className="summary-title">{product.name}</div>
                <div className="summary-meta">Size: {size}</div>
                <div className="summary-meta">
                  {(() => {
                    const unit = getProductUnitPrice(product, region);
                    return `Price: ${formatMoney(unit.amount, unit.currency)}`;
                  })()}
                </div>

                <p style={{ marginTop: 14 }}>
                  <Link to={`/product/${product.id}`}>← Back to product</Link>
                </p>
              </>
            )}
          </div>

          <form className="checkout-form" onSubmit={onPayNow}>
            <label>
              Full Name*
              <input name="fullName" value={form.fullName} onChange={onChange} />
            </label>

            <label>
              Email
              <input name="email" value={form.email} onChange={onChange} />
            </label>

            <label>
              Phone*
              <input name="phone" value={form.phone} onChange={onChange} />
            </label>

            <label>
              Address*
              <textarea
                name="address"
                value={form.address}
                onChange={onChange}
                rows={3}
              />
            </label>

            <div className="checkout-row">
              <label>
                City*
                <input name="city" value={form.city} onChange={onChange} />
              </label>
              <label>
                State*
                <input name="state" value={form.state} onChange={onChange} />
              </label>
            </div>

            <label>
              Pincode*
              <input
                name="pincode"
                value={form.pincode}
                onChange={onChange}
              />
            </label>

            <button className="primary-btn" type="submit" disabled={!canSubmit}>
              Pay Now
            </button>
            {status ? <div className="status">{status}</div> : null}
          </form>
        </div>
      </div>
    </div>
  );
}
