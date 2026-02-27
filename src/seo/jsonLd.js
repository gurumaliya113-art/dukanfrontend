import { SITE } from "./siteConfig";
import { absoluteUrl } from "./seoUtils";

export const organizationJsonLd = () => {
  const sameAs = Object.values(SITE.socials || {}).filter((u) => String(u || "").trim());

  return {
    "@context": "https://schema.org",
    "@type": "OnlineStore",
    name: SITE.brand,
    url: SITE.origin,
    logo: SITE.logo,
    image: [SITE.defaultOgImage],
    email: SITE.contactEmail,
    telephone: SITE.contactPhone,
    address: SITE.contactAddress
      ? {
          "@type": "PostalAddress",
          streetAddress: SITE.contactAddress,
        }
      : undefined,
    areaServed: SITE.areaServed,
    sameAs: sameAs.length ? sameAs : undefined,
  };
};

export const websiteJsonLd = () => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE.brand,
  url: SITE.origin,
  inLanguage: SITE.language,
});

export const breadcrumbJsonLd = (items) => {
  const list = (items || []).filter((x) => x && x.name && x.item);
  if (!list.length) return null;

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: list.map((x, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: x.name,
      item: absoluteUrl(x.item),
    })),
  };
};

export const faqJsonLd = (faqs) => {
  const list = (faqs || []).filter((x) => x && x.q && x.a);
  if (!list.length) return null;

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: list.map((x) => ({
      "@type": "Question",
      name: String(x.q),
      acceptedAnswer: {
        "@type": "Answer",
        text: String(x.a),
      },
    })),
  };
};

export const productJsonLd = (product, { currency, price }) => {
  if (!product) return null;

  const images = [product.image1, product.image2, product.image3, product.image4]
    .filter(Boolean)
    .map((x) => absoluteUrl(x));

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description || undefined,
    image: images.length ? images : undefined,
    sku: product.id ? String(product.id) : undefined,
    brand: {
      "@type": "Brand",
      name: SITE.brand,
    },
    offers: {
      "@type": "Offer",
      url: absoluteUrl(`/product/${encodeURIComponent(product.slug || "")}`),
      priceCurrency: currency || "INR",
      price: Number(price || 0) || undefined,
      availability: "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
    },
  };
};

export const blogPostingJsonLd = (blog) => {
  if (!blog) return null;
  const image = blog.image_url ? [absoluteUrl(blog.image_url)] : undefined;
  const authorName = blog.author || SITE.brand;

  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: blog.title || "Blog post",
    description: blog.summary || undefined,
    image,
    author: {
      "@type": "Person",
      name: authorName,
    },
    publisher: {
      "@type": "Organization",
      name: SITE.brand,
      logo: {
        "@type": "ImageObject",
        url: SITE.logo,
      },
    },
    datePublished: blog.published_at || blog.created_at || undefined,
    dateModified: blog.updated_at || blog.published_at || blog.created_at || undefined,
    mainEntityOfPage: absoluteUrl(`/blog/${encodeURIComponent(blog.slug || "")}`),
  };
};

export const webPageJsonLd = ({ name, url, description }) => ({
  "@context": "https://schema.org",
  "@type": "WebPage",
  name,
  url,
  description: description || undefined,
  isPartOf: {
    "@type": "WebSite",
    url: SITE.origin,
    name: SITE.brand,
  },
});
