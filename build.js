import { execSync } from 'child_process';
import fs from 'fs';

console.log('--- Legalis Land Build Process Starting ---');

const filePath = './src/seedData.ts';
try {
  let fileContent = fs.readFileSync(filePath, 'utf-8');
  console.log('Original File size:', fileContent.length);

  const targetStr = 'quy định tại Thông tư nà';
  const idx = fileContent.lastIndexOf(targetStr);
  if (idx !== -1) {
    console.log('Found truncated text in seedData.ts. Repairing...');
    // Replace the truncated text and cleanly terminate all open tags and statements
    const repairedContent = fileContent.slice(0, idx) + 'quy định tại Thông tư này."\n      }\n    ]\n  }\n];\n';
    fs.writeFileSync(filePath, repairedContent, 'utf-8');
    console.log('Repaired seedData.ts successfully! New size:', repairedContent.length);
  } else {
    console.log('seedData.ts has no truncated text pattern found or is already repaired.');
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
