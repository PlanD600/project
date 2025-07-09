const http = require('http');
const https = require('https');
const { URL } = require('url');
const path = require('path');

const BASE_URL = process.env.CHECK_URL || 'http://localhost:8080';
const frontendDistPath = path.join(__dirname, '../dist');

function request(method, path, options = {}) {
  return new Promise((resolve) => {
    const url = new URL(path, BASE_URL);
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request(
      url,
      {
        method,
        headers: options.headers || {},
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          resolve({ status: res.statusCode, data, headers: res.headers });
        });
      }
    );
    req.on('error', (err) => {
      resolve({ status: 0, data: String(err), headers: {} });
    });
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

async function main() {
  console.log(`Checking server at ${BASE_URL}\n`);

  // 1. Check static file serving
  const root = await request('GET', '/');
  console.log('/ [GET]:', root.status, root.data.slice(0, 100), '...');

  // 2. Check /api/health
  const health = await request('GET', '/api/health');
  console.log('/api/health [GET]:', health.status, health.data);

  // 3. Check /api/auth/login (GET)
  const loginGet = await request('GET', '/api/auth/login');
  console.log('/api/auth/login [GET]:', loginGet.status, loginGet.data);

  // 4. Check /api/auth/login (POST, dummy credentials)
  const loginPost = await request('POST', '/api/auth/login', {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'dummy@example.com', password: 'dummy1234' }),
  });
  console.log('/api/auth/login [POST]:', loginPost.status, loginPost.data);

  // 5. Check /api/auth/me (GET, no token)
  const me = await request('GET', '/api/auth/me');
  console.log('/api/auth/me [GET]:', me.status, me.data);

  // 6. Check /api/organizations (GET, no token)
  const orgs = await request('GET', '/api/organizations');
  console.log('/api/organizations [GET]:', orgs.status, orgs.data);
}

main(); 