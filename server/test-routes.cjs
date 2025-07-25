#!/usr/bin/env node

/**
 * Test script for FileSystemRoutes API endpoints
 * 
 * Tests all three endpoints with various scenarios:
 * - GET /api/fs/list - List directory contents
 * - GET /api/fs/read - Read file contents
 * - POST /api/fs/write - Write file contents
 * 
 * Usage: node test-filesystem-routes.js
 */

const { join } = require("path");
const { promises: fsPromises, existsSync } = require("fs");

const projectRoot = join(__dirname, "..");

// Test configuration
const BASE_URL = 'http://localhost:6080';
const TEST_DIR = 'test-fs-temp';
const TEST_FILE = 'test-file.txt';
const TEST_CONTENT = 'Hello, FileSystem API!';

class FileSystemRoutesTest {
  constructor() {
    this.results = [];
    this.testDir = join(projectRoot, TEST_DIR);
    this.testFile = join(this.testDir, TEST_FILE);
  }

  async setup() {
    console.log('🚀 Setting up test environment...');
    console.log(`📡 Testing server at ${BASE_URL}`);
    
    // Create test directory
    await fsPromises.mkdir(this.testDir, { recursive: true });
    console.log(`📁 Created test directory: ${TEST_DIR}`);
  }

  async cleanup() {
    console.log('🧹 Cleaning up test environment...');
    
    // Remove test directory and contents
    if (existsSync(this.testDir)) {
      await fsPromises.rm(this.testDir, { recursive: true, force: true });
      console.log(`🗑️  Removed test directory: ${TEST_DIR}`);
    }
  }

  async runTest(name, testFn) {
    const startTime = Date.now();
    
    try {
      await testFn();
      const duration = Date.now() - startTime;
      this.results.push({ name, passed: true, duration });
      console.log(`✅ ${name} (${duration}ms)`);
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.results.push({ name, passed: false, error: errorMessage, duration });
      console.log(`❌ ${name} (${duration}ms): ${errorMessage}`);
    }
  }

  async makeRequest(method, endpoint, body) {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    return fetch(`${BASE_URL}${endpoint}`, options);
  }

