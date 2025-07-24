// ============================================================================
// OG METADATA SERVICE - FETCH OPEN GRAPH DATA FROM URLS
// ============================================================================

export interface OGMetadata {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  siteName?: string;
  type?: string;
  author?: string;
  publishedTime?: string;
  twitterCard?: string;
  twitterSite?: string;
  twitterCreator?: string;
  favicon?: string;
}

export class OGMetadataService {
  private static readonly TIMEOUT = 12000; // 12 seconds

  /**
   * Fetch OG metadata from a URL using multiple reliable strategies
   */
  static async fetchMetadata(url: string): Promise<OGMetadata> {
    const normalizedUrl = OGMetadataService.normalizeUrl(url);
    console.log(`🔗 Fetching OG metadata for: ${normalizedUrl}`);

    // Strategy 1: Use jsonlink.io API (free and reliable)
    try {
      console.log(`🌐 Trying jsonlink.io API...`);
      const metadata = await OGMetadataService.fetchWithJsonLink(normalizedUrl);
      if (
        metadata &&
        (metadata.title || metadata.description || metadata.image)
      ) {
        console.log(`✅ JsonLink API success:`, metadata);
        return metadata;
      }
    } catch (error) {
      console.warn(`⚠️ JsonLink API failed:`, error);
    }

    // Strategy 2: Use microlink.io API
    try {
      console.log(`🌐 Trying microlink.io API...`);
      const metadata =
        await OGMetadataService.fetchWithMicrolink(normalizedUrl);
      if (
        metadata &&
        (metadata.title || metadata.description || metadata.image)
      ) {
        console.log(`✅ Microlink API success:`, metadata);
        return metadata;
      }
    } catch (error) {
      console.warn(`⚠️ Microlink API failed:`, error);
    }

    // Strategy 3: Use urlpreview.vercel.app API
    try {
      console.log(`🌐 Trying URL Preview API...`);
      const metadata =
        await OGMetadataService.fetchWithUrlPreview(normalizedUrl);
      if (
        metadata &&
        (metadata.title || metadata.description || metadata.image)
      ) {
        console.log(`✅ URL Preview API success:`, metadata);
        return metadata;
      }
    } catch (error) {
      console.warn(`⚠️ URL Preview API failed:`, error);
    }

    // Strategy 4: Try allorigins as final fallback
    try {
      console.log(`🌐 Trying AllOrigins fallback...`);
      const metadata =
        await OGMetadataService.fetchWithAllOrigins(normalizedUrl);
      if (
        metadata &&
        (metadata.title || metadata.description || metadata.image)
      ) {
        console.log(`✅ AllOrigins success:`, metadata);
        return metadata;
      }
    } catch (error) {
      console.warn(`⚠️ AllOrigins failed:`, error);
    }

    // Final fallback to basic metadata
    console.log(`🔄 Using fallback metadata for: ${normalizedUrl}`);
    return OGMetadataService.getFallbackMetadata(normalizedUrl);
  }

  /**
   * Fetch using jsonlink.io API (free tier, good for OG data)
   */
  private static async fetchWithJsonLink(url: string): Promise<OGMetadata> {
    const apiUrl = `https://jsonlink.io/api/extract?url=${encodeURIComponent(url)}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      OGMetadataService.TIMEOUT,
    );

    try {
      const response = await fetch(apiUrl, {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data && !data.error) {
        return {
          title: data.title || undefined,
          description: data.description || undefined,
          image: data.images?.[0] || data.image || undefined,
          favicon: data.favicon || OGMetadataService.getFaviconUrl(url),
          siteName:
            data.site_name || OGMetadataService.extractDomainFromUrl(url),
          url: url,
        };
      }
    } finally {
      clearTimeout(timeoutId);
    }

    throw new Error("JsonLink API returned no data");
  }

  /**
   * Fetch using microlink.io API
   */
  private static async fetchWithMicrolink(url: string): Promise<OGMetadata> {
    const apiUrl = `https://api.microlink.io/?url=${encodeURIComponent(url)}&meta=false&screenshot=false&video=false&audio=false&iframe=false`;

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      OGMetadataService.TIMEOUT,
    );

    try {
      const response = await fetch(apiUrl, {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.status === "success" && data.data) {
        const { title, description, image, logo, publisher, author, date } =
          data.data;

        return {
          title: title || undefined,
          description: description || undefined,
          image: image?.url || undefined,
          favicon: logo?.url || OGMetadataService.getFaviconUrl(url),
          siteName: publisher || OGMetadataService.extractDomainFromUrl(url),
          author: author || undefined,
          publishedTime: date || undefined,
          url: url,
        };
      }
    } finally {
      clearTimeout(timeoutId);
    }

    throw new Error("Microlink API returned no data");
  }

