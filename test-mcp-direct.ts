#!/usr/bin/env tsx

/**
 * Direct test of MCP server functionality
 * This tests the MCP server by directly using the internal adapter
 */

import { MCPInternalAdapter } from './server/src/mcp/mcpAdapter.js';

async function testMCPServer() {
  console.log('🧪 Testing MCP Server Direct Access...\n');

  const adapter = new MCPInternalAdapter();
  
  try {
    console.log('🔧 Initializing MCP adapter...');
    await adapter.initialize();
    console.log('✅ MCP adapter initialized successfully\n');

    // Test 1: View all pinboard widgets
    console.log('📋 Test 1: View all pinboard widgets');
    console.log('==========================================');
    const widgetsResult = await adapter.callTool('view_all_pinboard_widgets', {});
    console.log('Result:', widgetsResult.content[0].text);
    console.log('\n');

    // Test 2: View widget content
    console.log('📝 Test 2: View widget content');
    console.log('==========================================');
    const contentResult = await adapter.callTool('view_widget_content', {});
    console.log('Result:', contentResult.content[0].text);
    console.log('\n');

    // Test 3: Parse the content to find an existing content ID
    // The response is formatted text, so we need to extract the JSON from it
    const contentText = contentResult.content[0].text;
    const jsonMatch = contentText.match(/```json\n([\s\S]*?)\n```/);
    if (!jsonMatch) {
      throw new Error('Could not extract JSON from content response');
    }
    const contentData = JSON.parse(jsonMatch[1]);
    const contentEntries = Object.entries(contentData.content || {});
    
    if (contentEntries.length > 0) {
      const [firstContentId, firstContent] = contentEntries[0] as [string, any];
      console.log(`🎯 Test 3: Update existing content (ID: ${firstContentId})`);
      console.log('==========================================');
      
      // Test 4: Update the first existing content with new text
      const updateResult = await adapter.callTool('update_widget_content', {
        contentId: firstContentId,
        updates: { text: `✅ MCP Test Success! Updated at ${new Date().toISOString()}` }
      });
      console.log('Update Result:', updateResult.content[0].text);
      console.log('\n');

      // Test 5: Verify the update worked by viewing content again
      console.log('🔍 Test 4: Verify update worked');
      console.log('==========================================');
      const verifyResult = await adapter.callTool('view_widget_content', {});
      console.log('Verification Result:', verifyResult.content[0].text);
      
    } else {
      console.log('⚠️  No existing content found to update. Let\'s create a widget first.');
      
      // Test 4: Add a new widget with content
      console.log('➕ Test 3: Add a new note widget');
      console.log('==========================================');
      const addResult = await adapter.callTool('add_pinboard_widget', {
        type: 'note',
        position: { x: 100, y: 100 },
        size: { width: 200, height: 150 },
        content: { text: '🧪 MCP Test Note - Created by direct test!' }
      });
      console.log('Add Result:', addResult.content[0].text);
      console.log('\n');

      // Test 5: View content again to see the new widget
      console.log('🔍 Test 4: View content after adding widget');
      console.log('==========================================');
      const newContentResult = await adapter.callTool('view_widget_content', {});
      console.log('New Content Result:', newContentResult.content[0].text);
    }

    console.log('\n✅ All MCP tests completed successfully!');

  } catch (error) {
    console.error('❌ MCP test failed:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Stack trace:', error.stack);
    }
  }
}

// Run the test
testMCPServer().catch(console.error);