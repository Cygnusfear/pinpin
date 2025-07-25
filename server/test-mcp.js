#!/usr/bin/env node

/**
 * Test script for the Keepsync MCP Server
 *
 * This script tests the MCP server to see what documents and resources
 * are available in the keepsync store.
 */

import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";

// Start the MCP server as a child process
console.log("🧪 Starting MCP Server test...");

const mcpServer = spawn("npm", ["run", "mcp"], {
  cwd: process.cwd(),
  stdio: ["pipe", "pipe", "pipe"],
});

let responseBuffer = "";
let requestId = 1;

// Helper function to send JSON-RPC requests
function sendRequest(method, params = {}) {
  const request = {
    jsonrpc: "2.0",
    id: requestId++,
    method,
    params,
  };

  console.log(`📤 Sending: ${method}`);
  mcpServer.stdin.write(`${JSON.stringify(request)}\n`);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timeout waiting for response to ${method}`));
    }, 5000);

    function handleData(data) {
      responseBuffer += data.toString();
      const lines = responseBuffer.split("\n");

      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        try {
          const response = JSON.parse(line);
          if (response.id === request.id) {
            clearTimeout(timeout);
            mcpServer.stdout.removeListener("data", handleData);
            responseBuffer = lines[lines.length - 1]; // Keep remaining buffer
            resolve(response);
            return;
          }
        } catch (e) {
          // Ignore non-JSON lines (like console.log output)
        }
      }

      responseBuffer = lines[lines.length - 1]; // Keep incomplete line
    }

    mcpServer.stdout.on("data", handleData);
  });
}

// Test sequence
async function runTests() {
  try {
    // Wait a bit for server to start
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 1. Initialize the server
    console.log("\n1️⃣ Initializing MCP connection...");
    const initResponse = await sendRequest("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {
        roots: {
          listChanged: true,
        },
      },
      clientInfo: {
        name: "test-client",
        version: "1.0.0",
      },
    });
    console.log("✅ Initialized:", initResponse.result?.serverInfo?.name);

    // 2. List available resources
    console.log("\n2️⃣ Listing available resources...");
    const resourcesResponse = await sendRequest("resources/list");
    console.log("📚 Available Resources:");
    resourcesResponse.result?.resources?.forEach((resource) => {
      console.log(`  - ${resource.uri}: ${resource.name}`);
      console.log(`    ${resource.description}`);
    });

    // 3. Test listing keepsync documents
    console.log("\n3️⃣ Testing list_keepsync_docs tool...");
    const listDocsResponse = await sendRequest("tools/call", {
      name: "list_keepsync_docs",
      arguments: { path: "/" },
    });

    if (listDocsResponse.result?.content?.[0]?.text) {
      const docs = JSON.parse(listDocsResponse.result.content[0].text);
      console.log("📁 Keepsync Documents Found:", docs);
    } else {
      console.log("⚠️ No documents found or error occurred");
    }

    // 4. Try to read each store document
    console.log("\n4️⃣ Testing individual store documents...");

    const storeNames = ["pinboard-widgets", "pinboard-content", "pinboard-ui"];

    for (const storeName of storeNames) {
      try {
        console.log(`\n📖 Reading ${storeName}...`);
        const readResponse = await sendRequest("tools/call", {
          name: "read_keepsync_doc",
          arguments: { path: storeName },
        });

        if (readResponse.result?.content?.[0]?.text) {
          const content = JSON.parse(readResponse.result.content[0].text);
          console.log(`✅ ${storeName}:`, content ? "Data found" : "No data");
          if (content && typeof content === "object") {
            console.log(`   Keys: ${Object.keys(content).join(", ")}`);
            if (content.widgets) {
              console.log(`   Widgets count: ${content.widgets.length}`);
            }
            if (content.content) {
              console.log(
                `   Content items: ${Object.keys(content.content).length}`,
              );
            }
          }
        } else {
          console.log(`❌ ${storeName}: No content returned`);
        }
      } catch (error) {
        console.log(`❌ ${storeName}: Error - ${error.message}`);
      }
    }

    // 5. Test reading resources
    console.log("\n5️⃣ Testing resource reading...");
    const resourceUris = [
      "keepsync://stores/widgets",
      "keepsync://stores/content",
      "keepsync://stores/ui",
      "keepsync://documents/list",
    ];

    for (const uri of resourceUris) {
      try {
        console.log(`\n📖 Reading resource ${uri}...`);
        const readResourceResponse = await sendRequest("resources/read", {
          uri,
        });

        if (readResourceResponse.result?.contents?.[0]?.text) {
          const content = JSON.parse(
            readResourceResponse.result.contents[0].text,
          );
          console.log(`✅ ${uri}:`, content ? "Data found" : "No data");
        } else {
          console.log(`❌ ${uri}: No content returned`);
        }
      } catch (error) {
        console.log(`❌ ${uri}: Error - ${error.message}`);
      }
    }
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  } finally {
    console.log("\n🏁 Test completed. Shutting down MCP server...");
    mcpServer.kill();
    process.exit(0);
  }
}

// Handle server output
mcpServer.stderr.on("data", (data) => {
  console.log("🖥️ Server:", data.toString().trim());
});

mcpServer.on("close", (code) => {
  console.log(`🛑 MCP server exited with code ${code}`);
});

// Start tests
runTests();
