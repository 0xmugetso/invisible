import {setTimeout as wait} from 'node:timers/promises';
import {discoverTokenCandidates} from '../services/project-research.mjs';

const [pageLimit = '10', resumeCursor] = process.argv.slice(2);
const limit = Number(pageLimit);
if (!Number.isSafeInteger(limit) || limit < 1) throw new Error('Pass a positive page limit.');

let cursor = resumeCursor;
const seenCursors = new Set(cursor ? [cursor] : []);
for (let page = 0; page < limit; page++) {
  const result = await discoverTokenCandidates(cursor);
  console.log(JSON.stringify(result));
  cursor = result.nextCursor;
  if (!cursor) break;
  if (seenCursors.has(cursor)) throw new Error('The token index returned a repeated cursor.');
  seenCursors.add(cursor);
  if (page+1 < limit) await wait(1200);
}
