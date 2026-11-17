import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import QRCode from 'qrcode';

const appUrl = process.argv[2]?.trim().replace(/\/+$/, '');
if (!appUrl || !/^https:\/\//i.test(appUrl)) {
  console.error('Usage: npm run generate:qrs -- https://your-live-domain.example');
  process.exit(1);
}

// These IDs match the five production table rows seeded in supabase/schema.sql.
const tables = Array.from({ length: 5 }, (_, index) => ({
  number: index + 1,
  id: `20000000-0000-4000-8000-00000000000${index + 1}`,
}));
const outputDirectory = resolve('public', 'table-qrs');
await mkdir(outputDirectory, { recursive: true });

await Promise.all(tables.map(async table => {
  const url = `${appUrl}/t/${table.id}`;
  const png = await QRCode.toBuffer(url, {
    type: 'png', width: 1080, margin: 3,
    color: { dark: '#153f32', light: '#ffffff' },
    errorCorrectionLevel: 'H',
  });
  await writeFile(resolve(outputDirectory, `serveiq-table-${table.number}-qr.png`), png);
  console.log(`Table ${table.number}: ${url}`);
}));

console.log(`Created 5 printable QR PNGs in ${outputDirectory}`);
