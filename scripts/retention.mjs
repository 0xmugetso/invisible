import {openDatabase} from '../services/store.mjs';
import {retentionPreview,cleanupRetention} from '../services/retention.mjs';
const db=openDatabase();
try {
  const preview=await retentionPreview(db);
  console.log(JSON.stringify(preview));
  if(process.argv.includes('--apply')) {
    if(!preview.safeToPruneRaw) throw new Error('A current warehouse summary is required before raw cleanup.');
    console.log(JSON.stringify(await cleanupRetention(db)));
    if(process.argv.includes('--compact')) {
      // Explicit operator-only step; never lock/rewrite the table during scheduled runs.
      await db.query('VACUUM (FULL, ANALYZE) invisible.direct_call');
      console.log('Compacted raw transaction storage');
    }
  }
} finally {await db.end()}
