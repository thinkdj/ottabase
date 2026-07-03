// Copies the CSS file to the dist folder after build
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'src', 'styles', 'cropper.css');
const dest = path.join(__dirname, '..', 'dist', 'styles.css');

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(src, dest);
console.log('Copied cropper.css → dist/styles.css');
