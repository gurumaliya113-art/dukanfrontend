import React from "react";
import { Helmet } from "react-helmet-async";
import { SITE } from "./siteConfig";
import {
  absoluteUrl,
  buildMetaDescription,
  buildTitle,
  canonicalFromLocation,
  robotsForPath,
} from "./seoUtils";
import { organizationJsonLd, websiteJsonLd } from "./jsonLd";

const toJson = (obj) => {
  try {
    return JSON.stringify(obj);
  } catch {
    return "";
  }
};

export default function SeoHead({
  location,
  titlePrimary,
  titleSecondary,
  description,
  descriptionFallback,
  canonical,
  ogImage,
  robots,
  jsonLd = [],
  includeOrg = true,
  includeWebsite = true,
}) {
  const canonicalUrl = canonical || canonicalFromLocation(location);
  const metaTitle = buildTitle(titlePrimary || SITE.brand, titleSecondary);
  const metaDescription = buildMetaDescription(
    description,
    descriptionFallback ||
      "Shop new arrivals for men, women and kids. Secure checkout, worldwide shipping, and 7-day returns with Zubilo Apparels."
  );

  const robotsValue = robots || robotsForPath(location?.pathname);
  const ogImageUrl = absoluteUrl(ogImage || SITE.defaultOgImage);

  const ld = [];
  if (includeOrg) ld.push(organizationJsonLd());
  if (includeWebsite) ld.push(websiteJsonLd());
  (Array.isArray(jsonLd) ? jsonLd : [jsonLd]).forEach((x) => {
    if (x) ld.push(x);
  });

  // Optional GA4 (set REACT_APP_GA4_ID)
  const gaId = process.env.REACT_APP_GA4_ID;

  return (
    <Helmet>
      <html lang={SITE.language} />
      <title>{metaTitle}</title>

      <link rel="canonical" href={canonicalUrl} />

      <meta name="description" content={metaDescription} />
      <meta name="robots" content={robotsValue} />

      <meta property="og:site_name" content={SITE.brand} />
      <meta property="og:type" content="website" />
      <meta property="og:title" content={metaTitle} />
      <meta property="og:description" content={metaDescription} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:image" content={ogImageUrl} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={metaTitle} />
      <meta name="twitter:description" content={metaDescription} />
      <meta name="twitter:image" content={ogImageUrl} />

      {gaId ? (
        <>
          <script async src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`} />
          <script>
            {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${String(gaId).replace(/'/g, "\\'")}');`}
          </script>
        </>
      ) : null}

      {ld.map((obj, idx) => (
        <script
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: toJson(obj) }}
          type="application/ld+json"
          key={`ld-${idx}`}
        />
      ))}
    </Helmet>
  );
}
