import { NestFactory } from '@nestjs/core';
import { AppModule } from './dist/app.module.js';
import { RecipeRewriter } from './dist/modules/ai/RecipeRewriter.service.js';
const app = await NestFactory.create(AppModule, { logger: ['error'] });
const rewriter = app.get(RecipeRewriter);
const started = Date.now();
let rewritten = 0, skipped = 0;
for (;;) {
  const run = await rewriter.rewriteOutdated(10);
  if (run.pending === 0) break;
  rewritten += run.rewritten; skipped += run.skipped;
  console.log(`+${run.rewritten} -${run.skipped}  (total ${rewritten} rewritten, ${skipped} skipped, ${Math.round((Date.now()-started)/1000)}s)`);
  if (run.rewritten === 0) { console.log('no progress in a full batch; stopping'); break; }
}
console.log(`DONE ${rewritten} rewritten, ${skipped} skipped in ${Math.round((Date.now()-started)/60000)} min`);
await app.close(); process.exit(0);
