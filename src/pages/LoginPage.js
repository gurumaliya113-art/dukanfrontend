import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { apiFetch, getApiBase } from "../api";

const isProbablyEmail = (value) => String(value || "").includes("@");

const normalizePhone = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  // Best practice: use E.164 (+91...).
  return raw;
};

export default function LoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const redirectTo = useMemo(() => {
    const r = params.get("redirect") || "";
    if (!r.startsWith("/")) return "/";
    return r;
  }, [params]);

  const onlyCustomer = useMemo(() => {
    const explicit = (params.get("only") || "").toLowerCase() === "customer";
    return explicit || redirectTo.startsWith("/checkout");
  }, [params, redirectTo]);

  const [sessionUser, setSessionUser] = useState(null);

  // Customer auth
  const [custMode, setCustMode] = useState("login");
  const [custIdentifier, setCustIdentifier] = useState("");
  const [custPassword, setCustPassword] = useState("");
  const [custBusy, setCustBusy] = useState(false);
  const [custStatus, setCustStatus] = useState({ type: "", message: "" });

  // Admin auth
  const [adminMode, setAdminMode] = useState("login"); // login | create
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminInvite, setAdminInvite] = useState("");
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminStatus, setAdminStatus] = useState({ type: "", message: "" });
  const [admin, setAdmin] = useState(null);

  const refreshSession = async () => {
    const { data } = await supabase.auth.getSession();
    setSessionUser(data?.session?.user || null);
    return data?.session || null;
  };

  const refreshAdmin = async () => {
    const session = await refreshSession();
    const token = session?.access_token || "";
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

  useEffect(() => {
    refreshAdmin();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      refreshAdmin();
    });
    return () => {
      sub?.subscription?.unsubscribe?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onLogout = async () => {
    setCustStatus({ type: "", message: "" });
    setAdminStatus({ type: "", message: "" });
    await supabase.auth.signOut();
    setSessionUser(null);
    setAdmin(null);
  };

  const onCustomerSubmit = async (e) => {
    e.preventDefault();
    setCustStatus({ type: "", message: "" });

    const id = String(custIdentifier || "").trim();
    if (!id || !custPassword) {
      setCustStatus({ type: "error", message: "Email/Mobile and password required" });
      return;
    }

    setCustBusy(true);
    try {
      const payload = isProbablyEmail(id)
        ? { email: id.toLowerCase(), password: custPassword }
        : { phone: normalizePhone(id), password: custPassword };

      if (custMode === "login") {
        const { error } = await supabase.auth.signInWithPassword(payload);
        if (error) throw error;
        setCustStatus({ type: "success", message: "Logged in" });
        navigate(redirectTo, { replace: true });
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        ...payload,
        options: { data: { account_type: "customer" } },
      });
      if (error) throw error;

      if (!data?.session) {
        setCustStatus({
          type: "success",
          message: "Account created. If you used email, confirm email then login.",
        });
        return;
      }

      setCustStatus({ type: "success", message: "Account created and logged in" });
      navigate(redirectTo, { replace: true });
    } catch (err) {
      console.error(err);
      setCustStatus({ type: "error", message: err?.message || "Customer auth failed" });
    } finally {
      setCustBusy(false);
    }
  };

  const onAdminSubmit = async (e) => {
    e.preventDefault();
    setAdminStatus({ type: "", message: "" });

    if (!adminEmail.trim() || !adminPassword) {
      setAdminStatus({ type: "error", message: "Email and password required" });
      return;
    }

    setAdminBusy(true);
    try {
      if (adminMode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: adminEmail.trim(),
          password: adminPassword,
        });
        if (error) throw error;

        await refreshAdmin();
        setAdminStatus({ type: "success", message: "Logged in" });
        return;
      }

      if (!adminInvite.trim()) {
        setAdminStatus({ type: "error", message: "Invite code required" });
        return;
      }

      const res = await apiFetch("/admin/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: adminEmail.trim(),
          password: adminPassword,
          inviteCode: adminInvite.trim(),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.error || data?.message || `Create failed (${res.status})`;
        throw new Error(msg);
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: adminEmail.trim(),
        password: adminPassword,
      });
      if (error) throw error;

      await refreshAdmin();
      setAdminStatus({ type: "success", message: "Admin account created and logged in" });
    } catch (err) {
      console.error(err);
      const raw = String(err?.message || "");
      const looksLikeNetwork = /failed to fetch|networkerror|load failed|fetch/i.test(raw);
      if (looksLikeNetwork) {
        const base = getApiBase() || "(empty)";
        setAdminStatus({
          type: "error",
          message:
            `Failed to reach backend (${base}). Backend run/deploy karo aur REACT_APP_API_URL set karke redeploy karo.`,
        });
      } else {
        setAdminStatus({ type: "error", message: raw || "Admin auth failed" });
      }
    } finally {
      setAdminBusy(false);
    }
  };

  return (
    <div className="section">
      <div className="container" style={{ maxWidth: 720 }}>
        <h1 className="section-title">{onlyCustomer ? "Customer Login" : "Login"}</h1>
        <p className="section-subtitle">
          {onlyCustomer ? "Login or create customer account to proceed." : "Customer login (top) and Admin login (below)."}
        </p>

        <div className="auth-card" style={{ marginTop: 16 }}>
          <div className="auth-head">
            <div>
              <div className="summary-title">LOGIN</div>
              <div className="summary-meta">
                {sessionUser
                  ? `Logged in as: ${sessionUser.email || sessionUser.phone || sessionUser.id}`
                  : "Login or create customer account"}
              </div>
            </div>
            {sessionUser ? (
              <button className="secondary-btn" type="button" onClick={onLogout}>
                Logout
              </button>
            ) : null}
          </div>

          {!sessionUser ? (
            <>
              <div className="auth-tabs" role="tablist" aria-label="Customer auth">
                <button
                  type="button"
                  className={custMode === "login" ? "auth-tab active" : "auth-tab"}
                  onClick={() => setCustMode("login")}
                >
                  Login
                </button>
                <button
                  type="button"
                  className={custMode === "create" ? "auth-tab active" : "auth-tab"}
                  onClick={() => setCustMode("create")}
                >
                  Create Account
                </button>
              </div>

              <form onSubmit={onCustomerSubmit} className="auth-form">
                <label>
                  Email or Mobile Number*
                  <input
                    value={custIdentifier}
                    onChange={(e) => setCustIdentifier(e.target.value)}
                    placeholder="gmail or +91XXXXXXXXXX"
                  />
                </label>

                <label>
                  Password*
                  <input
                    value={custPassword}
                    onChange={(e) => setCustPassword(e.target.value)}
                    type="password"
                    placeholder="••••••••"
                  />
                </label>

                <button className="primary-btn" type="submit" disabled={custBusy}>
                  {custBusy
                    ? "Please wait…"
                    : custMode === "login"
                      ? "Login"
                      : "Create Account"}
                </button>

                <div className="summary-meta" style={{ marginTop: 10 }}>
                  After login you will return to: <span style={{ fontFamily: "monospace" }}>{redirectTo}</span>
                </div>
              </form>
            </>
          ) : (
            <div style={{ marginTop: 10 }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Link
                  to={redirectTo}
                  className="primary-btn"
                  style={{ display: "inline-block", textDecoration: "none" }}
                >
                  Continue
                </Link>
                <Link
                  to="/account"
                  className="secondary-btn"
                  style={{ display: "inline-block", textDecoration: "none" }}
                >
                  My Orders
                </Link>
              </div>
            </div>
          )}

          {custStatus.message ? (
            <p style={{ color: custStatus.type === "error" ? "crimson" : "green", marginTop: 12 }}>
              {custStatus.message}
            </p>
          ) : null}
        </div>

        {!onlyCustomer ? (
          <div className="auth-card" style={{ marginTop: 18 }}>
            <div className="auth-head">
              <div>
                <div className="summary-title">Admin Login</div>
                <div className="summary-meta">
                  {admin?.email
                    ? `Logged in as admin: ${admin.email}`
                    : "Login required to access admin panel"}
                </div>
              </div>
              {admin ? (
                <Link
                  to="/admin"
                  className="primary-btn"
                  style={{ display: "inline-block", textDecoration: "none" }}
                >
                  Go to Admin Panel
                </Link>
              ) : null}
            </div>

            {!admin ? (
              <>
                <div className="auth-tabs" role="tablist" aria-label="Admin auth">
                  <button
                    type="button"
                    className={adminMode === "login" ? "auth-tab active" : "auth-tab"}
                    onClick={() => setAdminMode("login")}
                  >
                    Login
                  </button>
                  <button
                    type="button"
                    className={adminMode === "create" ? "auth-tab active" : "auth-tab"}
                    onClick={() => setAdminMode("create")}
                  >
                    Create Account
                  </button>
                </div>

                <form onSubmit={onAdminSubmit} className="auth-form">
                  <label>
                    Email*
                    <input
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      placeholder="admin@gmail.com"
                    />
                  </label>

                  <label>
                    Password*
                    <input
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      type="password"
                      placeholder="••••••••"
                    />
                  </label>

                  {adminMode === "create" ? (
                    <label>
                      Invite Code*
                      <input
                        value={adminInvite}
                        onChange={(e) => setAdminInvite(e.target.value)}
                        placeholder="ADMIN_INVITE_CODE"
                      />
                    </label>
                  ) : null}

                  <button className="primary-btn" type="submit" disabled={adminBusy}>
                    {adminBusy
                      ? "Please wait…"
                      : adminMode === "login"
                        ? "Login"
                        : "Create Admin Account"}
                  </button>
                </form>
              </>
            ) : null}

            {adminStatus.message ? (
              <p style={{ color: adminStatus.type === "error" ? "crimson" : "green", marginTop: 12 }}>
                {adminStatus.message}
              </p>
            ) : null}
          </div>
        ) : null}

        <p style={{ marginTop: 16 }}>
          <Link to="/">← Back to shop</Link>
        </p>
      </div>
    </div>
  );
}
