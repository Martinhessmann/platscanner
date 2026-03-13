import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();

const fixtureTextPath = path.join(root, 'debug/fixtures/primeparts_inventory_result_text.txt');
const expectedPath = path.join(root, 'debug/primeparts_inventory_expected_output.json');
const outputDir = path.join(root, 'debug/results');
const snapshotPath = path.join(outputDir, 'primeparts_inventory_step_snapshot.json');
const comparisonPath = path.join(outputDir, 'primeparts_inventory_comparison.json');
const summaryPath = path.join(outputDir, 'primeparts_inventory_summary.txt');

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

const { loadPrimeSetsData } = await import('../src/services/staticDataService.ts');
const { buildStepSnapshotFromWhisperResult, compareSnapshotWithExpected } = await import('../src/services/ocr/testKit.ts');

await loadPrimeSetsData();

const fixtureText = await fs.readFile(fixtureTextPath, 'utf8');
const expected = JSON.parse(await fs.readFile(expectedPath, 'utf8'));

const snapshot = buildStepSnapshotFromWhisperResult({ result_text: fixtureText });
const comparison = compareSnapshotWithExpected(snapshot, expected);

await fs.writeFile(snapshotPath, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
await fs.writeFile(comparisonPath, JSON.stringify(comparison, null, 2) + '\n', 'utf8');

const summary = [
  `pass=${comparison.pass}`,
  `screenType=${snapshot.screenType}`,
  `expectedCount=${comparison.expectedCount}`,
  `actualCount=${comparison.actualCount}`,
  `missing=${comparison.missing.length}`,
  `unexpected=${comparison.unexpected.length}`,
  `quantityMismatches=${comparison.quantityMismatches.length}`
].join('\n');

await fs.writeFile(summaryPath, summary + '\n', 'utf8');

console.log('Fixture OCR test completed.');
console.log(`- Snapshot: ${snapshotPath}`);
console.log(`- Comparison: ${comparisonPath}`);
console.log(`- Summary: ${summaryPath}`);
console.log(summary);
