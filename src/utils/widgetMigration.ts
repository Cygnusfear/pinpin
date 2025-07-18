import { Widget } from '../types/widgets';
import { 
  WidgetData, 
  ContentData, 
  WidgetMigrationData,
  ImageContentData,
  NoteContentData,
  DocumentContentData,
  UrlContentData,
  AppContentData,
  GroupContentData,
  UnknownContentData
} from '../types/separatedWidgets';
import { useContentStore } from '../stores/contentStore';
import { useSeparatedPinboardStore } from '../stores/separatedPinboardStore';

// ============================================================================
// MIGRATION UTILITIES
// ============================================================================

/**
 * Migration service for converting legacy widgets to separated architecture
 */
export class WidgetMigrationService {
  private contentStore: any;
  private widgetStore: any;

  constructor() {
    this.contentStore = useContentStore.getState();
    this.widgetStore = useSeparatedPinboardStore.getState();
  }

  /**
   * Migrate a single legacy widget to separated architecture
   */
  async migrateLegacyWidget(legacyWidget: Widget): Promise<WidgetMigrationData> {
    console.log("🔄 Migrating legacy widget:", legacyWidget.id, legacyWidget.type);

    // Split widget into widget data and content data
    const { widgetData, contentData } = this.splitWidget(legacyWidget);

    // Add content to content store
    const contentId = await this.contentStore.addContent(contentData);

    // Update widget data with content reference
    const finalWidgetData: WidgetData = {
      ...widgetData,
      contentId,
    };

    return {
      widgetData: finalWidgetData,
      contentData: { ...contentData, id: contentId } as ContentData,
      originalWidget: legacyWidget,
    };
  }

  /**
   * Migrate multiple legacy widgets efficiently
   */
  async migrateLegacyWidgets(legacyWidgets: Widget[]): Promise<WidgetMigrationData[]> {
    console.log("🔄 Migrating", legacyWidgets.length, "legacy widgets");

    const results: WidgetMigrationData[] = [];

    for (const legacyWidget of legacyWidgets) {
      try {
        const migrationData = await this.migrateLegacyWidget(legacyWidget);
        results.push(migrationData);
      } catch (error) {
        console.error("❌ Failed to migrate widget:", legacyWidget.id, error);
        // Continue with other widgets
      }
    }

    console.log("✅ Successfully migrated", results.length, "out of", legacyWidgets.length, "widgets");
    return results;
  }

  /**
   * Split a legacy widget into widget data and content data
   */
  private splitWidget(legacyWidget: Widget): { widgetData: Omit<WidgetData, 'contentId'>; contentData: any } {
    // Extract base widget properties (widget data)
    const widgetData: Omit<WidgetData, 'contentId'> = {
      id: legacyWidget.id,
      type: legacyWidget.type,
      x: legacyWidget.x,
      y: legacyWidget.y,
      width: legacyWidget.width,
      height: legacyWidget.height,
      rotation: legacyWidget.rotation,
      zIndex: legacyWidget.zIndex,
      locked: legacyWidget.locked,
      selected: legacyWidget.selected,
      metadata: legacyWidget.metadata,
      createdAt: legacyWidget.createdAt,
      updatedAt: legacyWidget.updatedAt,
    };

    // Extract type-specific properties (content data)
    const contentData = this.extractContentData(legacyWidget);

    return { widgetData, contentData };
  }

