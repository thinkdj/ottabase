const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

function readOption(name, fallback) {
    const index = process.argv.indexOf(`--${name}`);
    return index >= 0 ? process.argv[index + 1] : fallback;
}

const port = Number(readOption('port', '0'));
const exitAfter = Number(readOption('exit-after', '250'));
const exitCode = Number(readOption('exit-code', '0'));
const marker = readOption('marker');

if (marker) {
    fs.mkdirSync(path.dirname(marker), { recursive: true });
    fs.writeFileSync(marker, String(process.pid));
}

const server = http.createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/plain' });
    response.end('ready');
});

server.listen(port, '127.0.0.1', () => {
    console.log(`fixture ready on ${port}`);
});

const exitTimer = setTimeout(() => {
    server.close(() => process.exit(exitCode));
}, exitAfter);

function shutdown() {
    clearTimeout(exitTimer);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 250).unref();
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
