import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { CATEGORIES, normalizeCategory } from "../categories";
import { apiFetch, getApiBase } from "../api";

const initialForm = {
  name: "",
  category: "new",
  price_inr: "",
  price_usd: "",
  description: "",
};

const toDateTimeLocalValue = (iso) => {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  } catch {
    return "";
  }
};

const formatDateTime = (value) => {
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString();
  } catch {
    return "";
  }
};

export default function AdminPage() {
  const [form, setForm] = useState(initialForm);
  const [images, setImages] = useState([]);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [isSaving, setIsSaving] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(initialForm);
  const [editImages, setEditImages] = useState([]);
  const [isUpdatingId, setIsUpdatingId] = useState(null);
  const [editRemove, setEditRemove] = useState({
    image1: false,
    image2: false,
    image3: false,
    image4: false,
  });

  const [authMode, setAuthMode] = useState("login"); // login | create
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [isAuthBusy, setIsAuthBusy] = useState(false);
  const [admin, setAdmin] = useState(null);

  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState(null);

  const [orders, setOrders] = useState([]);
  const [isOrdersLoading, setIsOrdersLoading] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [trackingForm, setTrackingForm] = useState({
    estimatedDeliveryAt: "",
    pickedUpFrom: "",
    pickedUpAt: "",
    outForDelivery: "no",
    outForDeliveryAt: "",
    deliveredAt: "",
  });
  const [receivedLocation, setReceivedLocation] = useState("");
  const [receivedAt, setReceivedAt] = useState("");
  const [receivedNote, setReceivedNote] = useState("");
  const [isTrackingBusy, setIsTrackingBusy] = useState(false);

  const productCount = useMemo(() => products.length, [products]);

  const getAccessToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || "";
  };

  const refreshAdmin = async () => {
    const token = await getAccessToken();
    if (!token) {
      setAdmin(null);
      return;
    }

    const res = await apiFetch("/admin/me", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      setAdmin(null);
      return;
    }

    const data = await res.json().catch(() => ({}));
    setAdmin(data?.admin || null);
  };

  const loadProducts = async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch("/products");
      const data = await res.json();
      if (!res.ok) {
        const msg = data?.error || data?.message || "Failed to load products";
        throw new Error(msg);
      }
      setProducts(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setStatus({ type: "error", message: e.message });
    } finally {
      setIsLoading(false);
    }
  };

  const loadOrders = async () => {
    if (!admin) return;
    setIsOrdersLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Missing admin session");

      const res = await apiFetch(`/admin/orders?limit=200`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = payload?.error || payload?.message || `Failed (${res.status})`;
        throw new Error(msg);
      }

      const list = Array.isArray(payload?.orders) ? payload.orders : [];
      const weight = {
        pending: 0,
        confirmed: 1,
        shipped: 2,
        delivered: 3,
        cancelled: 4,
      };

      const sorted = [...list].sort((a, b) => {
        const sa = String(a?.status || "").toLowerCase();
        const sb = String(b?.status || "").toLowerCase();
        const wa = Object.prototype.hasOwnProperty.call(weight, sa) ? weight[sa] : 99;
        const wb = Object.prototype.hasOwnProperty.call(weight, sb) ? weight[sb] : 99;
        if (wa !== wb) return wa - wb;

        const ta = a?.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b?.created_at ? new Date(b.created_at).getTime() : 0;
        return tb - ta;
      });

      setOrders(sorted);
      if (!selectedOrderId && list.length) {
        setSelectedOrderId(String(list[0].id));
      }
    } catch (e) {
      console.error(e);
      setStatus({ type: "error", message: e.message || "Failed to load orders" });
    } finally {
      setIsOrdersLoading(false);
    }
  };

  useEffect(() => {
    refreshAdmin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (admin) {
      loadProducts();
      loadOrders();
    } else {
      setProducts([]);
      setOrders([]);
      setSelectedOrderId("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin]);

  useEffect(() => {
    if (!selectedOrderId) return;
    const o = orders.find((x) => String(x.id) === String(selectedOrderId));
    if (!o) return;

    setTrackingForm({
      estimatedDeliveryAt: toDateTimeLocalValue(o.estimated_delivery_at),
      pickedUpFrom: o.picked_up_from || "",
      pickedUpAt: toDateTimeLocalValue(o.picked_up_at),
      outForDelivery: o.out_for_delivery ? "yes" : "no",
      outForDeliveryAt: toDateTimeLocalValue(o.out_for_delivery_at),
      deliveredAt: toDateTimeLocalValue(o.delivered_at),
    });

    setReceivedLocation("");
    setReceivedAt("");
    setReceivedNote("");
  }, [selectedOrderId, orders]);

  const onTrackingChange = (e) => {
    const { name, value } = e.target;
    setTrackingForm((prev) => ({ ...prev, [name]: value }));
  };

  const onSaveTracking = async () => {
    setStatus({ type: "", message: "" });

    if (!admin) {
      setStatus({ type: "error", message: "Please login as admin first" });
      return;
    }
    if (!selectedOrderId) {
      setStatus({ type: "error", message: "Please select an order" });
      return;
    }

    setIsTrackingBusy(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Missing admin session");

      const res = await apiFetch(`/admin/orders/${encodeURIComponent(selectedOrderId)}/tracking`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          estimatedDeliveryAt: trackingForm.estimatedDeliveryAt || null,
          pickedUpFrom: trackingForm.pickedUpFrom || null,
          pickedUpAt: trackingForm.pickedUpAt || null,
          outForDelivery: trackingForm.outForDelivery === "yes",
          outForDeliveryAt: trackingForm.outForDeliveryAt || null,
          deliveredAt: trackingForm.deliveredAt || null,
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = payload?.error || payload?.message || `Failed (${res.status})`;
        throw new Error(msg);
      }

      setStatus({ type: "success", message: "Tracking updated" });
      await loadOrders();
    } catch (e) {
      console.error(e);
      setStatus({ type: "error", message: e.message || "Tracking update failed" });
    } finally {
      setIsTrackingBusy(false);
    }
  };

  const onAddReceived = async () => {
    setStatus({ type: "", message: "" });

    if (!admin) {
      setStatus({ type: "error", message: "Please login as admin first" });
      return;
    }
    if (!selectedOrderId) {
      setStatus({ type: "error", message: "Please select an order" });
      return;
    }
    if (!receivedLocation.trim()) {
      setStatus({ type: "error", message: "Please enter received location" });
      return;
    }

    setIsTrackingBusy(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Missing admin session");

      const res = await apiFetch(`/admin/orders/${encodeURIComponent(selectedOrderId)}/tracking/received`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          location: receivedLocation.trim(),
          receivedAt: receivedAt || null,
          note: receivedNote.trim() || null,
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = payload?.error || payload?.message || `Failed (${res.status})`;
        throw new Error(msg);
      }

      setStatus({ type: "success", message: "Received location added" });
      setReceivedLocation("");
      setReceivedAt("");
      setReceivedNote("");
      await loadOrders();
    } catch (e) {
      console.error(e);
      setStatus({ type: "error", message: e.message || "Failed to add received location" });
    } finally {
      setIsTrackingBusy(false);
    }
  };

  const onUpdateOrderStatus = async (orderId, nextStatus) => {
    setStatus({ type: "", message: "" });
    if (!admin) {
      setStatus({ type: "error", message: "Please login as admin first" });
      return;
    }

    setIsTrackingBusy(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Missing admin session");

      const res = await apiFetch(`/admin/orders/${encodeURIComponent(orderId)}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: nextStatus }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = payload?.error || payload?.message || `Failed (${res.status})`;
        throw new Error(msg);
      }

      setStatus({ type: "success", message: "Order status updated" });
      await loadOrders();
    } catch (e) {
      console.error(e);
      setStatus({ type: "error", message: e.message || "Failed to update order status" });
    } finally {
      setIsTrackingBusy(false);
    }
  };

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setStatus({ type: "", message: "" });

    if (!admin) {
      setStatus({ type: "error", message: "Please login as admin first" });
      return;
    }

    if (!form.name.trim() || form.price_inr === "" || form.price_usd === "") {
      setStatus({ type: "error", message: "Name + Price INR + Price USD required hai" });
      return;
    }

    setIsSaving(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Missing admin session");

      const body = new FormData();
      body.append("category", normalizeCategory(form.category));
      body.append("name", form.name);
      body.append("price_inr", form.price_inr);
      body.append("price_usd", form.price_usd);
      body.append("price", form.price_inr);
      body.append("description", form.description);
      images.slice(0, 4).forEach((file) => body.append("images", file));

      const res = await apiFetch("/products", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body,
      });

      const data = await res.json();
      if (!res.ok) {
        const message = data?.error || data?.message || "Product add failed";
        throw new Error(message);
      }

      setStatus({ type: "success", message: `Added: ${data.name}` });
      setForm(initialForm);
      setImages([]);
      loadProducts();
    } catch (err) {
      console.error(err);
      setStatus({ type: "error", message: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const onDelete = async (productId, productName) => {
    setStatus({ type: "", message: "" });

    if (!admin) {
      setStatus({ type: "error", message: "Please login as admin first" });
      return;
    }

    const ok = window.confirm(`Delete "${productName}"?`);
    if (!ok) return;

    setIsDeletingId(productId);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Missing admin session");

      const res = await apiFetch(`/products/${productId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.error || data?.message || `Delete failed (${res.status})`;
        throw new Error(msg);
      }

      setProducts((prev) => prev.filter((p) => p.id !== productId));
      setStatus({ type: "success", message: `Deleted: ${productName}` });
    } catch (e) {
      console.error(e);
      setStatus({ type: "error", message: e.message });
    } finally {
      setIsDeletingId(null);
    }
  };

  const onStartEdit = (p) => {
    setStatus({ type: "", message: "" });
    setEditingId(p.id);
    setEditForm({
      name: p.name || "",
      category: normalizeCategory(p.category),
      price_inr: p.price_inr ?? p.price ?? "",
      price_usd: p.price_usd ?? "",
      description: p.description || "",
    });
    setEditImages([]);
    setEditRemove({ image1: false, image2: false, image3: false, image4: false });
  };

  const onCancelEdit = () => {
    setEditingId(null);
    setEditForm(initialForm);
    setEditImages([]);
    setEditRemove({ image1: false, image2: false, image3: false, image4: false });
  };

  const onToggleRemoveImage = (slot) => {
    setEditRemove((prev) => ({ ...prev, [slot]: !prev[slot] }));
  };

  const onEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const onUpdate = async (productId) => {
    setStatus({ type: "", message: "" });

    if (!admin) {
      setStatus({ type: "error", message: "Please login as admin first" });
      return;
    }

    if (!editForm.name.trim() || editForm.price_inr === "" || editForm.price_usd === "") {
      setStatus({ type: "error", message: "Name + Price INR + Price USD required hai" });
      return;
    }

    setIsUpdatingId(productId);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Missing admin session");

      const body = new FormData();
      body.append("category", normalizeCategory(editForm.category));
      body.append("name", editForm.name);
      body.append("price_inr", editForm.price_inr);
      body.append("price_usd", editForm.price_usd);
      body.append("price", editForm.price_inr);
      body.append("description", editForm.description);

      if (editRemove.image1) body.append("removeImage1", "1");
      if (editRemove.image2) body.append("removeImage2", "1");
      if (editRemove.image3) body.append("removeImage3", "1");
      if (editRemove.image4) body.append("removeImage4", "1");

      editImages.slice(0, 4).forEach((file) => body.append("images", file));

      const res = await apiFetch(`/products/${productId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.error || data?.message || `Update failed (${res.status})`;
        throw new Error(msg);
      }

      setProducts((prev) => prev.map((p) => (p.id === productId ? data : p)));
      setStatus({ type: "success", message: `Updated: ${data.name}` });
      onCancelEdit();
    } catch (e) {
      console.error(e);
      setStatus({ type: "error", message: e.message });
    } finally {
      setIsUpdatingId(null);
    }
  };

  const onLogin = async (e) => {
    e.preventDefault();
    setStatus({ type: "", message: "" });

    if (!authEmail.trim() || !authPassword) {
      setStatus({ type: "error", message: "Email and password required" });
      return;
    }

    setIsAuthBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: authEmail.trim(),
        password: authPassword,
      });
      if (error) throw error;

      await refreshAdmin();
      setStatus({ type: "success", message: "Logged in" });
    } catch (e2) {
      console.error(e2);
      setStatus({ type: "error", message: e2.message || "Login failed" });
    } finally {
      setIsAuthBusy(false);
    }
  };

  const onCreateAccount = async (e) => {
    e.preventDefault();
    setStatus({ type: "", message: "" });

    if (!authEmail.trim() || !authPassword) {
      setStatus({ type: "error", message: "Email and password required" });
      return;
    }

    if (!inviteCode.trim()) {
      setStatus({ type: "error", message: "Invite code required" });
      return;
    }

    setIsAuthBusy(true);
    try {
      const res = await apiFetch("/admin/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: authEmail.trim(),
          password: authPassword,
          inviteCode: inviteCode.trim(),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.error || data?.message || `Create failed (${res.status})`;
        throw new Error(msg);
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: authEmail.trim(),
        password: authPassword,
      });
      if (error) throw error;

      await refreshAdmin();
      setStatus({ type: "success", message: "Admin account created and logged in" });
    } catch (e2) {
      console.error(e2);
      const raw = String(e2?.message || "");
      const looksLikeNetwork = /failed to fetch|networkerror|load failed|fetch/i.test(raw);
      if (looksLikeNetwork) {
        const base = getApiBase() || "(empty)";
        setStatus({
          type: "error",
          message:
            `Failed to reach backend (${base}). Replit backend run/deploy karo aur Netlify env me REACT_APP_API_URL ko public URL (replit.app / repl.co) pe set karke redeploy karo.`,
        });
      } else {
        setStatus({ type: "error", message: raw || "Create account failed" });
      }
    } finally {
      setIsAuthBusy(false);
    }
  };

  const onLogout = async () => {
    setStatus({ type: "", message: "" });
    await supabase.auth.signOut();
    setAdmin(null);
    setProducts([]);
    setStatus({ type: "success", message: "Logged out" });
  };

  return (
    <div className="section">
      <div className="container" style={{ maxWidth: 980 }}>
        <h1 className="section-title">Admin Panel</h1>
        <p className="section-subtitle">Add products to your store</p>

        <div className="auth-card" style={{ marginTop: 16 }}>
          <div className="auth-head">
            <div>
              <div className="summary-title">Admin Login</div>
              <div className="summary-meta">
                {admin?.email ? `Logged in as: ${admin.email}` : "Login required to add/delete products"}
              </div>
            </div>
            {admin ? (
              <button className="secondary-btn" type="button" onClick={onLogout}>
                Logout
              </button>
            ) : null}
          </div>

          <div className="summary-meta" style={{ marginTop: 10 }}>
            Need customer login?{" "}
            <Link to="/login" style={{ fontWeight: 600 }}>
              Login
            </Link>
          </div>

          {!admin ? (
            <>
              <div className="auth-tabs" role="tablist" aria-label="Admin auth">
                <button
                  type="button"
                  className={authMode === "login" ? "auth-tab active" : "auth-tab"}
                  onClick={() => setAuthMode("login")}
                >
                  Login
                </button>
                <button
                  type="button"
                  className={authMode === "create" ? "auth-tab active" : "auth-tab"}
                  onClick={() => setAuthMode("create")}
                >
                  Create Account
                </button>
              </div>

              <form
                onSubmit={authMode === "login" ? onLogin : onCreateAccount}
                className="auth-form"
              >
                <label>
                  Email*
                  <input
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="admin@gmail.com"
                  />
                </label>

                <label>
                  Password*
                  <input
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    type="password"
                    placeholder="••••••••"
                  />
                </label>

                {authMode === "create" ? (
                  <label>
                    Invite Code*
                    <input
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value)}
                      placeholder="ADMIN_INVITE_CODE"
                    />
                  </label>
                ) : null}

                <button className="primary-btn" type="submit" disabled={isAuthBusy}>
                  {isAuthBusy
                    ? "Please wait…"
                    : authMode === "login"
                      ? "Login"
                      : "Create Admin Account"}
                </button>
              </form>
            </>
          ) : null}
        </div>

      {status.message ? (
        <p style={{ color: status.type === "error" ? "crimson" : "green" }}>
          {status.message}
        </p>
      ) : null}

      {admin ? (
        <>
          <div style={{ marginTop: 18 }}>
            <h2 className="section-title" style={{ fontSize: 28 }}>
              Orders ({orders.length})
            </h2>
            <p className="section-subtitle">All incoming orders on this website</p>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <button
                className="secondary-btn"
                type="button"
                onClick={loadOrders}
                disabled={isOrdersLoading || isTrackingBusy}
              >
                {isOrdersLoading ? "Loading…" : "Refresh Orders"}
              </button>
            </div>

            {isOrdersLoading ? <p className="status">Loading…</p> : null}
            {!isOrdersLoading && orders.length === 0 ? <p className="status">No orders yet.</p> : null}

            <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
              {orders.map((o) => (
                <div key={o.id} className="cart-card" style={{ padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <div className="summary-title">{o.product_name || "Order"}</div>
                      <div className="summary-meta" style={{ marginTop: 6 }}>
                        Order ID: {o.id}
                      </div>
                      <div className="summary-meta">Date: {formatDateTime(o.created_at)}</div>
                      {o.size ? <div className="summary-meta">Size: {o.size}</div> : null}
                      <div className="summary-meta">
                        Amount: {o.amount} {o.currency || ""} · Payment: {o.payment_method}
                      </div>
                      <div className="summary-meta">Status: {o.status}</div>
                      {o.return_status ? <div className="summary-meta">Return: {o.return_status}</div> : null}

                      <div className="summary-meta" style={{ marginTop: 10, fontWeight: 600 }}>
                        Customer Details
                      </div>
                      <div className="summary-meta">Name: {o.customer_name || "—"}</div>
                      <div className="summary-meta">Phone: {o.phone || "—"}</div>
                      <div className="summary-meta">Email: {o.email || "—"}</div>
                      <div className="summary-meta">
                        Address: {o.address || ""}{o.city ? `, ${o.city}` : ""}{o.state ? `, ${o.state}` : ""}{o.pincode ? ` - ${o.pincode}` : ""}
                      </div>
                    </div>

                    <div style={{ minWidth: 220 }}>
                      <label style={{ display: "grid", gap: 6 }}>
                        Update Status
                        <select
                          value={o.status || "pending"}
                          onChange={(e) => onUpdateOrderStatus(o.id, e.target.value)}
                          disabled={isTrackingBusy}
                          style={{ width: "100%" }}
                        >
                          <option value="pending">pending</option>
                          <option value="confirmed">confirmed</option>
                          <option value="shipped">shipped</option>
                          <option value="delivered">delivered</option>
                          <option value="cancelled">cancelled</option>
                        </select>
                      </label>

                      <button
                        className="secondary-btn"
                        type="button"
                        onClick={() => setSelectedOrderId(String(o.id))}
                        disabled={isTrackingBusy}
                        style={{ marginTop: 10, width: "100%" }}
                      >
                        Open in Tracking Panel
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={onSubmit} style={{ display: "grid", gap: 12, marginTop: 18 }}>
            <label>
              Category*
              <select
                name="category"
                value={form.category}
                onChange={onChange}
                style={{ width: "100%" }}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Name*
              <input
                name="name"
                value={form.name}
                onChange={onChange}
                style={{ width: "100%" }}
              />
            </label>

            <label>
              Price INR (India)*
              <input
                name="price_inr"
                value={form.price_inr}
                onChange={onChange}
                type="number"
                style={{ width: "100%" }}
              />
            </label>

            <label>
              Price USD (USA)*
              <input
                name="price_usd"
                value={form.price_usd}
                onChange={onChange}
                type="number"
                style={{ width: "100%" }}
              />
            </label>

            <label>
              Description
              <textarea
                name="description"
                value={form.description}
                onChange={onChange}
                rows={3}
                style={{ width: "100%" }}
              />
            </label>

            <label>
              Product Images (max 4)
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                onChange={(e) => setImages(Array.from(e.target.files || []))}
              />
            </label>

            {images.length ? (
              <div className="status">
                Selected: {images.slice(0, 4).map((f) => f.name).join(", ")}
              </div>
            ) : null}

            <button className="primary-btn" type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Add Product"}
            </button>
          </form>

          <div style={{ marginTop: 28 }}>
            <h2 className="section-title" style={{ fontSize: 28 }}>
              Products ({productCount})
            </h2>

            {isLoading ? <p className="status">Loading…</p> : null}

            {!isLoading && products.length === 0 ? (
              <p className="status">No products yet.</p>
            ) : null}

            <div className="admin-list" aria-label="All products">
              {products.map((p) => (
                <div key={p.id}>
                  <div className="admin-item">
                    <div className="admin-thumb">
                      <img
                        src={p.image1 || "https://via.placeholder.com/120"}
                        alt={p.name}
                      />
                    </div>

                    <div className="admin-meta">
                      <div className="summary-title">{p.name}</div>
                      <div className="summary-meta">
                        INR: ₹{p.price_inr ?? p.price}
                        {p.price_usd !== undefined && p.price_usd !== null && p.price_usd !== "" ? ` · USA: $${p.price_usd}` : ""}
                      </div>
                      <div className="summary-meta">ID: {p.id}</div>
                    </div>

                    <div className="admin-actions">
                      {editingId === p.id ? (
                        <>
                          <button
                            className="secondary-btn"
                            type="button"
                            onClick={() => onUpdate(p.id)}
                            disabled={isUpdatingId === p.id}
                          >
                            {isUpdatingId === p.id ? "Saving…" : "Save"}
                          </button>
                          <button
                            className="secondary-btn"
                            type="button"
                            onClick={onCancelEdit}
                            disabled={isUpdatingId === p.id}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          className="secondary-btn"
                          type="button"
                          onClick={() => onStartEdit(p)}
                        >
                          Edit
                        </button>
                      )}

                      <button
                        className="secondary-btn"
                        type="button"
                        onClick={() => onDelete(p.id, p.name)}
                        disabled={isDeletingId === p.id || editingId === p.id}
                        style={{ marginLeft: 10 }}
                      >
                        {isDeletingId === p.id ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </div>

                  {editingId === p.id ? (
                    <div className="admin-edit" aria-label="Edit product">
                      <div className="admin-edit-images" aria-label="Existing images">
                        {["image1", "image2", "image3", "image4"].map((slot) => {
                          const url = p?.[slot];
                          const removed = !!editRemove?.[slot];
                          return (
                            <div key={slot} className={removed ? "admin-edit-img removed" : "admin-edit-img"}>
                              {url ? (
                                <img src={url} alt="" />
                              ) : (
                                <div className="admin-edit-img-empty" />
                              )}
                              {url ? (
                                <button
                                  type="button"
                                  className="admin-img-btn"
                                  onClick={() => onToggleRemoveImage(slot)}
                                  disabled={isUpdatingId === p.id}
                                >
                                  {removed ? "Undo" : "Remove"}
                                </button>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>

                      <div className="admin-edit-grid">
                            <label>
                              Category*
                              <select
                                name="category"
                                value={editForm.category}
                                onChange={onEditChange}
                                disabled={isUpdatingId === p.id}
                              >
                                {CATEGORIES.map((c) => (
                                  <option key={c.value} value={c.value}>
                                    {c.label}
                                  </option>
                                ))}
                              </select>
                            </label>

                        <label>
                          Name*
                          <input
                            name="name"
                            value={editForm.name}
                            onChange={onEditChange}
                          />
                        </label>

                        <label>
                          Price INR*
                          <input
                            name="price_inr"
                            value={editForm.price_inr}
                            onChange={onEditChange}
                            type="number"
                          />
                        </label>

                        <label>
                          Price USD*
                          <input
                            name="price_usd"
                            value={editForm.price_usd}
                            onChange={onEditChange}
                            type="number"
                          />
                        </label>
                      </div>

                      <label>
                        Description
                        <textarea
                          name="description"
                          value={editForm.description}
                          onChange={onEditChange}
                          rows={3}
                        />
                      </label>

                      <label>
                        Replace Images (optional, max 4)
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          multiple
                          onChange={(e) => setEditImages(Array.from(e.target.files || []))}
                          disabled={isUpdatingId === p.id}
                        />
                      </label>

                      {editImages.length ? (
                        <div className="status">
                          Selected: {editImages.slice(0, 4).map((f) => f.name).join(", ")}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 28 }}>
            <h2 className="section-title" style={{ fontSize: 28 }}>
              Order Tracking
            </h2>
            <p className="section-subtitle">
              Manual entry: estimated delivery, pickup, received locations, out for delivery
            </p>

            <div className="auth-card" style={{ marginTop: 12 }}>
              <div style={{ display: "grid", gap: 10 }}>
                <label>
                  Select Order*
                  <select
                    value={selectedOrderId}
                    onChange={(e) => setSelectedOrderId(e.target.value)}
                    style={{ width: "100%" }}
                  >
                    <option value="">-- Select --</option>
                    {orders.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.id} · {o.product_name || "Order"} · {o.customer_name || ""}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  className="secondary-btn"
                  type="button"
                  onClick={loadOrders}
                  disabled={isOrdersLoading || isTrackingBusy}
                >
                  {isOrdersLoading ? "Loading…" : "Refresh Orders"}
                </button>
              </div>

              {selectedOrderId ? (
                <>
                  <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
                    <label>
                      Estimated delivery (date & time)
                      <input
                        name="estimatedDeliveryAt"
                        type="datetime-local"
                        value={trackingForm.estimatedDeliveryAt}
                        onChange={onTrackingChange}
                        style={{ width: "100%" }}
                      />
                    </label>

                    <label>
                      Picked up from
                      <input
                        name="pickedUpFrom"
                        type="text"
                        placeholder="e.g., Delhi"
                        value={trackingForm.pickedUpFrom}
                        onChange={onTrackingChange}
                        style={{ width: "100%" }}
                      />
                    </label>

                    <label>
                      Picked up at (date & time)
                      <input
                        name="pickedUpAt"
                        type="datetime-local"
                        value={trackingForm.pickedUpAt}
                        onChange={onTrackingChange}
                        style={{ width: "100%" }}
                      />
                    </label>

                    <label>
                      Out for delivery (Yes/No)
                      <select
                        name="outForDelivery"
                        value={trackingForm.outForDelivery}
                        onChange={onTrackingChange}
                        style={{ width: "100%" }}
                      >
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                      </select>
                    </label>

                    <label>
                      Out for delivery at (date & time)
                      <input
                        name="outForDeliveryAt"
                        type="datetime-local"
                        value={trackingForm.outForDeliveryAt}
                        onChange={onTrackingChange}
                        style={{ width: "100%" }}
                      />
                    </label>

                    <label>
                      Delivered at (date & time)
                      <input
                        name="deliveredAt"
                        type="datetime-local"
                        value={trackingForm.deliveredAt}
                        onChange={onTrackingChange}
                        style={{ width: "100%" }}
                      />
                    </label>

                    <button
                      className="primary-btn"
                      type="button"
                      onClick={onSaveTracking}
                      disabled={isTrackingBusy}
                    >
                      {isTrackingBusy ? "Saving…" : "Save Tracking"}
                    </button>
                  </div>

                  <div style={{ marginTop: 16 }}>
                    <div className="summary-title">Received at (multiple)</div>
                    <div className="summary-meta">Add as many checkpoints as needed</div>

                    <div style={{ display: "grid", gap: 12, marginTop: 10 }}>
                      <label>
                        Received location*
                        <input
                          type="text"
                          placeholder="e.g., Gurgaon"
                          value={receivedLocation}
                          onChange={(e) => setReceivedLocation(e.target.value)}
                          style={{ width: "100%" }}
                        />
                      </label>

                      <label>
                        Date & time (optional)
                        <input
                          type="datetime-local"
                          value={receivedAt}
                          onChange={(e) => setReceivedAt(e.target.value)}
                          style={{ width: "100%" }}
                        />
                      </label>

                      <label>
                        Note (optional)
                        <input
                          type="text"
                          value={receivedNote}
                          onChange={(e) => setReceivedNote(e.target.value)}
                          style={{ width: "100%" }}
                        />
                      </label>

                      <button
                        className="secondary-btn"
                        type="button"
                        onClick={onAddReceived}
                        disabled={isTrackingBusy}
                      >
                        {isTrackingBusy ? "Adding…" : "Add Received Location"}
                      </button>
                    </div>

                    <div style={{ marginTop: 12 }}>
                      {(() => {
                        const o = orders.find((x) => String(x.id) === String(selectedOrderId));
                        const received = Array.isArray(o?.tracking_received) ? o.tracking_received : [];
                        if (!received.length) return <p className="status">No received updates yet.</p>;
                        return (
                          <div className="status" style={{ display: "grid", gap: 6 }}>
                            {received.slice(0, 10).map((u) => (
                              <div key={u.id}>
                                - {u.location}
                                {u.created_at ? ` (${new Date(u.created_at).toLocaleString()})` : ""}
                                {u.note ? ` · ${u.note}` : ""}
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </>
              ) : (
                <p className="status" style={{ marginTop: 12 }}>
                  Select an order to update tracking.
                </p>
              )}
            </div>
          </div>
        </>
      ) : null}

      </div>
    </div>
  );
}
