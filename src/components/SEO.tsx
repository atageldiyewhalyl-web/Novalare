import { useEffect } from 'react';

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
  ogImage = "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=1200&h=630&fit=crop",
  ogUrl,
  noindex = false,
  canonicalUrl,
}: SEOProps) {
  useEffect(() => {
    // Set page title
    document.title = title;

    // Helper function to set or update meta tags
    const setMetaTag = (name: string, content: string, attribute: 'name' | 'property' = 'name') => {
      let element = document.querySelector(`meta[${attribute}="${name}"]`);
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attribute, name);
        document.head.appendChild(element);
      }
      element.setAttribute('content', content);
    };

    // Set meta description
    setMetaTag('description', description);
    
    // Set keywords
    setMetaTag('keywords', keywords);

    // Set robots meta tag
    if (noindex) {
      setMetaTag('robots', 'noindex, nofollow');
    } else {
      setMetaTag('robots', 'index, follow');
    }

    // Open Graph tags
    setMetaTag('og:title', title, 'property');
    setMetaTag('og:description', description, 'property');
    setMetaTag('og:image', ogImage, 'property');
    setMetaTag('og:type', 'website', 'property');
    if (ogUrl) {
      setMetaTag('og:url', ogUrl, 'property');
    }

    // Twitter Card tags
    setMetaTag('twitter:card', 'summary_large_image');
    setMetaTag('twitter:title', title);
    setMetaTag('twitter:description', description);
    setMetaTag('twitter:image', ogImage);

    // Canonical URL
    if (canonicalUrl) {
      let linkElement = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
      if (!linkElement) {
        linkElement = document.createElement('link');
        linkElement.rel = 'canonical';
        document.head.appendChild(linkElement);
      }
      linkElement.href = canonicalUrl;
    }

    // Add structured data for SaaS application
    if (!noindex) {
      const scriptId = 'structured-data';
      let scriptElement = document.getElementById(scriptId);
      
      if (!scriptElement) {
        scriptElement = document.createElement('script');
        scriptElement.id = scriptId;
        scriptElement.type = 'application/ld+json';
        document.head.appendChild(scriptElement);
      }

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

      scriptElement.textContent = JSON.stringify(structuredData);
    }
  }, [title, description, keywords, ogImage, ogUrl, noindex, canonicalUrl]);

  return null;
}
