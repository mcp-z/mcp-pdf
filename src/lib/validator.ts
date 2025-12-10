/**
 * Resume JSON Schema validator using AJV
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { readFileSync } from 'fs';
import moduleRoot from 'module-root-sync';
import { join } from 'path';

// Get package root directory (works in both src and dist)
// Use keyExists: 'name' to skip stub package.json files (e.g., dist/esm/package.json with only "type")
const packageRoot = moduleRoot(import.meta.filename);

const ajv = new Ajv({
  allErrors: true,
  verbose: true,
  strict: false,
});
addFormats(ajv);

// Cache the compiled validator
let cachedValidate: ReturnType<typeof ajv.compile> | null = null;

/**
 * Get or compile the resume schema validator (cached)
 */
function getValidator(): ReturnType<typeof ajv.compile> {
  if (cachedValidate) {
    return cachedValidate;
  }

  // Load and compile the schema once
  const schemaPath = join(packageRoot, 'assets/resume.schema.json');
  const schemaContent = readFileSync(schemaPath, 'utf-8');
  const schema = JSON.parse(schemaContent);

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
 * Validate a resume object against the JSON Resume schema
 */
export function validateResume(resume: unknown): ValidationResult {
  try {
    // Get cached validator
    const validate = getValidator();

    // Validate the resume
    const valid = validate(resume);

    if (!valid) {
      const errors = validate.errors?.map((error) => {
        const path = error.instancePath || 'root';
        const message = error.message || 'Unknown error';
        return `${path}: ${message}`;
      }) || ['Unknown validation error'];

      return { valid: false, errors };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      errors: [`Schema validation setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
    };
  }
}
