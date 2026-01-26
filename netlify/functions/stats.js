const { Redis } = require('@upstash/redis');
const fs = require('fs');
const path = require('path');

// Initialize Redis client
const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

exports.handler = async (event, context) => {
    // Basic CORS headers to allow local dev or same-origin
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    const linksFilePath = path.resolve(__dirname, '../../links.txt');

    try {
        if (!fs.existsSync(linksFilePath)) {
            console.error(`[Error] File not found at: ${linksFilePath}`);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Configuration file missing' }),
            };
        }

        const fileContent = fs.readFileSync(linksFilePath, 'utf8');
        const lines = fileContent.split('\n');

        const links = [];

        // Parse links.txt to find all active slugs
        for (const line of lines) {
            // Skip comments and empty lines
            if (!line.trim() || line.trim().startsWith('#')) continue;

            const parts = line.trim().split(/\s+/);
            if (parts.length >= 2) {
                const rawSlug = parts[0];
                const destination = parts[1];

                // Skip wildcards for specific stats, or handle them differently?
                // Let's list specific slugs. 
                if (rawSlug === '*' || rawSlug.startsWith('/*')) continue;

                const slug = rawSlug.replace(/^\//, ''); // Remove leading slash
                links.push({ slug, destination });
            }
        }

        if (links.length === 0) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ data: [] }),
            };
        }

        // Batch fetch all visit counts
        // Keys are visits:<slug>
        const pipeline = redis.pipeline();
        links.forEach(link => {
            pipeline.get(`visits:${link.slug}`);
        });

        const results = await pipeline.exec();

        // Combine links with their counts
        const stats = links.map((link, index) => {
            // Redis pipeline results: [error, result] or just result depending on library version?
            // Upstash/redis pipeline.exec() returns array of results. 
            // If error, it might throw or return null?
            // Usually simply returns the value.
            const count = results[index] || 0;
            return {
                slug: link.slug,
                destination: link.destination,
                visits: parseInt(count, 10) || 0
            };
        });

        // Sort by visits descending
        stats.sort((a, b) => b.visits - a.visits);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ data: stats }),
        };

    } catch (error) {
        console.error('Error fetching stats:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal Server Error', details: error.message }),
        };
    }
};
