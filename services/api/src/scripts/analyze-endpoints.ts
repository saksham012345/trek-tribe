
import fs from 'fs';
import path from 'path';

const routesDir = path.join(__dirname, '../routes');

function getRouteFiles(dir: string): string[] {
    let results: string[] = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(getRouteFiles(file));
        } else {
            if (file.endsWith('.ts') || file.endsWith('.js')) {
                results.push(file);
            }
        }
    });
    return results;
}

const routeFiles = getRouteFiles(routesDir);
let totalEndpoints = 0;
const endpoints: { method: string, path: string, file: string, line: number }[] = [];

console.log('Analyzing routes...');

routeFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    const relativePath = path.relative(routesDir, file);

    // Regex to match router.METHOD('PATH', ...)
    // This is a heuristic. It might miss some or capture false positives.
    const regex = /(?:router|app)\.(get|post|put|delete|patch|options|head)\s*\(\s*['"`]([^'"`]+)['"`]/g;

    lines.forEach((line, index) => {
        let match;
        while ((match = regex.exec(line)) !== null) {
            endpoints.push({
                method: match[1].toUpperCase(),
                path: match[2],
                file: relativePath,
                line: index + 1
            });
            totalEndpoints++;
        }
    });
});

console.log(`Total Endpoints Found: ${totalEndpoints}`);
console.log('---------------------------------------------------');
console.log('Method\t| Path\t| File');
console.log('---------------------------------------------------');
endpoints.forEach(ep => {
    console.log(`${ep.method}\t| ${ep.path}\t| ${ep.file}:${ep.line}`);
});
console.log('---------------------------------------------------');
