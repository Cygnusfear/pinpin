import {
  WidgetFactory,
  WidgetCreateData,
  WidgetValidationResult,
  WidgetCapabilities,
  WidgetExportData,
  WidgetSerializationOptions,
} from '../../types/widgets';
import { UrlWidget, UrlWidgetCreateData } from './types';

export class UrlWidgetFactory implements WidgetFactory<UrlWidget> {
  type = 'url';

  canHandle(data: any): boolean {
    if (typeof data === 'string') {
      // Trim whitespace
      const trimmed = data.trim();

      // Check for URL patterns
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        try {
          const url = new URL(trimmed);
          return url.protocol === 'http:' || url.protocol === 'https:';
        } catch {
          return false;
        }
      }

      // Check for common URL patterns without protocol
      if (
        trimmed.match(
          /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}/
        ) ||
        trimmed.match(/^www\./)
      ) {
        try {
          const url = new URL('https://' + trimmed);
          return true;
        } catch {
          return false;
        }
      }

      return false;
    }

    if (typeof data === 'object' && data !== null) {
      return 'url' in data || 'href' in data || 'link' in data;
    }

    return false;
  }

  async create(
    data: any,
    position: { x: number; y: number }
  ): Promise<WidgetCreateData<UrlWidget>> {
    let url: string;
    let title: string | undefined;
    let description: string | undefined;

    if (typeof data === 'string') {
      url = data.trim();
      // Add protocol if missing
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
    } else if (typeof data === 'object') {
      url = data.url || data.href || data.link;
      title = data.title;
      description = data.description;
    } else {
      throw new Error('Invalid URL data provided');
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      throw new Error('Invalid URL format');
    }

    // Try to fetch metadata
    const metadata = await this.fetchUrlMetadata(url);

    return {
      type: 'url',
      url,
      title: title || metadata.title || this.extractDomainFromUrl(url),
      description: description || metadata.description,
      favicon: metadata.favicon,
      preview: metadata.preview,
      embedType: metadata.embedType || 'link',
      embedData: metadata.embedData,
      x: position.x - 150,
      y: position.y - 100,
      width: 300,
      height: 200,
      rotation: 0,
      locked: false,
      metadata: {
        fetchedAt: Date.now(),
        domain: this.extractDomainFromUrl(url),
      },
    };
  }

  validate(widget: UrlWidget): WidgetValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!widget.url) {
      errors.push('URL is required');
    } else {
      try {
        const url = new URL(widget.url);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
          errors.push('Only HTTP and HTTPS URLs are supported');
        }
      } catch {
        errors.push('Invalid URL format');
      }
    }

    if (widget.width <= 0 || widget.height <= 0) {
      errors.push('Widget dimensions must be positive');
    }

    if (widget.embedType === 'iframe' && !widget.embedData?.html) {
      warnings.push('Iframe embed type requires HTML content');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  async serialize(
    widget: UrlWidget,
    options: WidgetSerializationOptions
  ): Promise<WidgetExportData> {
    return {
      widget: { ...widget },
    };
  }

  async deserialize(data: WidgetExportData): Promise<UrlWidget> {
    return data.widget as UrlWidget;
  }

  getDefaultSize(): { width: number; height: number } {
    return { width: 300, height: 200 };
  }

  getCapabilities(): WidgetCapabilities {
    return {
      canResize: true,
      canRotate: false,
      canEdit: true,
      canConfigure: true,
      canGroup: true,
      canDuplicate: true,
      canExport: true,
      hasContextMenu: true,
      hasToolbar: true,
      hasInspector: true,
    };
  }

  // Helper methods
  private async fetchUrlMetadata(url: string): Promise<{
    title?: string;
    description?: string;
    favicon?: string;
    preview?: string;
    embedType?: 'link' | 'iframe' | 'video' | 'image';
    embedData?: any;
  }> {
    try {
      // In a real implementation, you'd use a service like:
      // - Open Graph API
      // - oEmbed
      // - Custom metadata scraper
      // For now, we'll return basic metadata based on URL patterns

      const domain = this.extractDomainFromUrl(url);
      const metadata: any = {
        title: domain,
        favicon: `https://www.google.com/s2/favicons?domain=${domain}`,
      };

      // YouTube detection
      if (url.includes('youtube.com/watch') || url.includes('youtu.be/')) {
        metadata.embedType = 'video';
        metadata.title = 'YouTube Video';
        metadata.embedData = {
          aspectRatio: 16 / 9,
          autoplay: false,
        };
      }

      // Twitter detection
      else if (url.includes('twitter.com') || url.includes('x.com')) {
        metadata.embedType = 'iframe';
        metadata.title = 'Twitter Post';
      }

      // GitHub detection
      else if (url.includes('github.com')) {
        metadata.title = 'GitHub Repository';
        metadata.description = 'Code repository on GitHub';
      }

      return metadata;
    } catch (error) {
      console.warn('Failed to fetch URL metadata:', error);
      return {};
    }
  }

  private extractDomainFromUrl(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return 'Unknown';
    }
  }
}