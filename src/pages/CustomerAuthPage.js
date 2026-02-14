import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../supabaseClient";

const isProbablyEmail = (value) => String(value || "").includes("@");

const normalizePhone = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  // Keep as-is; Supabase expects E.164 for best results (+91...).
  return raw;
};

export default function CustomerAuthPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const redirectTo = useMemo(() => {
    const r = params.get("redirect") || "";
    // Only allow relative redirects to avoid open-redirect issues.
    if (!r.startsWith("/")) return "/";
    return r;
  }, [params]);

  const [mode, setMode] = useState("login"); // login | create
  const [identifier, setIdentifier] = useState(""); // email or phone
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [sessionUser, setSessionUser] = useState(null);

  const refreshSession = async () => {
    const { data } = await supabase.auth.getSession();
    setSessionUser(data?.session?.user || null);
  };

  useEffect(() => {
    refreshSession();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      refreshSession();
    });
    return () => {
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setStatus({ type: "", message: "" });

    const id = String(identifier || "").trim();
    if (!id || !password) {
      setStatus({ type: "error", message: "Email/Mobile and password required" });
      return;
    }

    setBusy(true);
    try {
      const payload = isProbablyEmail(id)
        ? { email: id.toLowerCase(), password }
        : { phone: normalizePhone(id), password };

      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword(payload);
        if (error) throw error;
        setStatus({ type: "success", message: "Logged in" });
        navigate(redirectTo, { replace: true });
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        ...payload,
        options: {
          data: {
            account_type: "customer",
          },
        },
      });
      if (error) throw error;

      // If email confirmations are enabled, session may be null.
      if (!data?.session) {
        setStatus({
          type: "success",
          message:
            "Account created. If you used email, check your inbox to confirm, then login.",
        });
        return;
      }

      setStatus({ type: "success", message: "Account created and logged in" });
      navigate(redirectTo, { replace: true });
    } catch (err) {
      console.error(err);
      setStatus({ type: "error", message: err?.message || "Auth failed" });
    } finally {
      setBusy(false);
    }
  };

  const onLogout = async () => {
    setStatus({ type: "", message: "" });
    await supabase.auth.signOut();
    setSessionUser(null);
    setStatus({ type: "success", message: "Logged out" });
  };

  return (
    <div className="section">
      <div className="container" style={{ maxWidth: 720 }}>
        <h1 className="section-title">Customer Login</h1>
        <p className="section-subtitle">Login to proceed with checkout</p>

        <div className="auth-card" style={{ marginTop: 16 }}>
          <div className="auth-head">
            <div>
              <div className="summary-title">Customer Account</div>
              <div className="summary-meta">
                {sessionUser
                  ? `Logged in as: ${sessionUser.email || sessionUser.phone || sessionUser.id}`
                  : "Login or create account"}
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
                  className={mode === "login" ? "auth-tab active" : "auth-tab"}
                  onClick={() => setMode("login")}
                >
                  Login
                </button>
                <button
                  type="button"
                  className={mode === "create" ? "auth-tab active" : "auth-tab"}
                  onClick={() => setMode("create")}
                >
                  Create Account
                </button>
              </div>

              <form onSubmit={onSubmit} className="auth-form">
                <label>
                  Email or Mobile Number*
                  <input
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="gmail or +91XXXXXXXXXX"
                  />
                </label>

                <label>
                  Password*
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type="password"
                    placeholder="••••••••"
                  />
                </label>

                <button className="primary-btn" type="submit" disabled={busy}>
                  {busy ? "Please wait…" : mode === "login" ? "Login" : "Create Account"}
                </button>

                <div className="summary-meta" style={{ marginTop: 10 }}>
                  After login you will return to: <span style={{ fontFamily: "monospace" }}>{redirectTo}</span>
                </div>
              </form>
            </>
          ) : (
            <div style={{ marginTop: 10 }}>
              <Link to={redirectTo} className="primary-btn" style={{ display: "inline-block", textDecoration: "none" }}>
                Continue
              </Link>
            </div>
          )}
        </div>

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
