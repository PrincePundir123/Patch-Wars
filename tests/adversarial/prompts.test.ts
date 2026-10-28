import {it,expect} from 'vitest';
import {representative,adversarial} from '../../packages/test-fixtures/src/prompts.js';
import {moderate} from '../../apps/forge-worker/src/pipeline.js';
it.each(representative)('accepts a representative concept: %s',idea=>expect(()=>moderate(idea)).not.toThrow());
it.each(adversarial)('rejects a malicious or unsupported concept: %s',idea=>expect(()=>moderate(idea)).toThrow());
