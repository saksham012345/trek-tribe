const { MongoClient } = require('mongodb');
const url = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';

function previewValue(val) {
  if (val === null || val === undefined) return val;
  if (typeof val === 'string') {
    if (val.length > 200) return val.slice(0, 200) + '...[TRUNCATED]';
    return val;
  }
  if (typeof val === 'number' || typeof val === 'boolean') return val;
  if (Array.isArray(val)) return `[Array length ${val.length}]`;
  if (typeof val === 'object') return '[Object]';
  return String(val);
}

(async () => {
  const client = new MongoClient(url, { useUnifiedTopology: true });
  try {
    await client.connect();
    const admin = client.db().admin();
    const dbs = await admin.listDatabases();
    const names = dbs.databases.map(d => d.name);
    console.log('Databases found:', names.join(', '));

    const target = names.filter(n => n === 'test' || n.startsWith('trek') || n === 'trekktribe');
    if (target.length === 0) {
      console.log('No `test` or `trek*` databases found to inspect.');
    }

    for (const name of target) {
      const db = client.db(name);
      const cols = await db.listCollections().toArray();
      console.log('\nDB:', name);
      if (!cols || cols.length === 0) {
        console.log('  (no collections)');
        continue;
      }
      for (const c of cols) {
        try {
          const cnt = await db.collection(c.name).estimatedDocumentCount();
          process.stdout.write(`  ${c.name}: ${cnt}`);
          if (cnt && cnt > 0) {
            const sample = await db.collection(c.name).findOne({});
            if (sample) {
              // Build preview
              const preview = {};
              Object.keys(sample).forEach(k => {
                if (['password', 'token', 'refreshToken', 'emailToken', 'otp'].includes(k)) {
                  preview[k] = '[REDACTED]';
                } else {
                  preview[k] = previewValue(sample[k]);
                }
              });
              console.log('\n    preview:', JSON.stringify(preview, null, 2));
            } else {
              console.log(' (no sample)');
            }
          } else {
            console.log('');
          }
        } catch (err) {
          console.log(`  ${c.name}: error ${err.message}`);
        }
      }
    }

    await client.close();
  } catch (e) {
    console.error('Error inspecting MongoDB:', e.message || e);
    process.exit(1);
  }
})();
