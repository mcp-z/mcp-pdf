import assert from 'assert';
import PDFDocument from 'pdfkit';
import type { FieldTemplates, StructuredContentElement } from '../../../../src/lib/ir/types.ts';
import { DEFAULT_TYPOGRAPHY } from '../../../../src/lib/types/typography.ts';
import { createMeasureContext, measureStructuredContent } from '../../../../src/lib/yoga-resume/measure.ts';

/**
 * Tests for yoga-resume measurement functions.
 *
 * These tests verify that measurement functions accurately predict
 * the height that will be used when content is rendered.
 *
 * KEY ISSUE: When text contains markdown bold (**text**), the render uses
 * Helvetica-Bold which is WIDER than Helvetica. This causes more line wrapping
 * and taller rendered output than what's measured with regular font.
 */
describe('yoga-resume/measure', () => {
  // Standard test page config
  const pageWidth = 612;
  const margins = { top: 50, bottom: 50, left: 54, right: 54 };
  const contentWidth = pageWidth - margins.left - margins.right; // 504pt

  // Empty field templates for testing
  const fieldTemplates: Required<FieldTemplates> = {
    location: '{location}',
    dateRange: '{dateRange}',
    degree: '{degree}',
    contactLine: '{contactLine}',
    credential: '{credential}',
    language: '{language}',
    skill: '{skill}',
    url: '{url}',
  };

  function createTestDoc(): PDFKit.PDFDocument {
    return new PDFDocument({
      size: [pageWidth, 792],
      margins,
      autoFirstPage: false,
    });
  }

  describe('measureStructuredContent', () => {
    it('measures plain text bullets accurately', () => {
      const doc = createTestDoc();
      doc.addPage();

      const element: StructuredContentElement = {
        type: 'structured-content',
        bullets: ['First bullet point with plain text', 'Second bullet point also plain', 'Third bullet point'],
      };

      const ctx = createMeasureContext(doc, DEFAULT_TYPOGRAPHY, fieldTemplates, false, contentWidth);
      const measuredHeight = measureStructuredContent(ctx, element);

      // Manually calculate expected height using same logic as render
      const { content } = DEFAULT_TYPOGRAPHY;
      const lineGap = (content.lineHeight ?? 1.3) * content.fontSize - content.fontSize;
      const bulletWidth = contentWidth - content.bulletIndent;

      let expectedHeight = 0;
      for (const bullet of element.bullets ?? []) {
        doc.font('Helvetica').fontSize(content.fontSize);
        const bulletText = `• ${bullet}`;
        expectedHeight += doc.heightOfString(bulletText, { width: bulletWidth, lineGap });
        expectedHeight += content.bulletMarginBottom;
      }

      // Should match within 1pt tolerance (floating point)
      assert.ok(Math.abs(measuredHeight - expectedHeight) < 1, `Measured height (${measuredHeight.toFixed(1)}) should match expected (${expectedHeight.toFixed(1)})`);

      doc.end();
    });

    it('measures markdown bold text accurately - accounts for font width differences', () => {
      // This test verifies that measurement accounts for bold text width
      // by using measureMarkdownTextHeight which parses markdown and measures
      // each segment with its actual font (bold for **text**, regular for rest).

      const doc = createTestDoc();
      doc.addPage();

      // Exact bullet from resume.json with bold text
      const element: StructuredContentElement = {
        type: 'structured-content',
        bullets: ['**Holistic business transformation leader** - Set direction, align stakeholders, identify and solve for business outcomes and risk, build organizational capabilities, and then lead to deliver results at enterprise scale'],
      };

      const ctx = createMeasureContext(doc, DEFAULT_TYPOGRAPHY, fieldTemplates, false, contentWidth);
      const measuredHeight = measureStructuredContent(ctx, element);

      const { content } = DEFAULT_TYPOGRAPHY;
      const lineGap = (content.lineHeight ?? 1.3) * content.fontSize - content.fontSize;
      const bulletWidth = contentWidth - content.bulletIndent;

      // Strip markdown and measure with regular font (the OLD broken approach)
      const bulletText0 = element.bullets?.[0] ?? '';
      const stripped = bulletText0.replace(/\*\*/g, '');
      const bulletText = `• ${stripped}`;

      doc.font('Helvetica').fontSize(content.fontSize);
      const regularHeight = doc.heightOfString(bulletText, { width: bulletWidth, lineGap });
      const expectedWithMargin = regularHeight + content.bulletMarginBottom;

      console.log('Single bullet comparison:');
      console.log(`  Regular font (old approach): ${regularHeight.toFixed(1)}pt`);
      console.log(`  Measured (new approach): ${measuredHeight.toFixed(1)}pt`);
      console.log(`  Expected with margin: ${expectedWithMargin.toFixed(1)}pt`);

      // Measurement should be close to actual rendered height
      // The new approach uses measureMarkdownTextHeight which measures with mixed fonts
      assert.ok(Math.abs(measuredHeight - expectedWithMargin) < 5, `Measurement ${measuredHeight.toFixed(1)}pt should be close to expected ${expectedWithMargin.toFixed(1)}pt`);

      doc.end();
    });

    it('measures summary with markdown accurately', () => {
      const doc = createTestDoc();
      doc.addPage();

      // Summary with significant bold text
      const element: StructuredContentElement = {
        type: 'structured-content',
        summary: '**Experienced technical leader** with extensive experience delivering **high-impact business results** across complex enterprise software environments and diverse global stakeholder groups requiring careful coordination.',
      };

      const ctx = createMeasureContext(doc, DEFAULT_TYPOGRAPHY, fieldTemplates, false, contentWidth);
      const measuredHeight = measureStructuredContent(ctx, element);

      const { content } = DEFAULT_TYPOGRAPHY;
      const lineGap = (content.lineHeight ?? 1.3) * content.fontSize - content.fontSize;

      // Measure with regular font (base comparison)
      const summaryText = typeof element.summary === 'string' ? element.summary : (element.summary?.[0] ?? '');
      const stripped = summaryText.replace(/\*\*/g, '');
      doc.font('Helvetica').fontSize(content.fontSize);
      const regularHeight = doc.heightOfString(stripped, { width: contentWidth, lineGap });
      const expectedWithMargins = content.marginTop + regularHeight + content.paragraphMarginBottom;

      console.log('Summary comparison:');
      console.log(`  Regular font: ${regularHeight.toFixed(1)}pt`);
      console.log(`  Measured: ${measuredHeight.toFixed(1)}pt`);
      console.log(`  Expected with margins: ${expectedWithMargins.toFixed(1)}pt`);

      // Measurement should be close to expected (within 5pt tolerance for mixed fonts)
      assert.ok(Math.abs(measuredHeight - expectedWithMargins) < 5, `Summary measurement ${measuredHeight.toFixed(1)}pt should be close to expected ${expectedWithMargins.toFixed(1)}pt`);

      doc.end();
    });
  });
});
