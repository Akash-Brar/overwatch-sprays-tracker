const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const USER_DATA_FILE = path.join(ROOT, 'user-data.json');
const PORT = 3000;

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css':  'text/css; charset=utf-8',
    '.js':   'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.svg':  'image/svg+xml',
    '.webp': 'image/webp',
};

function readUserData() {
    try {
        return JSON.parse(fs.readFileSync(USER_DATA_FILE, 'utf8'));
    } catch {
        return {};
    }
}

function writeUserData(data) {
    fs.writeFileSync(USER_DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function sendJSON(res, status, obj) {
    const body = JSON.stringify(obj);
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body),
    });
    res.end(body);
}

const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    // ---- API ----
    if (url.pathname === '/api/user-data') {
        if (req.method === 'GET') {
            return sendJSON(res, 200, readUserData());
        }

        if (req.method === 'PUT') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    if (typeof parsed !== 'object' || parsed === null) {
                        return sendJSON(res, 400, { error: 'Body must be a JSON object' });
                    }
                    writeUserData(parsed);
                    sendJSON(res, 200, { ok: true });
                } catch (err) {
                    sendJSON(res, 400, { error: 'Invalid JSON' });
                }
            });
            return;
        }

        res.writeHead(405).end();
        return;
    }

    // ---- Static files ----
    let filePath = url.pathname === '/' ? '/index.html' : url.pathname;
    filePath = path.join(ROOT, path.normalize(filePath));

    // Prevent path traversal
    if (!filePath.startsWith(ROOT)) {
        res.writeHead(403).end();
        return;
    }

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404).end('Not found');
            return;
        }
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(data);
    });
});

server.listen(PORT, () => {
    console.log(`Serving on http://localhost:${PORT}`);
});