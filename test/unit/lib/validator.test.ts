import assert from 'assert';
import { validateResume } from '../../../src/lib/validator.ts';

describe('validateResume', () => {
  describe('Valid Resumes', () => {
    it('returns valid: true for a minimal valid resume object', () => {
      const resume = {
        basics: {
          name: 'John Doe',
        },
      };

      const result = validateResume(resume);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors, undefined);
    });

    it('returns valid: true for an empty object resume', () => {
      const resume = {};

      const result = validateResume(resume);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors, undefined);
    });

    it('returns valid: true for a comprehensive valid resume', () => {
      const resume = {
        basics: {
          name: 'Jane Smith',
          label: 'Software Engineer',
          email: 'jane@example.com',
          phone: '(555) 000-0000',
          url: 'https://janesmith.dev',
          summary: 'A short biography',
          location: {
            address: '123 Main St',
            postalCode: '98101',
            city: 'Seattle',
            countryCode: 'US',
            region: 'WA',
          },
          profiles: [
            {
              network: 'GitHub',
              username: 'janesmith',
              url: 'https://github.com/janesmith',
            },
          ],
        },
        work: [
          {
            name: 'Acme Corp',
            position: 'Senior Developer',
            startDate: '2020-01-01',
            endDate: '2023-01-01',
            summary: 'Led developer initiatives',
            highlights: ['Improved latency by 40%'],
          },
        ],
        education: [
          {
            institution: 'University of Washington',
            area: 'Computer Science',
            studyType: 'Bachelor of Science',
            startDate: '2016-09-01',
            endDate: '2020-06-01',
          },
        ],
        skills: [
          {
            name: 'Programming Languages',
            level: 'Expert',
            keywords: ['TypeScript', 'JavaScript', 'Python'],
          },
        ],
      };

      const result = validateResume(resume);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors, undefined);
    });
  });

  describe('Invalid Resumes and Type Checking', () => {
    it('returns valid: false for null input', () => {
      const result = validateResume(null);
      assert.strictEqual(result.valid, false);
      assert.ok(Array.isArray(result.errors));
      assert.ok(result.errors.length > 0);
    });

    it('returns valid: false for undefined input', () => {
      const result = validateResume(undefined);
      assert.strictEqual(result.valid, false);
      assert.ok(Array.isArray(result.errors));
      assert.ok(result.errors.length > 0);
    });

    it('returns valid: false for primitive non-object types', () => {
      assert.strictEqual(validateResume('string resume').valid, false);
      assert.strictEqual(validateResume(12345).valid, false);
      assert.strictEqual(validateResume(true).valid, false);
    });

    it('returns valid: false for array input', () => {
      const result = validateResume(['not', 'a', 'resume', 'object']);
      assert.strictEqual(result.valid, false);
      assert.ok(Array.isArray(result.errors));
      assert.ok(result.errors.length > 0);
    });

    it('returns valid: false when sections have invalid types', () => {
      const resume = {
        work: 'not an array',
      };
      const result = validateResume(resume);
      assert.strictEqual(result.valid, false);
      assert.ok(Array.isArray(result.errors));
      assert.ok(result.errors.some((err) => err.includes('must be array')));
    });

    it('returns valid: false when skill items have invalid types', () => {
      const resume = {
        skills: [
          {
            name: 12345,
          },
        ],
      };
      const result = validateResume(resume);
      assert.strictEqual(result.valid, false);
      assert.ok(Array.isArray(result.errors));
    });
  });
});
