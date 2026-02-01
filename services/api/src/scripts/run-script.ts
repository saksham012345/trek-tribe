/**
 * Script runner helper
 * Usage: npm run script:run <script-name-without-extension>
 * Example: npm run script:run generate-slugs
 */

import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';

const scriptName = process.argv[2];

if (!scriptName) {
    console.error('❌ Please provide a script name.');
    console.error('Usage: npm run script:run <script-name>');
    process.exit(1);
}

// Find the script file
const scriptsDir = path.join(__dirname);
const scriptPathTs = path.join(scriptsDir, `${scriptName}.ts`);
const scriptPathJs = path.join(scriptsDir, `${scriptName}.js`);

let targetScript = '';

if (fs.existsSync(scriptPathTs)) {
    targetScript = scriptPathTs;
} else if (fs.existsSync(scriptPathJs)) {
    targetScript = scriptPathJs;
} else {
    console.error(`❌ Script not found: ${scriptName}`);
    console.error(`Checked: ${scriptPathTs}`);
    console.error(`Checked: ${scriptPathJs}`);
    process.exit(1);
}

console.log(`🚀 Running script: ${scriptName}`);
console.log(`📂 Path: ${targetScript}`);

// Execute using ts-node
const tsNodePath = path.join(__dirname, '../../node_modules/.bin/ts-node');
const platformTsNode = process.platform === 'win32' ? `${tsNodePath}.cmd` : tsNodePath;

const child = spawn(platformTsNode, [targetScript], {
    stdio: 'inherit',
    env: process.env,
    cwd: path.join(__dirname, '../..') // Run from services/api root
});

child.on('close', (code) => {
    if (code === 0) {
        console.log('✅ Script completed successfully.');
    } else {
        console.error(`❌ Script failed with exit code ${code}`);
    }
    process.exit(code || 0);
});