  /**
   * Extract content data based on widget type
   */
  private extractContentData(widget: Widget): any {
    switch (widget.type) {
      case 'image':
        return {
          type: 'image',
          src: (widget as any).src,
          alt: (widget as any).alt,
          originalDimensions: (widget as any).originalDimensions,
          filters: (widget as any).filters,
        };

      case 'note':
        return {
          type: 'note',
          content: (widget as any).content,
          backgroundColor: (widget as any).backgroundColor,
          textColor: (widget as any).textColor,
          fontSize: (widget as any).fontSize,
          fontFamily: (widget as any).fontFamily,
          textAlign: (widget as any).textAlign,
          formatting: (widget as any).formatting,
        };

      case 'document':
        return {
          type: 'document',
          fileName: (widget as any).fileName,
          fileType: (widget as any).fileType,
          fileSize: (widget as any).fileSize,
          mimeType: (widget as any).mimeType,
          content: (widget as any).content,
          thumbnail: (widget as any).thumbnail,
          downloadUrl: (widget as any).downloadUrl,
          previewUrl: (widget as any).previewUrl,
        };

      case 'url':
        return {
          type: 'url',
          url: (widget as any).url,
          title: (widget as any).title,
          description: (widget as any).description,
          favicon: (widget as any).favicon,
          preview: (widget as any).preview,
          embedType: (widget as any).embedType,
          embedData: (widget as any).embedData,
        };

      case 'app':
        return {
          type: 'app',
          appId: (widget as any).appId,
          appName: (widget as any).appName,
          appVersion: (widget as any).appVersion,
          config: (widget as any).config,
          iframe: (widget as any).iframe,
          permissions: (widget as any).permissions,
          state: (widget as any).state,
        };

      case 'group':
        return {
          type: 'group',
          children: (widget as any).children,
          collapsed: (widget as any).collapsed,
          backgroundColor: (widget as any).backgroundColor,
          borderColor: (widget as any).borderColor,
          label: (widget as any).label,
        };

      default:
        return {
          type: 'unknown',
          originalData: widget,
          originalType: widget.type,
          fallbackRepresentation: 'icon' as const,
          errorMessage: `Unknown widget type: ${widget.type}`,
        };
    }
  }

  /**
   * Perform full migration from legacy store to separated stores
   */
  async performFullMigration(legacyWidgets: Widget[]): Promise<{
    success: boolean;
    migratedCount: number;
    failedCount: number;
    errors: string[];
  }> {
    console.log("🚀 Starting full migration of", legacyWidgets.length, "widgets");

    const errors: string[] = [];
    let migratedCount = 0;

    try {
      // Clear existing separated stores
      this.widgetStore.reset();
      this.contentStore.reset();

      // Migrate all widgets
      const migrationResults = await this.migrateLegacyWidgets(legacyWidgets);
      
      // Add migrated widgets to separated stores
      for (const migrationData of migrationResults) {
        try {
          // Content is already added during migration, just add widget data
          this.widgetStore.widgets.push(migrationData.widgetData);
          migratedCount++;
        } catch (error) {
          errors.push(`Failed to add migrated widget ${migrationData.widgetData.id}: ${error}`);
        }
      }

      // Update store state
      this.widgetStore.lastModified = Date.now();

      console.log("✅ Migration completed:", migratedCount, "migrated,", errors.length, "errors");

      return {
        success: errors.length === 0,
        migratedCount,
        failedCount: legacyWidgets.length - migratedCount,
        errors,
      };
    } catch (error) {
      console.error("❌ Migration failed:", error);
      return {
        success: false,
        migratedCount,
        failedCount: legacyWidgets.length - migratedCount,
        errors: [...errors, `Migration failed: ${error}`],
      };
    }
  }

