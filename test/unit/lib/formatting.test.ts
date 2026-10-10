import assert from 'assert';
import { DEFAULT_FIELD_TEMPLATES, renderField } from '../../../src/lib/formatting.ts';
import { tokenizeMarkdown, tokensToStyledSegments } from '../../../src/lib/markdown.ts';
import { compile, render } from '../../../src/lib/template.ts';

describe('DEFAULT_FIELD_TEMPLATES', () => {
  it('all parse', () => {
    for (const [name, template] of Object.entries(DEFAULT_FIELD_TEMPLATES)) {
      assert.doesNotThrow(() => compile(template), `${name} template`);
    }
  });

  it('treats empty values as missing', () => {
    assert.strictEqual(renderField(DEFAULT_FIELD_TEMPLATES.language, { language: 'English', fluency: '' }), 'English');
    assert.strictEqual(renderField(DEFAULT_FIELD_TEMPLATES.degree, { studyType: 'BSc', area: '' }), 'BSc');
  });

  it('renders a credential with each kind of source', () => {
    assert.strictEqual(renderField(DEFAULT_FIELD_TEMPLATES.credential, { title: 'Prize', awarder: 'Society' }), 'Prize, Society');
    assert.strictEqual(renderField(DEFAULT_FIELD_TEMPLATES.credential, { name: 'Cert', issuer: 'Org' }), 'Cert, Org');
    assert.strictEqual(renderField(DEFAULT_FIELD_TEMPLATES.credential, { title: 'Book', publisher: 'Press' }), 'Book, Press');
  });
});

describe('template errors', () => {
  it('render reports an invalid template instead of returning its source', () => {
    assert.throws(() => render('{{ name %}', { name: 'x' }), /\{\{ name %\}/);
  });

  it('compile reports an invalid template', () => {
    assert.throws(() => compile('{% if %}'), /\{% if %\}/);
  });
});

function styled(markdown: string): Array<[string, string]> {
  return tokensToStyledSegments(tokenizeMarkdown(markdown)).map((seg) => [seg.content, seg.type === 'link' ? `link:${seg.url}` : seg.bold ? 'bold' : 'plain']);
}

describe('field templates produce markdown', () => {
  it('bolds the skill name and keeps the level', () => {
    assert.deepStrictEqual(styled(renderField(DEFAULT_FIELD_TEMPLATES.skill, { name: 'Languages', level: 'Expert', keywords: ['TS', 'Go'] })), [
      ['Languages', 'bold'],
      [' (Expert): TS, Go', 'plain'],
    ]);
    assert.deepStrictEqual(styled(renderField(DEFAULT_FIELD_TEMPLATES.skill, { name: 'Tools', level: '', keywords: ['Git'] })), [
      ['Tools', 'bold'],
      [': Git', 'plain'],
    ]);
  });

  it('escapes inserted values so they render as written', () => {
    assert.deepStrictEqual(styled(renderField(DEFAULT_FIELD_TEMPLATES.skill, { name: 'snake_case **x**', level: '', keywords: ['*nix', '[draft](notes)'] })), [
      ['snake_case **x**', 'bold'],
      [': *nix, [draft](notes)', 'plain'],
    ]);
  });

  it('keeps links inside the contact line', () => {
    const url = renderField(DEFAULT_FIELD_TEMPLATES.url, { text: 'my_site', url: 'https://x.y/a_b' });
    const contact = renderField(DEFAULT_FIELD_TEMPLATES.contactLine, { items: ['a*b@c.d', url] });
    assert.deepStrictEqual(styled(contact), [
      ['a*b@c.d | ', 'plain'],
      ['my_site', 'link:https://x.y/a_b'],
    ]);
  });
});