  async testListDirectory() {
    await this.runTest('List directory - valid path', async () => {
      const response = await this.makeRequest('GET', `/api/fs/list?path=${TEST_DIR}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
      
      const data = await response.json();
      
      if (!data.items || !Array.isArray(data.items)) {
        throw new Error('Response should contain items array');
      }
      
      if (typeof data.currentPath !== 'string') {
        throw new Error('Response should contain currentPath string');
      }
    });

    await this.runTest('List directory - root path', async () => {
      const response = await this.makeRequest('GET', '/api/fs/list?path=.');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
      
      const data = await response.json();
      
      if (!data.items || !Array.isArray(data.items)) {
        throw new Error('Response should contain items array');
      }
      
      // Should contain at least package.json and src directory
      const itemNames = data.items.map((item) => item.name);
      if (!itemNames.includes('package.json')) {
        throw new Error('Root directory should contain package.json');
      }
    });

    await this.runTest('List directory - invalid path', async () => {
      const response = await this.makeRequest('GET', '/api/fs/list?path=nonexistent-directory');
      
      if (response.status !== 404) {
        throw new Error(`Expected 404, got ${response.status}`);
      }
      
      const data = await response.json();
      if (!data.error) {
        throw new Error('Error response should contain error message');
      }
    });

    await this.runTest('List directory - path traversal attempt', async () => {
      const response = await this.makeRequest('GET', '/api/fs/list?path=../../../etc');
      
      if (response.status !== 403) {
        throw new Error(`Expected 403, got ${response.status}`);
      }
      
      const data = await response.json();
      if (!data.error || !data.error.includes('Access denied')) {
        throw new Error('Should reject path traversal with access denied error');
      }
    });

    await this.runTest('List directory - file instead of directory', async () => {
      // First create a test file
      await fsPromises.writeFile(this.testFile, TEST_CONTENT);
      
      const response = await this.makeRequest('GET', `/api/fs/list?path=${TEST_DIR}/${TEST_FILE}`);
      
      if (response.status !== 400) {
        throw new Error(`Expected 400, got ${response.status}`);
      }
      
      const data = await response.json();
      if (!data.error || !data.error.includes('not a directory')) {
        throw new Error('Should reject file path with appropriate error');
      }
    });
  }

  async testReadFile() {
    // Ensure test file exists
    await fsPromises.writeFile(this.testFile, TEST_CONTENT);

    await this.runTest('Read file - valid file', async () => {
      const response = await this.makeRequest('GET', `/api/fs/read?path=${TEST_DIR}/${TEST_FILE}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
      
      const data = await response.json();
      
      if (data.content !== TEST_CONTENT) {
        throw new Error(`Expected content "${TEST_CONTENT}", got "${data.content}"`);
      }
      
      if (typeof data.size !== 'number' || data.size <= 0) {
        throw new Error('Response should contain valid size');
      }
      
      if (typeof data.modified !== 'string') {
        throw new Error('Response should contain modified timestamp');
      }
      
      if (data.encoding !== 'utf8') {
        throw new Error('Default encoding should be utf8');
      }
    });

    await this.runTest('Read file - with different encoding', async () => {
      const response = await this.makeRequest('GET', `/api/fs/read?path=${TEST_DIR}/${TEST_FILE}&encoding=base64`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
      
      const data = await response.json();
      
      if (data.encoding !== 'base64') {
        throw new Error('Encoding should be base64');
      }
      
      // Verify base64 content decodes back to original
      const decoded = Buffer.from(data.content, 'base64').toString('utf8');
      if (decoded !== TEST_CONTENT) {
        throw new Error('Base64 encoded content should decode to original text');
      }
    });

    await this.runTest('Read file - nonexistent file', async () => {
      const response = await this.makeRequest('GET', '/api/fs/read?path=nonexistent-file.txt');
      
      if (response.status !== 404) {
        throw new Error(`Expected 404, got ${response.status}`);
      }
      
      const data = await response.json();
      if (!data.error) {
        throw new Error('Error response should contain error message');
      }
    });

    await this.runTest('Read file - missing path parameter', async () => {
      const response = await this.makeRequest('GET', '/api/fs/read');
      
      if (response.status !== 400) {
        throw new Error(`Expected 400, got ${response.status}`);
      }
      
      const data = await response.json();
      if (!data.error || !data.error.includes('Path parameter is required')) {
        throw new Error('Should require path parameter');
      }
    });

    await this.runTest('Read file - invalid encoding', async () => {
      const response = await this.makeRequest('GET', `/api/fs/read?path=${TEST_DIR}/${TEST_FILE}&encoding=invalid`);
      
      if (response.status !== 400) {
        throw new Error(`Expected 400, got ${response.status}`);
      }
      
      const data = await response.json();
      if (!data.error || !data.error.includes('Invalid encoding')) {
        throw new Error('Should reject invalid encoding');
      }
    });

    await this.runTest('Read file - directory instead of file', async () => {
      const response = await this.makeRequest('GET', `/api/fs/read?path=${TEST_DIR}`);
      
      if (response.status !== 400) {
        throw new Error(`Expected 400, got ${response.status}`);
      }
      
      const data = await response.json();
      if (!data.error || !data.error.includes('not a file')) {
        throw new Error('Should reject directory path');
      }
    });

    await this.runTest('Read file - path traversal attempt', async () => {
      const response = await this.makeRequest('GET', '/api/fs/read?path=../../../etc/passwd');
      
      if (response.status !== 403) {
        throw new Error(`Expected 403, got ${response.status}`);
      }
      
      const data = await response.json();
      if (!data.error || !data.error.includes('Access denied')) {
        throw new Error('Should reject path traversal');
      }
    });
  }

  async testWriteFile() {
    const writeTestFile = join(this.testDir, 'write-test.txt');
    const writeTestContent = 'This is written content!';

    await this.runTest('Write file - create new file', async () => {
      const response = await this.makeRequest('POST', '/api/fs/write', {
        path: `${TEST_DIR}/write-test.txt`,
        content: writeTestContent
      });
      
      if (response.status !== 201) {
        throw new Error(`Expected 201, got ${response.status}: ${await response.text()}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error('Response should indicate success');
      }
      
      if (typeof data.size !== 'number' || data.size <= 0) {
        throw new Error('Response should contain valid file size');
      }
      
      if (!data.path.includes('write-test.txt')) {
        throw new Error('Response should contain correct file path');
      }
      
      // Verify file was actually created with correct content
      const fileContent = await fsPromises.readFile(writeTestFile, 'utf8');
      if (fileContent !== writeTestContent) {
        throw new Error('File content does not match expected content');
      }
    });

    await this.runTest('Write file - overwrite existing file', async () => {
      const newContent = 'Overwritten content!';
      
      const response = await this.makeRequest('POST', '/api/fs/write', {
        path: `${TEST_DIR}/write-test.txt`,
        content: newContent
      });
      
      if (response.status !== 201) {
        throw new Error(`Expected 201, got ${response.status}`);
      }
      
      // Verify file was overwritten
      const fileContent = await fsPromises.readFile(writeTestFile, 'utf8');
      if (fileContent !== newContent) {
        throw new Error('File should be overwritten with new content');
      }
    });

    await this.runTest('Write file - create nested directory', async () => {
      const nestedPath = `${TEST_DIR}/nested/deep/file.txt`;
      const nestedContent = 'Nested file content';
      
      const response = await this.makeRequest('POST', '/api/fs/write', {
        path: nestedPath,
        content: nestedContent
      });
      
      if (response.status !== 201) {
        throw new Error(`Expected 201, got ${response.status}`);
      }
      
      // Verify nested directories were created
      const fullPath = join(projectRoot, nestedPath);
      const fileContent = await fsPromises.readFile(fullPath, 'utf8');
      if (fileContent !== nestedContent) {
        throw new Error('Nested file should contain correct content');
      }
    });

    await this.runTest('Write file - missing path', async () => {
      const response = await this.makeRequest('POST', '/api/fs/write', {
        content: 'content without path'
      });
      
      if (response.status !== 400) {
        throw new Error(`Expected 400, got ${response.status}`);
      }
      
      const data = await response.json();
      if (!data.error || !data.error.includes('Path is required')) {
        throw new Error('Should require path parameter');
      }
    });

    await this.runTest('Write file - missing content', async () => {
      const response = await this.makeRequest('POST', '/api/fs/write', {
        path: `${TEST_DIR}/no-content.txt`
      });
      
      if (response.status !== 400) {
        throw new Error(`Expected 400, got ${response.status}`);
      }
      
      const data = await response.json();
      if (!data.error || !data.error.includes('Content is required')) {
        throw new Error('Should require content parameter');
      }
    });

    await this.runTest('Write file - non-string content', async () => {
      const response = await this.makeRequest('POST', '/api/fs/write', {
        path: `${TEST_DIR}/invalid-content.txt`,
        content: 123
      });
      
      if (response.status !== 400) {
        throw new Error(`Expected 400, got ${response.status}`);
      }
      
      const data = await response.json();
      if (!data.error || !data.error.includes('Content must be a string')) {
        throw new Error('Should reject non-string content');
      }
    });

    await this.runTest('Write file - invalid encoding', async () => {
      const response = await this.makeRequest('POST', '/api/fs/write', {
        path: `${TEST_DIR}/invalid-encoding.txt`,
        content: 'test content',
        encoding: 'invalid'
      });
      
      if (response.status !== 400) {
        throw new Error(`Expected 400, got ${response.status}`);
      }
      
      const data = await response.json();
      if (!data.error || !data.error.includes('Invalid encoding')) {
        throw new Error('Should reject invalid encoding');
      }
    });

    await this.runTest('Write file - path traversal attempt', async () => {
      const response = await this.makeRequest('POST', '/api/fs/write', {
        path: '../../../tmp/malicious.txt',
        content: 'malicious content'
      });
      
      if (response.status !== 403) {
        throw new Error(`Expected 403, got ${response.status}`);
      }
      
      const data = await response.json();
      if (!data.error || !data.error.includes('Access denied')) {
        throw new Error('Should reject path traversal');
      }
    });

    await this.runTest('Write file - with base64 encoding', async () => {
      const originalText = 'Base64 encoded content';
      const base64Content = Buffer.from(originalText).toString('base64');
      
      const response = await this.makeRequest('POST', '/api/fs/write', {
        path: `${TEST_DIR}/base64-test.txt`,
        content: base64Content,
        encoding: 'base64'
      });
      
      if (response.status !== 201) {
        throw new Error(`Expected 201, got ${response.status}`);
      }
      
      // Verify file was written with decoded content
      const filePath = join(this.testDir, 'base64-test.txt');
      const fileContent = await fsPromises.readFile(filePath, 'utf8');
      if (fileContent !== originalText) {
        throw new Error('Base64 content should be decoded when written');
      }
    });
  }

  async run() {
    console.log('🧪 Starting FileSystemRoutes API Tests\n');
    
    try {
      await this.setup();
      
      console.log('\n📂 Testing List Directory Endpoint');
      await this.testListDirectory();
      
      console.log('\n📖 Testing Read File Endpoint');
      await this.testReadFile();
      
      console.log('\n✏️  Testing Write File Endpoint');
      await this.testWriteFile();
      
    } finally {
      await this.cleanup();
    }
    
    this.printResults();
  }

  printResults() {
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);
    
    console.log('\n📊 Test Results Summary');
    console.log('========================');
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests} ✅`);
    console.log(`Failed: ${failedTests} ❌`);
    console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    console.log(`Total Duration: ${totalDuration}ms`);
    
    if (failedTests > 0) {
      console.log('\n❌ Failed Tests:');
      this.results
        .filter(r => !r.passed)
        .forEach(r => {
          console.log(`  • ${r.name}: ${r.error}`);
        });
      process.exit(1);
    } else {
      console.log('\n🎉 All tests passed!');
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const tester = new FileSystemRoutesTest();
  tester.run().catch((error) => {
    console.error('💥 Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = { FileSystemRoutesTest }; 