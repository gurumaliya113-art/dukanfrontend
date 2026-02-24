import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch } from "../api";

const toParagraphs = (content) => {
  const raw = content === undefined || content === null ? "" : String(content);
  const normalized = raw.replace(/\r\n/g, "\n");
  const parts = normalized
    .split("\n\n")
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length) return parts;

  const single = normalized
    .split("\n")
    .map((p) => p.trim())
    .filter(Boolean);

  return single.length ? single : [];
};

export default function PolicyPage() {
  const { slug } = useParams();
  const [policy, setPolicy] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    setLoading(true);
    setError("");

    apiFetch(`/policies/${encodeURIComponent(slug)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Policy not found (${res.status})`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setPolicy(data || null);
        if (data?.title) {
          try {
            document.title = `${data.title} | ZUBILO`;
          } catch {
            // ignore
          }
        }
      })
      .catch((e) => {
        if (cancelled) return;
        console.error(e);
        setPolicy(null);
        setError("Page load nahi ho raha.");
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const paragraphs = useMemo(() => toParagraphs(policy?.content), [policy?.content]);

  return (
    <div>
      <section className="section">
        <div className="container">
          <div className="section-head">
            <h2 className="section-title">{policy?.title || "Policy"}</h2>
            <div className="section-count">
              <Link to="/" className="nav-link">
                Back to Shop
              </Link>
            </div>
          </div>

          {loading ? <p className="status">Loading…</p> : null}
          {error ? <p className="status">{error}</p> : null}

          {!loading && !error && policy ? (
            <div style={{ maxWidth: 920, lineHeight: 1.8, display: "grid", gap: 14 }}>
              {paragraphs.length ? paragraphs.map((p, idx) => <p key={idx}>{p}</p>) : <p>No content.</p>}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
