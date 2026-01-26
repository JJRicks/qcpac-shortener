const { Redis } = require('@upstash/redis');
const fs = require('fs');
const path = require('path');

// Initialize Redis client
// Note: These env vars must be set in Netlify site settings
const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

exports.handler = async (event, context) => {
    const pathName = event.path.replace(/^\/|\/$/g, ''); // Remove leading/trailing slashes
    const linksFilePath = path.resolve(__dirname, '../../links.txt');

    try {
        const fileContent = fs.readFileSync(linksFilePath, 'utf8');
        const lines = fileContent.split('\n');
        let targetUrl = null;
        let fallbackUrl = 'https://qcpac.com'; // Default fallback

        for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 2) {
                const slug = parts[0].replace(/^\//, ''); // Remove leading slash from slug
                const url = parts[1];

                if (slug === pathName) {
                    targetUrl = url;
                }

                // Check for fallback
                if (slug === '*') {
                    // Check if it's explicitly defined as a fallback line like "/* https://..."
                    fallbackUrl = url;
                }
            }

            // Handle #fallback comment block logic from original _redirects if needed
            // but simpler: just look for the wildcard match or exact match.
            if (line.trim().startsWith('/*')) {
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 2) {
                    fallbackUrl = parts[1];
                }
            }
        }

        if (targetUrl) {
            // Increment counter in Redis
            // Fire and forget - don't await to speed up redirect? 
            // Or await to ensure it counts. Let's await for reliability first.
            try {
                await redis.incr(`visits:${pathName}`);
            } catch (redisError) {
                console.error('Redis error:', redisError);
                // Continue to redirect even if Redis fails
            }

            return {
                statusCode: 302,
                headers: {
                    Location: targetUrl,
                },
            };
        } else {
            // Not found, redirect to fallback
            return {
                statusCode: 302,
                headers: {
                    Location: fallbackUrl,
                },
            };
        }

    } catch (error) {
        console.error('Error processing redirect:', error);
        return {
            statusCode: 500,
            body: 'Internal Server Error',
        };
    }
};
