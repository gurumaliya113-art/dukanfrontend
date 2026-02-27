import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { apiFetch } from "../api";
import SeoHead from "../seo/SeoHead";
import { blogPostingJsonLd, breadcrumbJsonLd, webPageJsonLd } from "../seo/jsonLd";
import { SITE } from "../seo/siteConfig";

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

export default function BlogPostPage() {
  const { slug } = useParams();
  const location = useLocation();
  const [blog, setBlog] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    setLoading(true);
    setError("");

    apiFetch(`/blogs/${encodeURIComponent(slug)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Blog not found (${res.status})`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setBlog(data || null);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error(e);
        setBlog(null);
        setError("Blog load nahi ho raha.");
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const paragraphs = useMemo(() => toParagraphs(blog?.content), [blog?.content]);

  const canonicalPath = `/blog/${encodeURIComponent(slug || "")}`;
  const canonicalUrl = `${SITE.origin}${canonicalPath}`;
  const jsonLd = useMemo(() => {
    return [
      webPageJsonLd({
        name: `${blog?.title || "Blog"} | Zubilo Apparels`,
        url: canonicalUrl,
        description: blog?.summary || undefined,
      }),
      breadcrumbJsonLd([
        { name: "Home", item: "/" },
        { name: "Blog", item: "/blog" },
        { name: blog?.title || "Post", item: canonicalPath },
      ]),
      blogPostingJsonLd(blog ? { ...blog, slug } : null),
    ].filter(Boolean);
  }, [blog, canonicalPath, canonicalUrl, slug]);

  return (
    <div>
      <SeoHead
        location={location}
        titlePrimary={blog?.title || "Blog"}
        titleSecondary="Zubilo Apparels"
        description={blog?.summary || blog?.content}
        canonical={canonicalUrl}
        ogImage={blog?.image_url || SITE.defaultOgImage}
        jsonLd={jsonLd}
        robots={error ? "noindex, nofollow" : undefined}
      />

      <h1 className="sr-only">{blog?.title || "Blog post"}</h1>

      <section className="section">
        <div className="container">
          <div className="section-head">
            <h2 className="section-title">{blog?.title || "Blog"}</h2>
            <div className="section-count">
              <Link to="/blog" className="nav-link">
                Back to Blog
              </Link>
            </div>
          </div>

          {loading ? <p className="status">Loading…</p> : null}
          {error ? <p className="status">{error}</p> : null}

          {!loading && !error && blog ? (
            <div style={{ display: "grid", gap: 18 }}>
              {blog.image_url ? (
                <div className="product-image-wrap" style={{ maxWidth: 920 }}>
                  <img
                    className="product-image"
                    src={blog.image_url}
                    alt={blog.title || "Blog"}
                    loading="eager"
                    decoding="async"
                  />
                </div>
              ) : null}

              <div className="status" style={{ marginTop: 0 }}>
                {blog.author ? `By ${blog.author}` : null}
              </div>

              <div style={{ maxWidth: 920, lineHeight: 1.8 }}>
                {paragraphs.length
                  ? paragraphs.map((p, idx) => <p key={idx}>{p}</p>)
                  : blog.content
                    ? <p>{String(blog.content)}</p>
                    : <p>No content.</p>}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
