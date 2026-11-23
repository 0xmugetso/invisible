import {readFile} from 'node:fs/promises';
import {openDatabase,transaction} from '../services/store.mjs';
import {analyzeProjectSocial} from '../services/social-analysis.mjs';

const input=JSON.parse(await readFile(new URL('../data/social-evidence.json',import.meta.url),'utf8'));
const db=openDatabase();
try {
  await db.query(await readFile(new URL('../analytics/social.sql',import.meta.url),'utf8'));
  await transaction(db,async client=>{
    for (const project of input.projects) {
      const stamp=project.observedAt ?? input.updatedAt;
      const scored=analyzeProjectSocial(project,stamp);
      await client.query(`INSERT INTO invisible.social_evidence
        (project_id,observed_at,evidence,last_attempt_at,last_attempt) VALUES ($1,$2,$3,$2,$3)
        ON CONFLICT(project_id) DO UPDATE
        SET last_attempt_at=EXCLUDED.last_attempt_at,last_attempt=EXCLUDED.last_attempt,
          observed_at=CASE WHEN EXCLUDED.evidence->>'status'='partial' THEN EXCLUDED.observed_at ELSE social_evidence.observed_at END,
          evidence=CASE WHEN EXCLUDED.evidence->>'status'='partial' THEN EXCLUDED.evidence ELSE social_evidence.evidence END
        WHERE social_evidence.last_attempt_at<=EXCLUDED.last_attempt_at`,
      [project.id,stamp,JSON.stringify(scored)]);
    }
  });
  console.log('Saved social evidence for '+input.projects.length+' mapped projects');
} finally { await db.end(); }
