// Test script to verify widget positioning works with correct format
import { mcpAdapter } from './server/src/mcp/mcpAdapter.ts';

async function testWidgetMove() {
  try {
    console.log('🧪 Testing widget positioning with correct format...');
    
    // Initialize the MCP adapter
    await mcpAdapter.initialize();
    
    // First, get current widget state
    console.log('\n📋 Current widgets:');
    const widgetsResult = await mcpAdapter.callTool('view_all_pinboard_widgets');
    console.log(widgetsResult.content[0].text);
    
    // Test widget position update with correct format
    console.log('\n🔄 Moving widget to position (100, 200)...');
    const updateResult = await mcpAdapter.callTool('update_pinboard_widget', {
      id: 'widget_1753708201236_98y4fsfxa',
      updates: {
        x: 100,
        y: 200
      }
    });
    console.log('✅ Update result:', updateResult.content[0].text);
    
    // Verify the change
    console.log('\n🔍 Verifying widget position changed:');
    const verifyResult = await mcpAdapter.callTool('view_all_pinboard_widgets');
    console.log(verifyResult.content[0].text);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testWidgetMove();