#!/usr/bin/env node
// Syncs package.json version to server.json
// Runs automatically when you run: npm version patch/minor/major

const fs = require('fs');
const path = require('path');

// Read package.json version
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
const version = packageJson.version;

// Update server.json
const serverJsonPath = path.join(__dirname, '../server.json');
const serverJson = JSON.parse(fs.readFileSync(serverJsonPath, 'utf8'));

serverJson.version = version;
serverJson.packages[0].version = version;

fs.writeFileSync(serverJsonPath, JSON.stringify(serverJson, null, 2) + '\n');

console.log(`✅ Synced server.json to version ${version}`);
