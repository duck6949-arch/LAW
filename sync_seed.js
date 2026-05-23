import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'documents.json');
const SEED_FILE = path.join(process.cwd(), 'src', 'seedData.ts');

try {
  console.log('Reading documents from:', DATA_FILE);
  if (!fs.existsSync(DATA_FILE)) {
    console.error('File documents.json does not exist!');
    process.exit(1);
  }

  const rawData = fs.readFileSync(DATA_FILE, 'utf-8');
  let documents;
  try {
    documents = JSON.parse(rawData);
  } catch (err) {
    console.error('Error: documents.json is not valid JSON!', err);
    process.exit(1);
  }

  if (!Array.isArray(documents)) {
    console.error('Error: documents.json is not an array!');
    process.exit(1);
  }

  console.log(`Found ${documents.length} documents in documents.json.`);
  documents.forEach((doc, idx) => {
    console.log(`- Doc #${idx + 1}: ${doc.title} (${doc.type || 'N/A'}, ID: ${doc.id})`);
  });

  // Generate the content of src/seedData.ts
  const newContent = `import { LandDocument } from './types';\n\nexport const seedDocuments: LandDocument[] = ${JSON.stringify(documents, null, 2)};\n`;

  console.log('Writing to:', SEED_FILE);
  fs.writeFileSync(SEED_FILE, newContent, 'utf-8');
  console.log('Sync completed successfully!');
} catch (err) {
  console.error('An error occurred during sync:', err);
  process.exit(1);
}
