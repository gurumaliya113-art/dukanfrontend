import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { apiFetch } from "../api";

const formatDate = (value) => {
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString();
  } catch {
    return "";
  }
};

export default function AccountPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });

  const [offerPopup, setOfferPopup] = useState({ open: false, orderId: "" });

  const isLoggedIn = !!user;

  const loadOrders = async () => {
    setStatus({ type: "", message: "" });
    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token || "";
      if (!token) {
        setOrders([]);
        return;
      }

      const res = await apiFetch("/customer/orders", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = payload?.error || payload?.message || `Failed (${res.status})`;
        throw new Error(msg);
      }

      setOrders(Array.isArray(payload?.orders) ? payload.orders : []);
    } catch (e) {
      console.error(e);
      setStatus({ type: "error", message: e?.message || "Failed to load orders" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const refresh = async () => {
      const { data } = await supabase.auth.getSession();
      setUser(data?.session?.user || null);
    };

    refresh();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      refresh();
    });

    return () => {
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (isLoggedIn) loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) return;

    const orderId = location?.state?.offerOrderId ? String(location.state.offerOrderId) : "";
    if (!orderId) return;

    setOfferPopup({ open: true, orderId });

    // Clear navigation state so popup doesn't show again on refresh/back.
    navigate(location.pathname, { replace: true, state: {} });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, location.pathname]);

  const onRequestReturn = async (orderId) => {
    setStatus({ type: "", message: "" });

    const reason = window.prompt("Reason for return (optional):", "") || "";

    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token || "";
      if (!token) throw new Error("Please login first");

      const res = await apiFetch(`/customer/orders/${encodeURIComponent(orderId)}/return`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: reason.trim() || null }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = payload?.error || payload?.message || `Failed (${res.status})`;
        throw new Error(msg);
      }

      setStatus({ type: "success", message: "Return requested" });
      await loadOrders();
    } catch (e) {
      console.error(e);
      setStatus({ type: "error", message: e?.message || "Return request failed" });
    }
  };

  const showLogin = () => {
    navigate(`/login?redirect=${encodeURIComponent("/account")}`);
  };

  const onPayNowOffer = () => {
    const id = String(offerPopup.orderId || "").trim();
    if (!id) {
      setOfferPopup({ open: false, orderId: "" });
      return;
    }
    navigate(`/payment?payOrderId=${encodeURIComponent(id)}`);
  };

  const displayName = useMemo(() => {
    if (!user) return "";
    return user.email || user.phone || user.id;
  }, [user]);

  return (
    <div className="section">
      <div className="container">
        {offerPopup.open ? (
          <div className="success-overlay" role="dialog" aria-modal="true" aria-label="Pay offer">
            <div className="success-modal">
              <div className="success-title">Pay now & get 10% OFF</div>
              <div className="success-subtitle">Offer for Order ID: {offerPopup.orderId}</div>
              <div style={{ marginTop: 14, display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
                <button className="primary-btn" type="button" onClick={onPayNowOffer}>
                  Pay Now
                </button>
                <button
                  className="secondary-btn"
                  type="button"
                  onClick={() => setOfferPopup({ open: false, orderId: "" })}
                >
                  Later
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <h1 className="section-title">My Account</h1>
        <p className="section-subtitle">Order history and returns</p>

        {!isLoggedIn ? (
          <div className="auth-card" style={{ marginTop: 16, maxWidth: 720 }}>
            <div className="summary-title">Login required</div>
            <p className="summary-meta" style={{ marginTop: 8 }}>
              Please login to view your past orders.
            </p>
            <button className="primary-btn" type="button" onClick={showLogin}>
              Login
            </button>
          </div>
        ) : (
          <>
            <div className="auth-card" style={{ marginTop: 16 }}>
              <div className="summary-title">Logged in as</div>
              <div className="summary-meta" style={{ marginTop: 6 }}>
                {displayName}
              </div>
              <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button className="secondary-btn" type="button" onClick={loadOrders} disabled={loading}>
                  {loading ? "Refreshing…" : "Refresh"}
                </button>
              </div>
            </div>

            <div style={{ marginTop: 18 }}>
              <div className="summary-title">Order History</div>
              <div className="summary-meta" style={{ marginTop: 6 }}>
                {loading ? "Loading…" : `${orders.length} orders`}
              </div>

              {orders.length === 0 && !loading ? (
                <p className="status" style={{ marginTop: 12 }}>
                  No orders found for this account.
                </p>
              ) : null}

              <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
                {orders.map((o) => {
                  const id = o.id;
                  const canReturn = !o.return_status;
                  const received = Array.isArray(o.tracking_received) ? o.tracking_received : [];

                  const statusNorm = String(o.status || "").trim().toLowerCase();
                  const confirmedDone =
                    statusNorm === "confirmed" || statusNorm === "shipped" || statusNorm === "delivered";
                  const shippedDone = !!o.picked_up_at || statusNorm === "shipped" || statusNorm === "delivered";
                  const outForDeliveryDone =
                    !!o.out_for_delivery || !!o.out_for_delivery_at || statusNorm === "delivered";
                  const deliveredDone = !!o.delivered_at || statusNorm === "delivered";

                  const steps = [
                    { key: "placed", label: "Order Placed", done: true },
                    { key: "confirmed", label: "Confirmed", done: confirmedDone },
                    { key: "shipped", label: "Shipped", done: shippedDone },
                    { key: "out", label: "Out for Delivery", done: outForDeliveryDone },
                    { key: "delivered", label: "Delivered", done: deliveredDone },
                  ];

                  return (
                    <div key={id} className="cart-card" style={{ padding: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <div>
                          <div className="summary-title">{o.product_name || "Order"}</div>
                          <div className="summary-meta" style={{ marginTop: 6 }}>
                            Order ID: {id}
                          </div>
                          <div className="summary-meta">Date: {formatDate(o.created_at)}</div>
                          {o.size ? <div className="summary-meta">Size: {o.size}</div> : null}
                          <div className="summary-meta">
                            Amount: {o.amount} {o.currency || ""}
                          </div>
                          <div className="summary-meta">
                            Payment: {o.payment_method} · Status: {o.status}
                          </div>
                          <div className="summary-meta">
                            Return: {o.return_status ? o.return_status : "—"}
                          </div>

                          <div className="summary-meta" style={{ marginTop: 8, fontWeight: 600 }}>
                            Tracking
                          </div>

                          <div className="order-stepper" role="list" aria-label="Order tracking">
                            {steps.map((s, idx) => (
                              <React.Fragment key={s.key}>
                                <div className={`order-step-box${s.done ? " done" : ""}`} role="listitem">
                                  <div className="order-step-icon" aria-hidden="true">
                                    {s.done ? "✓" : ""}
                                  </div>
                                  <div className="order-step-label">{s.label}</div>
                                </div>
                                {idx < steps.length - 1 ? (
                                  <div
                                    className={`order-step-connector${steps[idx + 1].done ? " done" : ""}`}
                                    aria-hidden="true"
                                  />
                                ) : null}
                              </React.Fragment>
                            ))}
                          </div>

                          {received.length ? (
                            <div className="summary-meta" style={{ marginTop: 6 }}>
                              Received at:
                              <ul style={{ margin: "6px 0 0 18px" }}>
                                {received.slice(0, 5).map((u) => (
                                  <li key={u.id}>
                                    {u.location}
                                    {u.created_at ? ` — ${formatDate(u.created_at)}` : ""}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : (
                            <div className="summary-meta" style={{ marginTop: 6 }}>
                              Received at: —
                            </div>
                          )}
                        </div>

                        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                          <button
                            className={canReturn ? "secondary-btn" : "secondary-btn"}
                            type="button"
                            disabled={!canReturn}
                            onClick={() => onRequestReturn(id)}
                          >
                            {canReturn ? "Request Return" : "Return Requested"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {status.message ? (
          <p style={{ color: status.type === "error" ? "crimson" : "green", marginTop: 12 }}>
            {status.message}
          </p>
        ) : null}

        <p style={{ marginTop: 16 }}>
          <Link to="/">← Back to shop</Link>
        </p>
      </div>
    </div>
  );
}
