import assert from 'assert';
import { compile, registerFilter, registerHelper, render } from '../../../src/lib/template.ts';

describe('template engine', (): void => {
  describe('render', (): void => {
    it('renders simple variable interpolation', (): void => {
      const result = render('Hello, {{ name }}!', { name: 'World' });
      assert.strictEqual(result, 'Hello, World!');
    });

    it('renders tags like if and for', (): void => {
      const template = '{% if show %}Yes{% else %}No{% endif %} - {% for item in items %}{{ item }}{% endfor %}';
      const result = render(template, { show: true, items: ['a', 'b', 'c'] });
      assert.strictEqual(result, 'Yes - abc');
    });

    it('handles missing or undefined variables gracefully', (): void => {
      const result = render('Hello, {{ missing }}!', {});
      assert.strictEqual(result, 'Hello, !');
    });

    it('renders falsy values correctly (0, false, empty string)', (): void => {
      const result = render('Count: {{ count }}, Active: {{ active }}, Text: "{{ text }}"', {
        count: 0,
        active: false,
        text: '',
      });
      assert.strictEqual(result, 'Count: 0, Active: false, Text: ""');
    });

    it('renders nested object properties and arrays', (): void => {
      const result = render('{{ user.name }} ({{ user.skills[0] }})', {
        user: { name: 'Alice', skills: ['TypeScript', 'Node'] },
      });
      assert.strictEqual(result, 'Alice (TypeScript)');
    });

    it('throws when Liquid syntax error occurs', (): void => {
      const invalidTemplate = 'Hello, {{ name ';
      assert.throws(() => render(invalidTemplate, { name: 'World' }), /Invalid template/);
    });

    it('throws when runtime error occurs during rendering', (): void => {
      registerFilter('errFilter', () => {
        throw new Error('Runtime filter exception');
      });
      const template = 'Hello {{ name | errFilter }}';
      assert.throws(() => render(template, { name: 'World' }), /Invalid template/);
    });
  });

  describe('compile', (): void => {
    it('returns a render function that can be re-used with different contexts', (): void => {
      const templateFn = compile('User: {{ user.name }} ({{ user.role }})');

      const res1 = templateFn({ user: { name: 'Alice', role: 'Admin' } });
      assert.strictEqual(res1, 'User: Alice (Admin)');

      const res2 = templateFn({ user: { name: 'Bob', role: 'Guest' } });
      assert.strictEqual(res2, 'User: Bob (Guest)');
    });

    it('throws on render error in compiled function', (): void => {
      // Register a filter that throws an error
      registerFilter('throwError', () => {
        throw new Error('Filter error');
      });

      const template = '{{ name | throwError }}';
      const templateFn = compile(template);
      assert.throws(() => templateFn({ name: 'Test' }), /Invalid template/);
    });

    it('compiled function renders falsy values correctly', (): void => {
      const templateFn = compile('Score: {{ score }}, Valid: {{ valid }}');
      const result = templateFn({ score: 0, valid: false });
      assert.strictEqual(result, 'Score: 0, Valid: false');
    });
  });

  describe('built-in filters', (): void => {
    it('uppercase filter converts string to uppercase', (): void => {
      assert.strictEqual(render('{{ "hello" | uppercase }}', {}), 'HELLO');
      assert.strictEqual(render('{{ val | uppercase }}', { val: null }), '');
      assert.strictEqual(render('{{ val | uppercase }}', { val: 123 }), '123');
      assert.strictEqual(render('{{ val | uppercase }}', { val: true }), 'TRUE');
    });

    it('lowercase filter converts string to lowercase', (): void => {
      assert.strictEqual(render('{{ "HELLO" | lowercase }}', {}), 'hello');
      assert.strictEqual(render('{{ val | lowercase }}', { val: undefined }), '');
      assert.strictEqual(render('{{ val | lowercase }}', { val: 456 }), '456');
      assert.strictEqual(render('{{ val | lowercase }}', { val: false }), 'false');
    });

    it('capitalize filter capitalizes first letter', (): void => {
      assert.strictEqual(render('{{ "hello world" | capitalize }}', {}), 'Hello world');
      assert.strictEqual(render('{{ "" | capitalize }}', {}), '');
      assert.strictEqual(render('{{ val | capitalize }}', { val: null }), '');
      assert.strictEqual(render('{{ val | capitalize }}', { val: 'a' }), 'A');
      assert.strictEqual(render('{{ val | capitalize }}', { val: 123 }), '123');
    });

    it('trim filter trims whitespace', (): void => {
      assert.strictEqual(render('{{ "  hello  " | trim }}', {}), 'hello');
      assert.strictEqual(render('{{ val | trim }}', { val: null }), '');
      assert.strictEqual(render('{{ val | trim }}', { val: '   ' }), '');
      assert.strictEqual(render('{{ val | trim }}', { val: 100 }), '100');
    });

    it('join filter joins array with default and custom separators', (): void => {
      assert.strictEqual(render('{{ items | join }}', { items: ['apple', 'banana'] }), 'apple, banana');
      assert.strictEqual(render('{{ items | join: " - " }}', { items: ['apple', 'banana'] }), 'apple - banana');
      assert.strictEqual(render('{{ items | join: "" }}', { items: ['a', 'b', 'c'] }), 'abc');
      assert.strictEqual(render('{{ items | join: " | " }}', { items: [1, true, null, undefined, 'end'] }), '1 | true |  |  | end');
      assert.strictEqual(render('{{ emptyList | join }}', { emptyList: [] }), '');
      assert.strictEqual(render('{{ nonArray | join }}', { nonArray: 'single' }), 'single');
      assert.strictEqual(render('{{ val | join }}', { val: null }), '');
    });
  });

  describe('custom filters and helpers', (): void => {
    it('registerFilter adds a custom filter', (): void => {
      registerFilter('repeat', (v, times) => String(v ?? '').repeat(Number(times ?? 1)));
      const result = render('{{ "Hi" | repeat: 3 }}', {});
      assert.strictEqual(result, 'HiHiHi');
    });

    it('registerHelper adds a custom helper filter with argument conversion', (): void => {
      let capturedArgs: unknown[] = [];
      registerHelper('myHelper', (ctx, val, arg1, arg2) => {
        capturedArgs = [ctx, val, arg1, arg2];
        return `${val}:${arg1}:${arg2}`;
      });

      const result = render('{{ "item" | myHelper: "foo", "bar" }}', {});
      assert.strictEqual(result, 'item:foo:bar');
      assert.deepStrictEqual(capturedArgs, [{}, 'item', 'foo', 'bar']);
    });

    it('registerHelper handles null/undefined values and arguments', (): void => {
      registerHelper('nullHelper', (_ctx, val, arg1) => `val=${val},arg1=${arg1 ?? ''}`);
      const result = render('{{ missing | nullHelper }}', {});
      assert.strictEqual(result, 'val=,arg1=');
    });

    it('registerHelper coerces non-string arguments and values to string', (): void => {
      let capturedValue = '';
      let capturedArg1 = '';
      let capturedArg2 = '';

      registerHelper('typeCoerceHelper', (_ctx, val, arg1, arg2) => {
        capturedValue = val;
        capturedArg1 = arg1;
        capturedArg2 = arg2;
        return `${val}-${arg1}-${arg2}`;
      });

      const result = render('{{ num | typeCoerceHelper: 42, true }}', { num: 100 });
      assert.strictEqual(result, '100-42-true');
      assert.strictEqual(typeof capturedValue, 'string');
      assert.strictEqual(typeof capturedArg1, 'string');
      assert.strictEqual(typeof capturedArg2, 'string');
    });

    it('registerHelper supports helper return values of different types (numbers, booleans)', (): void => {
      registerHelper('lengthHelper', (_ctx, val) => val.length);
      registerHelper('isAwesome', (_ctx, val) => val === 'awesome');

      assert.strictEqual(render('{{ "test" | lengthHelper }}', {}), '4');
      assert.strictEqual(render('{% if "awesome" | isAwesome %}Yes{% else %}No{% endif %}', {}), 'Yes');
    });
  });
});
