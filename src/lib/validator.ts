/**
 * Resume JSON Schema validator using AJV
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { readFileSync } from 'fs';
import moduleRoot from 'module-root-sync';
import * as path from 'path';
import { join } from 'path';
import * as url from 'url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const packageRoot = moduleRoot(__dirname);

const ajv = new Ajv({
  allErrors: true,
  verbose: true,
  strict: false,
});
addFormats(ajv);

const DEFAULT_SCHEMA_PATH = join(packageRoot, 'assets/resume.schema.json');

// Cache the compiled validator
let cachedValidate: ReturnType<typeof ajv.compile> | null = null;

/**
 * Get or compile the resume schema validator (cached)
 */
function getValidator(schemaPath?: string): ReturnType<typeof ajv.compile> {
  if (schemaPath) {
    return ajv.compile(JSON.parse(readFileSync(schemaPath, 'utf-8')));
  }
  if (cachedValidate) {
    return cachedValidate;
  }

  // Load and compile the schema once
  const schema = JSON.parse(readFileSync(DEFAULT_SCHEMA_PATH, 'utf-8'));

  cachedValidate = ajv.compile(schema);
  return cachedValidate;
}

/**
 * Validation result type
 */
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

/**
 * Validate a resume object against the JSON Resume schema.
 * Returns `valid: false` only for a resume that breaks the schema; a schema that
 * cannot be loaded or compiled (a broken install) throws.
 *
 * @param schemaPath - Schema file to compile; defaults to the bundled schema
 */
export function validateResume(resume: unknown, schemaPath?: string): ValidationResult {
  const validate = getValidator(schemaPath);

  if (!validate(resume)) {
    const errors = validate.errors?.map((error) => {
      const path = error.instancePath || 'root';
      const message = error.message || 'Unknown error';
      return `${path}: ${message}`;
    }) || ['Unknown validation error'];

    return { valid: false, errors };
  }

  return { valid: true };
}
