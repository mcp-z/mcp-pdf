import assert from 'assert';
import { mkdirSync, writeFileSync } from 'fs';
import { safeRmSync } from 'fs-remove-compat';
import { join } from 'path';
import { validateResume } from '../../../src/lib/validator.ts';

describe('validateResume', () => {
  const dir = join(process.cwd(), '.tmp', 'validator-tests');
  before(() => mkdirSync(dir, { recursive: true }));
  after(() => safeRmSync(dir, { recursive: true, force: true }));

  it('accepts a valid resume', () => {
    assert.deepStrictEqual(validateResume({ basics: { name: 'A' } }), { valid: true });
  });

  it('reports a resume that breaks the schema as invalid', () => {
    const result = validateResume({ basics: 'not an object' });
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors?.length);
  });

  it('throws when the schema file is missing instead of calling the resume invalid', () => {
    assert.throws(() => validateResume({ basics: { name: 'A' } }, join(dir, 'missing.schema.json')), /ENOENT/);
  });

  it('throws when the schema does not compile instead of calling the resume invalid', () => {
    const schemaPath = join(dir, 'broken.schema.json');
    writeFileSync(schemaPath, JSON.stringify({ type: 'nonsense' }));
    assert.throws(
      () => validateResume({ basics: { name: 'A' } }, schemaPath),
      (error: Error) => error instanceof Error && /schema/i.test(error.message)
    );
  });
});
