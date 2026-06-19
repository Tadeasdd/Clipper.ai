/** Stage B3 — wire the five handlers into the queue runtime. */
import { register, startWorkers, stopWorkers, drainWorkers, enqueue, retryRecording, STAGES } from './queue.js';
import { ingest, isPlatformUrl } from './ingest.js';
import { transcribe } from './transcribe.js';
import { analyze } from './analyze.js';
import { score } from './score.js';
import { generate } from './generate.js';

register('ingest', ingest);
register('transcribe', transcribe);
register('analyze', analyze);
register('score', score);
register('generate', generate);

export { startWorkers, stopWorkers, drainWorkers, enqueue, retryRecording, STAGES, isPlatformUrl };
