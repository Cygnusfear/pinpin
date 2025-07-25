#!/usr/bin/env node

import { spawn } from "node:child_process";

console.log("🧪 Testing MCP Server Resource Reading...");

const mcpServer = spawn("npm", ["run", "mcp"], {
  cwd: process.cwd(),
  stdio: ["pipe", "pipe", "pipe"],
});

let requestId = 1;

function sendRequest(method, params = {}) {
  const request = {
    jsonrpc: "2.0",
    id: requestId++,
    method,
    params,
  };

  mcpServer.stdin.write(`${JSON.stringify(request)}\n`);

  return new Promise((resolve) => {
    function handleData(data) {
      const lines = data.toString().split("\n");
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const response = JSON.parse(line);
          if (response.id === request.id) {
            mcpServer.stdout.removeListener("data", handleData);
            resolve(response);
            return;
          }
        } catch (e) {
          // Ignore non-JSON lines
        }
      }
    }
    mcpServer.stdout.on("data", handleData);
  });
}

async function test() {
  try {
    // Wait for server startup
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Initialize
    console.log("🔧 Initializing...");
    await sendRequest("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "test-client", version: "1.0.0" },
    });

    // Test reading widgets resource
    console.log("📖 Reading widgets resource...");
    const widgetsResponse = await sendRequest("resources/read", {
      uri: "keepsync://stores/widgets",
    });

    if (widgetsResponse.result?.contents?.[0]?.text) {
      const data = JSON.parse(widgetsResponse.result.contents[0].text);
      console.log("✅ Widgets data:", {
        widgetCount: data.widgets?.length || 0,
        hasData: !!data.widgets,
        lastModified: data.lastModified,
      });

      if (data.widgets?.length > 0) {
        console.log(
          "📋 First widget:",
          JSON.stringify(data.widgets[0], null, 2),
        );
      }
    }

    // Test reading content resource
    console.log("\n📖 Reading content resource...");
    const contentResponse = await sendRequest("resources/read", {
      uri: "keepsync://stores/content",
    });

    if (contentResponse.result?.contents?.[0]?.text) {
      const data = JSON.parse(contentResponse.result.contents[0].text);
      console.log("✅ Content data:", {
        contentCount: Object.keys(data.content || {}).length,
        hasData: !!data.content,
        lastModified: data.lastModified,
      });

      const contentKeys = Object.keys(data.content || {});
      if (contentKeys.length > 0) {
        console.log(
          "📄 First content item:",
          JSON.stringify(data.content[contentKeys[0]], null, 2),
        );
      }
    }
  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    mcpServer.kill();
    process.exit(0);
  }
}

mcpServer.stderr.on("data", (data) => {
  console.log("🖥️ Server log:", data.toString().trim());
});

test();
