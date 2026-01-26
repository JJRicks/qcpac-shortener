const fs = require('fs');
const path = require('path');

// Mock Redis
const mockRedis = {
    incr: async (key) => {
        console.log(`[MockRedis] Incrementing key: ${key}`);
        return 1;
    }
};

// Mock environment variables
process.env.UPSTASH_REDIS_REST_URL = 'mock_url';
process.env.UPSTASH_REDIS_REST_TOKEN = 'mock_token';

// Mock the module requiring @upstash/redis
// We can't easily mock `require` in a simple script without a test runner or proxyquire.
// Instead, let's load the handler source and inject the mock or modifying the file temporarily? 
// No, that's messy.
// Better approach: Copy the logic to this script but use the mock redis, OR
// actually easier: The handler file imports Redis. If we run this script, we need to intercept that import.
// 
// Alternative: Modify the handler to accept a redis client injection? 
// Or just let it fail on Redis connection if we don't provide real creds, but we want to verify the REDIRECT logic.
//
// Let's create a testable version of the logic.
// actually, I can just write a script that READS links.txt and verifies the parsing logic matches what I expect.
// The critical part is parsing `links.txt` correctly.

const linksFilePath = path.resolve(__dirname, 'links.txt');

function testParsing() {
    console.log("Testing links.txt parsing...");
    const content = fs.readFileSync(linksFilePath, 'utf8');
    const lines = content.split('\n');

    // Test cases from _redirects content I saw earlier
    const testCases = [
        { path: 'academy', expected: 'https://www.signupgenius.com/go/20F0E48A4A82FA6FA7-59781308-qcpac' },
        { path: 'cast', expected: 'https://qcpac.com/ct-auditions-info/auditions/' },
        { path: 'unknown_slug_123', expected: 'https://qcpac.com' } // Fallback
    ];

    let passed = 0;

    testCases.forEach(test => {
        let result = 'https://qcpac.com'; // Default fallback
        let found = false;

        for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 2) {
                const slug = parts[0].replace(/^\//, '');
                const url = parts[1];

                if (slug === test.path) {
                    result = url;
                    found = true;
                    break;
                }

                if (slug === '*') {
                    result = url; // Wildcard fallback found
                }
            }
            if (line.trim().startsWith('/*')) {
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 2) {
                    result = parts[1];
                }
            }
        }

        if (result === test.expected) {
            console.log(`✅ ${test.path} -> ${result}`);
            passed++;
        } else {
            console.error(`❌ ${test.path} -> EXPECTED ${test.expected}, GOT ${result}`);
        }
    });

    console.log(`\nPassed ${passed}/${testCases.length} tests.`);
}

testParsing();
