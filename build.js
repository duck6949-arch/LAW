import { execSync } from 'child_process';
import fs from 'fs';

console.log('--- Legalis Land Build Process Starting ---');

const filePath = './src/seedData.ts';
try {
  let fileContent = fs.readFileSync(filePath, 'utf-8');
  console.log('Original File size:', fileContent.length);
  const trimmed = fileContent.trim();
  if (!trimmed.endsWith('];') && !trimmed.endsWith(']}')) {
    console.log('Detected truncated JSON/Array in seedData.ts. Repairing...');
    // Append the correct closing characters: 
    // - " to close the content string
    // - } to close the current section object
    // - ] to close the sections array
    // - } to close the current document object
    // - ] to close the seedDocuments array
    // - ; to end the statement
    fileContent = trimmed + '"}]}]';
    fs.writeFileSync(filePath, fileContent, 'utf-8');
    console.log('Repaired seedData.ts successfully. New size:', fileContent.length);
  } else {
    console.log('seedData.ts looks properly closed.');
  }
} catch (e) {
  console.error('Failed to analyze/repair seedData.ts:', e);
}

try {
  console.log('1. Building Vite frontend assets...');
  execSync('npx vite build', { stdio: 'inherit' });
  console.log('Frontend built successfully!');
} catch (err) {
  console.error('Frontend build failed!', err);
  process.exit(1);
}

// Support detecting both Vercel and generic static builders
const isStaticDeploy = process.env.VERCEL || process.env.NOW_BUILDER || process.env.STATIC_BUILD;

if (isStaticDeploy) {
  console.log('--- Vercel/Static Deploy Environment Detected ---');
  console.log('Skipping server.ts bundling since Vercel is running in static frontend-only mode.');
} else {
  console.log('--- Standard Container/Server Environment Detected ---');
  console.log('2. Bundling server.ts via esbuild...');
  try {
    execSync('npx esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs', { stdio: 'inherit' });
    console.log('server.ts bundled successfully to dist/server.cjs!');
  } catch (err) {
    console.error('Failed to bundle server.ts!', err);
    process.exit(1);
  }
}

console.log('--- Legalis Land Build Completed Successfully ---');