  /**
   * Validate migration results
   */
  validateMigration(originalWidgets: Widget[], migrationResults: WidgetMigrationData[]): {
    isValid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    // Check if all widgets were migrated
    if (originalWidgets.length !== migrationResults.length) {
      issues.push(`Widget count mismatch: ${originalWidgets.length} original, ${migrationResults.length} migrated`);
    }

    // Check each migrated widget
    for (const result of migrationResults) {
      const original = originalWidgets.find(w => w.id === result.widgetData.id);
      if (!original) {
        issues.push(`Migrated widget ${result.widgetData.id} not found in original widgets`);
        continue;
      }

      // Validate widget data preservation
      if (original.x !== result.widgetData.x || original.y !== result.widgetData.y) {
        issues.push(`Position mismatch for widget ${result.widgetData.id}`);
      }

      if (original.width !== result.widgetData.width || original.height !== result.widgetData.height) {
        issues.push(`Size mismatch for widget ${result.widgetData.id}`);
      }

      if (original.type !== result.widgetData.type) {
        issues.push(`Type mismatch for widget ${result.widgetData.id}`);
      }

      // Validate content data exists
      if (!result.contentData) {
        issues.push(`Missing content data for widget ${result.widgetData.id}`);
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  }

  /**
   * Generate migration report
   */
  generateMigrationReport(
    originalWidgets: Widget[],
    migrationResults: WidgetMigrationData[]
  ): {
    summary: {
      totalWidgets: number;
      migratedWidgets: number;
      contentItems: number;
      totalContentSize: number;
      averageContentSize: number;
    };
    byType: Record<string, { count: number; totalSize: number }>;
    validation: { isValid: boolean; issues: string[] };
  } {
    const validation = this.validateMigration(originalWidgets, migrationResults);
    
    const byType: Record<string, { count: number; totalSize: number }> = {};
    let totalContentSize = 0;

    for (const result of migrationResults) {
      const type = result.widgetData.type;
      const contentSize = result.contentData.size || 0;

      if (!byType[type]) {
        byType[type] = { count: 0, totalSize: 0 };
      }

      byType[type].count++;
      byType[type].totalSize += contentSize;
      totalContentSize += contentSize;
    }

    return {
      summary: {
        totalWidgets: originalWidgets.length,
        migratedWidgets: migrationResults.length,
        contentItems: migrationResults.length,
        totalContentSize,
        averageContentSize: migrationResults.length > 0 ? totalContentSize / migrationResults.length : 0,
      },
      byType,
      validation,
    };
  }
}

// ============================================================================
// MIGRATION HOOKS AND UTILITIES
// ============================================================================

/**
 * Hook to get migration service instance
 */
export function useMigrationService(): WidgetMigrationService {
  return new WidgetMigrationService();
}

/**
 * Utility function to check if migration is needed
 */
export function isMigrationNeeded(widgets: any[]): boolean {
  if (!widgets || widgets.length === 0) return false;
  
  // Check if any widget lacks contentId (indicating legacy format)
  return widgets.some(widget => !widget.contentId);
}

/**
 * Utility function to estimate migration impact
 */
export function estimateMigrationImpact(widgets: Widget[]): {
  estimatedTime: number; // in seconds
  estimatedContentSize: number; // in bytes
  riskLevel: 'low' | 'medium' | 'high';
} {
  const widgetCount = widgets.length;
  
  // Estimate content size based on widget types
  let estimatedContentSize = 0;
  for (const widget of widgets) {
    switch (widget.type) {
      case 'image':
        estimatedContentSize += 500000; // ~500KB per image
        break;
      case 'document':
        estimatedContentSize += 100000; // ~100KB per document
        break;
      case 'note':
        estimatedContentSize += 1000; // ~1KB per note
        break;
      default:
        estimatedContentSize += 5000; // ~5KB for other types
    }
  }

  // Estimate time (roughly 10ms per widget + content processing time)
  const estimatedTime = Math.ceil((widgetCount * 10 + estimatedContentSize / 100000) / 1000);

  // Determine risk level
  let riskLevel: 'low' | 'medium' | 'high' = 'low';
  if (widgetCount > 100 || estimatedContentSize > 10000000) { // 10MB
    riskLevel = 'high';
  } else if (widgetCount > 50 || estimatedContentSize > 5000000) { // 5MB
    riskLevel = 'medium';
  }

  return {
    estimatedTime,
    estimatedContentSize,
    riskLevel,
  };
}

/**
 * Utility function to backup widgets before migration
 */
export function backupWidgets(widgets: Widget[]): string {
  const backup = {
    timestamp: Date.now(),
    version: '1.0.0',
    widgets,
  };
  
  return JSON.stringify(backup, null, 2);
}

/**
 * Utility function to restore widgets from backup
 */
export function restoreWidgetsFromBackup(backupData: string): Widget[] {
  try {
    const backup = JSON.parse(backupData);
    return backup.widgets || [];
  } catch (error) {
    console.error("❌ Failed to restore widgets from backup:", error);
    return [];
  }
}