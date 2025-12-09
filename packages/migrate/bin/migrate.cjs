#!/usr/bin/env node

// This is the CLI entry point that loads the compiled JavaScript CLI
const path = require('path');

// Load the compiled CLI
const cliPath = path.join(__dirname, '../dist/cli/index.js');
require(cliPath);
