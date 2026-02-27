import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api";
import { useLocation } from "react-router-dom";
import SeoHead from "../seo/SeoHead";
import { breadcrumbJsonLd, webPageJsonLd } from "../seo/jsonLd";
import { canonicalFromLocation } from "../seo/seoUtils";

export default function BlogPage() {
  const location = useLocation();
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    apiFetch("/blogs")
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load blogs (${res.status})`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setBlogs(Array.isArray(data) ? data : []);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error(e);
        setBlogs([]);
        setError("Blogs load nahi ho rahe. Backend chal raha hai?");
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const publishedBlogs = useMemo(() => {
    return (blogs || []).filter((b) => b && b.slug);
  }, [blogs]);

  const canonicalUrl = canonicalFromLocation(location);
  const jsonLd = useMemo(() => {
    return [
      webPageJsonLd({
        name: "Blog | Zubilo Apparels",
        url: canonicalUrl,
        description: "Fashion updates, styling tips, and new collection highlights from Zubilo Apparels.",
      }),
      breadcrumbJsonLd([
        { name: "Home", item: "/" },
        { name: "Blog", item: "/blog" },
      ]),
    ].filter(Boolean);
  }, [canonicalUrl]);

  return (
    <div>
      <SeoHead
        location={location}
        titlePrimary="Blog"
        titleSecondary="Zubilo Apparels"
        description="Read the latest fashion updates, product stories, and style guides from Zubilo Apparels."
        canonical={canonicalUrl}
        jsonLd={jsonLd}
      />

      <h1 className="sr-only">Blog — Zubilo Apparels</h1>

      <section className="section">
        <div className="container">
          <div className="section-head">
            <h2 className="section-title">Blog</h2>
            <div className="section-count">{publishedBlogs.length} POSTS</div>
          </div>

          {loading ? <p className="status">Loading…</p> : null}
          {error ? <p className="status">{error}</p> : null}

          <div className="product-grid" aria-label="Blog posts">
            {publishedBlogs.map((b) => (
              <Link
                key={b.id || b.slug}
                to={`/blog/${b.slug}`}
                className="product-card"
                aria-label={b.title || "Blog post"}
              >
                <div className="product-image-wrap">
                  <img
                    className="product-image"
                    src={b.image_url || "https://via.placeholder.com/600"}
                    alt={b.title || "Blog"}
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <div className="product-meta">
                  <div className="product-name">{b.title || "Untitled"}</div>
                  <div className="product-price">{b.summary || b.author || ""}</div>
                </div>
              </Link>
            ))}
          </div>

          {!loading && !error && publishedBlogs.length === 0 ? (
            <p className="status">No blog posts yet.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
