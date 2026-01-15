import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  ogImage?: string;
  ogUrl?: string;
  noindex?: boolean;
  canonicalUrl?: string;
}

export function SEO({
  title = "Novalare - AI Copilot for Accountants | 10x Faster Bookkeeping",
  description = "AI-powered accounting automation for European firms. Automate invoice extraction, bank reconciliation, and month-end close. Supports QuickBooks, Xero, and DATEV integration.",
  keywords = "accounting automation, AI bookkeeping, DATEV integration, invoice extraction, bank reconciliation, QuickBooks automation, Xero integration, AI copilot, accounting software, European accounting",
  ogImage = "https://www.novalare.com/og-image.png",
  ogUrl,
  noindex = false,
  canonicalUrl,
}: SEOProps) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Novalare",
    "applicationCategory": "BusinessApplication",
    "description": description,
    "operatingSystem": "Web",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "EUR",
      "description": "Free trial available"
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.9",
      "ratingCount": "156",
      "bestRating": "5",
      "worstRating": "1"
    },
    "creator": {
      "@type": "Organization",
      "name": "Novalare"
    }
  };

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{title}</title>
      <meta name="title" content={title} />
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <meta name="robots" content={noindex ? "noindex, nofollow" : "index, follow"} />

      {/* Canonical URL */}
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}

      {/* Open Graph / Facebook */}
      <meta property="og:type" content="website" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      {ogUrl && <meta property="og:url" content={ogUrl} />}
      <meta property="og:site_name" content="Novalare" />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {/* Structured Data */}
      {!noindex && (
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      )}
    </Helmet>
  );
}

