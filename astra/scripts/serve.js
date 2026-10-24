import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Default target example or passed via argument
const exampleName = process.argv[2] || '03-router-primeng-tailwind';
const exampleDir = path.join(rootDir, 'examples', exampleName);

if (!fs.existsSync(exampleDir)) {
  console.error(`Example '${exampleName}' not found in ${path.join(rootDir, 'examples')}`);
  process.exit(1);
}

// 1. Build initial bundle
async function bundle() {
  const entryFile = path.join(exampleDir, 'app.ts');
  const outFile = path.join(exampleDir, 'bundle.js');
  if (fs.existsSync(entryFile)) {
    console.log(`[Jarvis Server] Bundling ${entryFile} -> ${outFile}...`);
    await esbuild.build({
      entryPoints: [entryFile],
      bundle: true,
      format: 'esm',
      outfile: outFile,
      sourcemap: true,
    });
    console.log(`[Jarvis Server] Bundle complete!`);
  }
}

await bundle();

// 2. MIME map
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// 3. HTTP Server with SPA fallback
let currentPort = parseInt(process.env.PORT || '4200', 10);

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  let reqPath = decodeURIComponent(parsedUrl.pathname);

  let filePath = path.join(exampleDir, reqPath);

  // If path is root or directory
  if (reqPath === '/' || (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory())) {
    filePath = path.join(exampleDir, 'index.html');
  }

  // SPA fallback for Angular-style routes (e.g. /dashboard, /employees/EMP001, etc.)
  if (!fs.existsSync(filePath)) {
    filePath = path.join(exampleDir, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(`Internal Server Error: ${err.message}`);
      return;
    }
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
    });
    res.end(content);
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`Port ${currentPort} in use, trying ${currentPort + 1}...`);
    currentPort++;
    server.listen(currentPort);
  } else {
    console.error(err);
  }
});

server.listen(currentPort, () => {
  console.log(`\n======================================================`);
  console.log(`  ✦ Jarvis Framework Dev Server running!`);
  console.log(`  Target: examples/${exampleName}`);
  console.log(`  URL:    http://localhost:${currentPort}`);
  console.log(`======================================================\n`);
});
