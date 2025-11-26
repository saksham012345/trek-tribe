const { MongoClient } = require('mongodb');
const url = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';

(async () => {
  const client = new MongoClient(url, { useUnifiedTopology: true });
  try {
    await client.connect();
    const admin = client.db().admin();
    const dbs = await admin.listDatabases();
    console.log('Databases found:');
    dbs.databases.forEach(d => console.log(' -', d.name, `(sizeOnDisk:${d.sizeOnDisk}, empty:${d.empty})`));

    const target = dbs.databases.map(d => d.name).filter(n => n === 'test' || n.startsWith('trek'));
    if (target.length === 0) {
      console.log('\nNo `test` or `trek*` databases found to inspect.');
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
          console.log(`  ${c.name}: ${cnt}`);
        } catch (err) {
          console.log(`  ${c.name}: error counting documents: ${err.message}`);
        }
      }
    }

    await client.close();
  } catch (e) {
    console.error('Error inspecting MongoDB:', e.message || e);
    process.exit(1);
  }
})();
