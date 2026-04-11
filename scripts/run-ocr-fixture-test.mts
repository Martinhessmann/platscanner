import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const fixtureName = process.argv[2] || 'primeparts_inventory';
const imagePathArg = process.argv[3];

const fixtureTextPath = path.join(root, 'debug/fixtures', `${fixtureName}_result_text.txt`);
const fixtureWhisperPath = path.join(root, 'debug/fixtures', `${fixtureName}_whisper_result.json`);
const expectedPath = path.join(root, 'debug', `${fixtureName}_expected_output.json`);
const outputDir = path.join(root, 'debug/results');
const snapshotPath = path.join(outputDir, `${fixtureName}_step_snapshot.json`);
const comparisonPath = path.join(outputDir, `${fixtureName}_comparison.json`);
const summaryPath = path.join(outputDir, `${fixtureName}_summary.txt`);

const resolveOptionalImagePath = async (): Promise<string | null> => {
  if (imagePathArg) {
    const resolved = path.isAbsolute(imagePathArg) ? imagePathArg : path.join(root, imagePathArg);
    try {
      await fs.access(resolved);
      return resolved;
    } catch {
      console.warn(`Fixture image not found (parsing without image): ${resolved}`);
      return null;
    }
  }

  const candidates = [
    path.join(root, 'debug', `${fixtureName}.png`),
    path.join(root, 'debug', `${fixtureName}.jpg`),
    path.join(root, 'debug', `${fixtureName}.jpeg`)
  ];

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Keep searching
    }
  }

  return null;
};

const mimeTypeForImagePath = (imagePath: string): string => {
  const extension = path.extname(imagePath).toLowerCase();
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  return 'image/png';
};

await fs.mkdir(outputDir, { recursive: true });

const primesetsRaw = await fs.readFile(path.join(root, 'public/primesets.json'), 'utf8');
const relicsRaw = await fs.readFile(path.join(root, 'public/relics.json'), 'utf8');

const storage = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (key: string) => (storage.has(key) ? storage.get(key) || null : null),
  setItem: (key: string, value: string) => {
    storage.set(key, String(value));
  },
  removeItem: (key: string) => {
    storage.delete(key);
  },
  clear: () => {
    storage.clear();
  }
};

if (!(globalThis as any).window) {
  (globalThis as any).window = {
    location: { hostname: 'localhost' }
  };
}

const nativeFetch = globalThis.fetch.bind(globalThis);
(globalThis as any).fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const rawUrl = typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url;

  if (rawUrl === '/primesets.json') {
    return new Response(primesetsRaw, {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (rawUrl === '/relics.json') {
    return new Response(relicsRaw, {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return nativeFetch(input as any, init);
};

const { loadPrimeSetsData, loadRelicsData } = await import('../src/services/staticDataService.ts');
const { buildStepSnapshotFromWhisperResult, compareSnapshotWithExpected } = await import('../src/services/ocr/testKit.ts');

await Promise.all([
  loadPrimeSetsData(),
  loadRelicsData()
]);

const expected = JSON.parse(await fs.readFile(expectedPath, 'utf8'));
const fixtureSourcePath = await fs.stat(fixtureWhisperPath).then(() => fixtureWhisperPath).catch(() => fixtureTextPath);
const fixtureRaw = await fs.readFile(fixtureSourcePath, 'utf8');
const whisperFixture = JSON.parse(fixtureRaw);
const imagePath = await resolveOptionalImagePath();
const imageFile = imagePath
  ? new File(
      [await fs.readFile(imagePath)],
      path.basename(imagePath),
      { type: mimeTypeForImagePath(imagePath) }
    )
  : undefined;

const snapshot = typeof whisperFixture === 'string'
  ? await buildStepSnapshotFromWhisperResult({ result_text: whisperFixture }, imageFile)
  : await buildStepSnapshotFromWhisperResult(whisperFixture, imageFile);
const comparison = compareSnapshotWithExpected(snapshot, expected);

await fs.writeFile(snapshotPath, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
await fs.writeFile(comparisonPath, JSON.stringify(comparison, null, 2) + '\n', 'utf8');

const summary = [
  `fixture=${fixtureName}`,
  `pass=${comparison.pass}`,
  `screenType=${snapshot.screenType}`,
  `expectedCount=${comparison.expectedCount}`,
  `actualCount=${comparison.actualCount}`,
  `missing=${comparison.missing.length}`,
  `unexpected=${comparison.unexpected.length}`,
  `quantityMismatches=${comparison.quantityMismatches.length}`,
  `rarityMismatches=${comparison.rarityMismatches.length}`
].join('\n');

await fs.writeFile(summaryPath, summary + '\n', 'utf8');

console.log('Fixture OCR test completed.');
console.log(`- Fixture: ${fixtureName}`);
console.log(`- Snapshot: ${snapshotPath}`);
console.log(`- Comparison: ${comparisonPath}`);
console.log(`- Summary: ${summaryPath}`);
console.log(summary);
