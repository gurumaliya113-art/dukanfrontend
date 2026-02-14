import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useCart } from "../cartContext";
import { useRegion } from "../regionContext";
import { formatMoney, getCartItemUnitPrice, getProductUnitPrice } from "../pricing";
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import { apiFetch } from "../api";
import { supabase } from "../supabaseClient";

export default function PaymentPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const cart = useCart();

  const fromCart = params.get("fromCart") === "1";

  const productId = useMemo(() => Number(params.get("productId")), [params]);
  const size = params.get("size") || "";

  const checkoutForm = location.state?.form || null;
  const cartItems = location.state?.cartItems || null;
  const { region } = useRegion();

  const cartMode = fromCart || (Array.isArray(cartItems) && cartItems.length > 0);

  const cartTotal = useMemo(() => {
    if (!Array.isArray(cartItems)) return 0;
    return cartItems.reduce(
      (sum, item) => {
        const unit = getCartItemUnitPrice(item, region);
        return sum + (Number(unit.amount) || 0) * (Number(item.qty) || 0);
      },
      0
    );
  }, [cartItems, region]);

  const cartTotalCurrency = useMemo(() => {
    const first = Array.isArray(cartItems)
      ? cartItems.find((x) => (Number(getCartItemUnitPrice(x, region).amount) || 0) > 0)
      : null;
    return first ? getCartItemUnitPrice(first, region).currency : (region === "US" ? "USD" : "INR");
  }, [cartItems, region]);

  const [product, setProduct] = useState(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [placing, setPlacing] = useState(false);
  const [qrMissing, setQrMissing] = useState(false);
  const [qrSrc, setQrSrc] = useState("/qr.png");
  const [paypalClientId, setPaypalClientId] = useState("");
  const [paypalError, setPaypalError] = useState("");

  const [codSuccessOpen, setCodSuccessOpen] = useState(false);
  const [codSuccessIds, setCodSuccessIds] = useState([]);

  const canUsePayPal = region === "US";

  useEffect(() => {
    if (cartMode) {
      setProduct(null);
      setError("");
      return;
    }

    if (Number.isNaN(productId)) {
      setError("Invalid payment link");
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

  useEffect(() => {
    if (!canUsePayPal) {
      setPaypalClientId("");
      setPaypalError("");
      return;
    }

    apiFetch("/paypal/config")
      .then((r) => r.json())
      .then((d) => {
        const id = d?.clientId || "";
        setPaypalClientId(id);
        setPaypalError(id ? "" : "PayPal client id missing (backend/.env)");
      })
      .catch((e) => {
        console.error(e);
        setPaypalError("Failed to load PayPal config");
      });
  }, [canUsePayPal]);

  const canPlaceCod = cartMode
    ? !!(Array.isArray(cartItems) && cartItems.length && checkoutForm)
    : !!(product && size && checkoutForm);

  const canPlacePayPal = canUsePayPal && canPlaceCod;

  const getPayPalItems = () => {
    if (cartMode) {
      return (cartItems || []).map((i) => ({
        productId: i.productId,
        size: i.size,
        qty: Math.max(1, Number(i.qty) || 1),
      }));
    }
    return [{ productId, size, qty: 1 }];
  };

  const capturePayPalOrder = async (orderID) => {
    setStatus("");
    setPaypalError("");

    if (!checkoutForm) {
      setPaypalError("Please go back and fill delivery details first");
      return;
    }

    if (!cartMode) {
      if (!size) {
        setPaypalError("Please go back and select a size");
        return;
      }
      if (!product) {
        setPaypalError("Product not loaded");
        return;
      }
    } else {
      if (!Array.isArray(cartItems) || cartItems.length === 0) {
        setPaypalError("Cart items missing. Go back to cart.");
        return;
      }
    }

    try {
      setPlacing(true);

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || "";
      const res = await apiFetch("/paypal/capture-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          orderID,
          currency: "USD",
          items: getPayPalItems(),
          fullName: checkoutForm.fullName,
          email: checkoutForm.email,
          phone: checkoutForm.phone,
          address: checkoutForm.address,
          city: checkoutForm.city,
          state: checkoutForm.state,
          pincode: checkoutForm.pincode,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.error || data?.message || `PayPal failed (${res.status})`;
        throw new Error(msg);
      }

      const ids = Array.isArray(data?.orders) ? data.orders : [];
      setStatus(ids.length ? `Payment successful. Order IDs: ${ids.join(", ")}` : "Payment successful.");
    } catch (e) {
      console.error(e);
      setPaypalError(e.message || "PayPal payment failed");
    } finally {
      setPlacing(false);
    }
  };

  const placeCodOrder = async () => {
    setStatus("");

    if (!checkoutForm) {
      setStatus("Please go back and fill delivery details first");
      return;
    }

    if (!cartMode) {
      if (!size) {
        setStatus("Please go back and select a size");
        return;
      }

      if (!product) {
        setStatus("Product not loaded");
        return;
      }
    } else {
      if (!Array.isArray(cartItems) || cartItems.length === 0) {
        setStatus("Cart items missing. Go back to cart.");
        return;
      }
    }

    try {
      setPlacing(true);

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || "";

      const base = {
        fullName: checkoutForm.fullName,
        email: checkoutForm.email,
        phone: checkoutForm.phone,
        address: checkoutForm.address,
        city: checkoutForm.city,
        state: checkoutForm.state,
        pincode: checkoutForm.pincode,
        paymentMethod: "COD",
      };

      const placeOne = async ({ productId: pid, size: s, currency, unitPrice }) => {
        const res = await apiFetch("/orders", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ ...base, productId: pid, size: s, currency, unitPrice }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg = data?.error || data?.message || `Failed (${res.status})`;
          throw new Error(msg);
        }
        return data;
      };

      if (!cartMode) {
        const unit = getProductUnitPrice(product, region);
        const placed = await placeOne({
          productId: product.id,
          size,
          currency: unit.currency,
          unitPrice: unit.amount,
        });
        setCodSuccessIds(placed?.id ? [placed.id] : []);
        setCodSuccessOpen(true);
        window.setTimeout(() => navigate("/account", { replace: true }), 3000);
        return;
      }

      const expanded = [];
      for (const item of cartItems) {
        const qty = Math.max(1, Number(item.qty) || 1);
        const unit = getCartItemUnitPrice(item, region);
        for (let i = 0; i < qty; i++) {
          expanded.push({
            productId: item.productId,
            size: item.size,
            currency: unit.currency,
            unitPrice: unit.amount,
          });
        }
      }

      const results = [];
      for (const req of expanded) {
        // Sequential so we can stop at first failure with a useful message.
        // (Backend inserts are fast; cart sizes are typically small.)
        // eslint-disable-next-line no-await-in-loop
        const placed = await placeOne(req);
        results.push(placed);
      }

      const ids = results.map((r) => r.id).filter(Boolean);
      if (cartMode) cart.clear();
      setCodSuccessIds(ids);
      setCodSuccessOpen(true);
      window.setTimeout(() => navigate("/account", { replace: true }), 3000);
    } catch (e) {
      console.error(e);
      setStatus(e.message || "Failed to place COD order");
    } finally {
      setPlacing(false);
    }
  };

  if (error) {
    return (
      <div className="section">
        <div className="container">
          <h1 className="section-title">Payment</h1>
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
          <h1 className="section-title">Payment</h1>
          <p className="status">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="section">
      {codSuccessOpen ? (
        <div className="success-overlay" role="dialog" aria-modal="true" aria-label="Order placed">
          <div className="success-modal">
            <div className="success-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true">
                <path
                  d="M20 6 9 17l-5-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="success-title">Your order has been placed</div>
            <div className="success-subtitle">Redirecting to My Orders…</div>
            {codSuccessIds.length ? (
              <div className="success-meta">Order ID{codSuccessIds.length > 1 ? "s" : ""}: {codSuccessIds.join(", ")}</div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="container">
        <h1 className="section-title">Choose Payment Option</h1>
        <p className="section-subtitle">Scan QR or place COD order.</p>

        <div className="payment-grid">
          <div className="payment-card">
            <div className="summary-title">Order Summary</div>
            {cartMode ? (
              <>
                <div className="summary-meta">{cartItems?.length || 0} items</div>
                <div className="summary-lines" role="list">
                  {(cartItems || []).map((item) => (
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
                  <Link to="/checkout?fromCart=1">← Back to checkout</Link>
                </p>
              </>
            ) : (
              <>
                <div className="summary-meta">{product.name}</div>
                <div className="summary-meta">Size: {size || "—"}</div>
                <div className="summary-meta">
                  {(() => {
                    const unit = getProductUnitPrice(product, region);
                    return `Amount: ${formatMoney(unit.amount, unit.currency)}`;
                  })()}
                </div>

                <p style={{ marginTop: 14 }}>
                  <Link
                    to={`/checkout?productId=${product.id}&size=${encodeURIComponent(
                      size
                    )}`}
                    state={{ form: checkoutForm }}
                  >
                    ← Back to checkout
                  </Link>
                </p>
              </>
            )}
          </div>

          {!canUsePayPal ? (
            <div className="payment-card">
              <div className="summary-title">Pay by QR</div>
              <p className="summary-meta" style={{ marginTop: 6 }}>
                Scan and pay using any UPI app.
              </p>
              <div className="qr-box" aria-label="QR code">
                {qrMissing ? (
                  <div className="status">
                    Add your QR image at <b>frontend/public/qr.png</b>
                  </div>
                ) : (
                  <img
                    src={qrSrc}
                    alt="UPI QR"
                    onError={() => {
                      if (qrSrc === "/qr.png") {
                        setQrSrc("/qr.png.jpeg");
                        return;
                      }
                      setQrMissing(true);
                    }}
                  />
                )}
              </div>
              <p className="summary-meta" style={{ marginTop: 10 }}>
                After payment, share the screenshot on WhatsApp.
              </p>
              <p className="summary-meta" style={{ marginTop: 8 }}>
                <a
                  href={`https://wa.me/919485615917?text=${encodeURIComponent(
                    "Hi, I have completed the payment. Screenshot attached."
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="nav-link"
                  style={{ padding: 0 }}
                >
                  Click here to send message
                </a>
              </p>
            </div>
          ) : (
            <div className="payment-card">
              <div className="summary-title">Pay with PayPal (USD)</div>

              {!canPlacePayPal ? (
                <p className="status">Go back and complete delivery details first.</p>
              ) : null}

              {paypalError ? <p className="status">{paypalError}</p> : null}

              {paypalClientId && canPlacePayPal ? (
                <PayPalScriptProvider options={{ clientId: paypalClientId, currency: "USD", intent: "capture" }}>
                  <PayPalButtons
                    style={{ layout: "vertical" }}
                    disabled={placing}
                    createOrder={async () => {
                      const res = await apiFetch("/paypal/create-order", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ currency: "USD", items: getPayPalItems() }),
                      });

                      const data = await res.json().catch(() => ({}));
                      if (!res.ok) {
                        const msg = data?.error || data?.message || `PayPal create failed (${res.status})`;
                        throw new Error(msg);
                      }

                      if (!data?.id) {
                        throw new Error("PayPal order id missing");
                      }

                      return data.id;
                    }}
                    onApprove={async (data) => {
                      await capturePayPalOrder(data.orderID);
                    }}
                    onError={(err) => {
                      console.error(err);
                      setPaypalError("PayPal error");
                    }}
                  />
                </PayPalScriptProvider>
              ) : null}
            </div>
          )}

          <div className="payment-card">
            <div className="summary-title">Cash on Delivery</div>
            <p className="summary-meta" style={{ marginTop: 6 }}>
              Place order now, pay when delivered.
            </p>

            <button
              className="primary-btn"
              type="button"
              onClick={placeCodOrder}
              disabled={!canPlaceCod || placing}
            >
              {placing ? "Placing COD Order…" : "Place COD Order"}
            </button>

            {status ? <div className="status" style={{ marginTop: 10 }}>{status}</div> : null}

            {!checkoutForm ? (
              <div className="status" style={{ marginTop: 10 }}>
                Delivery details missing. Go back to checkout.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