  /**
   * Fetch using URL Preview API (Vercel-hosted, reliable)
   */
  private static async fetchWithUrlPreview(url: string): Promise<OGMetadata> {
    const apiUrl = `https://urlpreview.vercel.app/api/v1/preview?url=${encodeURIComponent(url)}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      OGMetadataService.TIMEOUT,
    );

    try {
      const response = await fetch(apiUrl, {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data && data.title) {
        return {
          title: data.title || undefined,
          description: data.description || undefined,
          image: data.image || undefined,
          favicon: data.favicon || OGMetadataService.getFaviconUrl(url),
          siteName:
            data.sitename || OGMetadataService.extractDomainFromUrl(url),
          url: url,
        };
      }
    } finally {
      clearTimeout(timeoutId);
    }

    throw new Error("URL Preview API returned no data");
  }

  /**
   * Fetch using AllOrigins (final fallback with HTML parsing)
   */
  private static async fetchWithAllOrigins(url: string): Promise<OGMetadata> {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      OGMetadataService.TIMEOUT,
    );

    try {
      const response = await fetch(proxyUrl, {
        signal: controller.signal,
        headers: {
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      return OGMetadataService.parseMetadata(html, url);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Parse OG metadata from HTML content
   */
  private static parseMetadata(html: string, url: string): OGMetadata {
    const metadata: OGMetadata = {};

    try {
      // Create a temporary DOM element to parse HTML
      const doc = new DOMParser().parseFromString(html, "text/html");

      // Extract OG tags
      const ogTags = doc.querySelectorAll('meta[property^="og:"]');
      ogTags.forEach((tag) => {
        const property = tag.getAttribute("property");
        const content = tag.getAttribute("content");
        if (property && content) {
          switch (property) {
            case "og:title":
              metadata.title = content;
              break;
            case "og:description":
              metadata.description = content;
              break;
            case "og:image":
              metadata.image = OGMetadataService.resolveUrl(content, url);
              break;
            case "og:url":
              metadata.url = content;
              break;
            case "og:site_name":
              metadata.siteName = content;
              break;
            case "og:type":
              metadata.type = content;
              break;
            case "og:author":
              metadata.author = content;
              break;
            case "og:published_time":
              metadata.publishedTime = content;
              break;
          }
        }
      });

      // Extract Twitter Card tags
      const twitterTags = doc.querySelectorAll('meta[name^="twitter:"]');
      twitterTags.forEach((tag) => {
        const name = tag.getAttribute("name");
        const content = tag.getAttribute("content");
        if (name && content) {
          switch (name) {
            case "twitter:card":
              metadata.twitterCard = content;
              break;
            case "twitter:site":
              metadata.twitterSite = content;
              break;
            case "twitter:creator":
              metadata.twitterCreator = content;
              break;
            case "twitter:title":
              if (!metadata.title) metadata.title = content;
              break;
            case "twitter:description":
              if (!metadata.description) metadata.description = content;
              break;
            case "twitter:image":
              if (!metadata.image)
                metadata.image = OGMetadataService.resolveUrl(content, url);
              break;
          }
        }
      });

      // Fallback to standard HTML tags
      if (!metadata.title) {
        const titleTag = doc.querySelector("title");
        if (titleTag) metadata.title = titleTag.textContent?.trim();
      }

      if (!metadata.description) {
        const descTag = doc.querySelector('meta[name="description"]');
        if (descTag)
          metadata.description = descTag.getAttribute("content") || undefined;
      }

      // Extract favicon
      metadata.favicon = OGMetadataService.extractFavicon(doc, url);

      // Set defaults
      if (!metadata.url) metadata.url = url;
      if (!metadata.siteName)
        metadata.siteName = OGMetadataService.extractDomainFromUrl(url);
    } catch (error) {
      console.warn("Failed to parse HTML metadata:", error);
    }

    return metadata;
  }

  /**
   * Extract favicon from HTML document
   */
  private static extractFavicon(doc: Document, url: string): string {
    // Try different favicon selectors in order of preference
    const selectors = [
      'link[rel="icon"][type="image/svg+xml"]',
      'link[rel="icon"][sizes="32x32"]',
      'link[rel="icon"][sizes="16x16"]',
      'link[rel="shortcut icon"]',
      'link[rel="icon"]',
      'link[rel="apple-touch-icon"]',
    ];

    for (const selector of selectors) {
      const link = doc.querySelector(selector) as HTMLLinkElement;
      if (link?.href) {
        return OGMetadataService.resolveUrl(link.href, url);
      }
    }

    // Fallback to Google's favicon service
    return OGMetadataService.getFaviconUrl(url);
  }

  /**
   * Get favicon URL using Google's service
   */
  private static getFaviconUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`;
    } catch {
      return "";
    }
  }

  /**
   * Resolve relative URLs to absolute URLs
   */
  private static resolveUrl(href: string, baseUrl: string): string {
    try {
      return new URL(href, baseUrl).href;
    } catch {
      return href;
    }
  }

  /**
   * Normalize URL by adding protocol if missing
   */
  private static normalizeUrl(url: string): string {
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      return `https://${url}`;
    }
    return url;
  }

  /**
   * Extract domain from URL
   */
  private static extractDomainFromUrl(url: string): string {
    try {
      const urlObj = new URL(OGMetadataService.normalizeUrl(url));
      return urlObj.hostname.replace(/^www\./, "");
    } catch {
      return "Unknown Site";
    }
  }

  /**
   * Get fallback metadata when fetching fails
   */
  private static getFallbackMetadata(url: string): OGMetadata {
    const domain = OGMetadataService.extractDomainFromUrl(url);
    return {
      title: domain,
      description: `Visit ${domain}`,
      url: OGMetadataService.normalizeUrl(url),
      siteName: domain,
      favicon: OGMetadataService.getFaviconUrl(url),
    };
  }

  /**
   * Check if an image URL is accessible
   */
  static async validateImageUrl(imageUrl: string): Promise<boolean> {
    try {
      const response = await fetch(imageUrl, { method: "HEAD" });
      return (
        response.ok &&
        response.headers.get("content-type")?.startsWith("image/") === true
      );
    } catch {
      return false;
    }
  }
}
