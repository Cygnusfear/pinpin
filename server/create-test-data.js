#!/usr/bin/env node

/**
 * Script to create test data in keepsync stores
 * This will help test if the MCP server can read the data correctly
 */

import { configureSyncEngine, ls, readDoc, writeDoc } from "@tonk/keepsync";

async function createTestData() {
  try {
    console.log("🔧 Configuring sync engine...");

    // Configure sync engine
    await configureSyncEngine({
      url: "http://localhost:3000",
      network: [],
    });

    console.log("✅ Sync engine configured");

    // Wait for sync engine to be ready
    const { getSyncEngine } = await import("@tonk/keepsync");
    const engine = await getSyncEngine();
    if (engine) {
      console.log("⏳ Waiting for sync engine to be ready...");
      await engine.whenReady();
      console.log("✅ Sync engine ready");
    }

    // Create test widget store data
    const testWidgetStore = {
      widgets: [
        {
          id: "widget_test_1",
          type: "note",
          position: { x: 100, y: 100 },
          size: { width: 200, height: 150 },
          transform: { rotation: 0, scale: 1 },
          zIndex: 0,
          selected: false,
          contentId: "content_test_1",
        },
        {
          id: "widget_test_2",
          type: "todo",
          position: { x: 350, y: 100 },
          size: { width: 200, height: 200 },
          transform: { rotation: 0, scale: 1 },
          zIndex: 1,
          selected: false,
          contentId: "content_test_2",
        },
      ],
      lastModified: Date.now(),
    };

    // Create test content store data
    const testContentStore = {
      content: {
        content_test_1: {
          id: "content_test_1",
          type: "note",
          text: "This is a test note created by the MCP test script",
          lastModified: Date.now(),
        },
        content_test_2: {
          id: "content_test_2",
          type: "todo",
          items: [
            { id: "todo_1", text: "Test the MCP server", completed: false },
            {
              id: "todo_2",
              text: "Verify keepsync integration",
              completed: true,
            },
          ],
          lastModified: Date.now(),
        },
      },
      lastModified: Date.now(),
    };

    // Create test UI store data
    const testUIStore = {
      selection: ["widget_test_1"],
      canvasTransform: { x: 0, y: 0, scale: 1 },
      interactionMode: "select",
      lastModified: Date.now(),
    };

    console.log("📝 Writing test data to keepsync stores...");

    // Write test data
    await writeDoc("pinboard-widgets", testWidgetStore);
    console.log("✅ Created pinboard-widgets");

    await writeDoc("pinboard-content", testContentStore);
    console.log("✅ Created pinboard-content");

    await writeDoc("pinboard-ui", testUIStore);
    console.log("✅ Created pinboard-ui");

    // Verify data was written
    console.log("\n🔍 Verifying written data...");

    const widgets = await readDoc("pinboard-widgets");
    console.log(
      "📋 Widgets:",
      widgets ? `${widgets.widgets.length} widgets found` : "No widgets",
    );

    const content = await readDoc("pinboard-content");
    console.log(
      "📄 Content:",
      content
        ? `${Object.keys(content.content).length} content items found`
        : "No content",
    );

    const ui = await readDoc("pinboard-ui");
    console.log(
      "🖱️ UI:",
      ui ? `Selection: ${ui.selection.length} items` : "No UI state",
    );

    // List all documents
    const docs = await ls("/");
    console.log("\n📂 All documents:", docs);

    console.log("\n🎉 Test data created successfully!");
  } catch (error) {
    console.error("❌ Error creating test data:", error);
    process.exit(1);
  }
}

createTestData();
