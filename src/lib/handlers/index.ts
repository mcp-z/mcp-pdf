/**
 * Element handler registry and document renderer with emoji support
 */

import type PDFDocument from 'pdfkit';

type PDFKitDocument = InstanceType<typeof PDFDocument>;

import type { FormattingOptions, LayoutDocument, LayoutElement } from '../ir/types.ts';
import type { LayoutEngine } from '../layout-engine.ts';
import { renderCredentialListHandler } from './credentialList.ts';
import { renderDividerHandler } from './divider.ts';
import { renderEntryListHandler } from './entryList.ts';
import { renderGroupHandler, setRenderElementFn } from './group.ts';
import { renderHeaderHandler } from './header.ts';
import { renderKeywordListHandler } from './keywordList.ts';
import { renderLanguageListHandler } from './languageList.ts';
import { renderReferenceListHandler } from './referenceList.ts';
import { renderSectionTitleHandler } from './sectionTitle.ts';
import { renderSummaryHighlightsHandler } from './summaryHighlights.ts';
import { renderTemplateHandler } from './template.ts';
import { renderTextHandler } from './text.ts';
import type { TypographyOptions } from './types.ts';

/**
 * Handler function type with emoji support
 */
export type ElementHandler<T extends LayoutElement = LayoutElement> = (doc: PDFKitDocument, layout: LayoutEngine, element: T, typography: TypographyOptions, formatting: FormattingOptions, emojiAvailable: boolean) => void;

/**
 * Handler registry
 */
const handlers: Record<string, ElementHandler> = {
  text: renderTextHandler as ElementHandler,
  divider: renderDividerHandler as ElementHandler,
  'section-title': renderSectionTitleHandler as ElementHandler,
  header: renderHeaderHandler as ElementHandler,
  'entry-list': renderEntryListHandler as ElementHandler,
  'keyword-list': renderKeywordListHandler as ElementHandler,
  'language-list': renderLanguageListHandler as ElementHandler,
  'credential-list': renderCredentialListHandler as ElementHandler,
  'reference-list': renderReferenceListHandler as ElementHandler,
  'summary-highlights': renderSummaryHighlightsHandler as ElementHandler,
  template: renderTemplateHandler as ElementHandler,
  group: renderGroupHandler as ElementHandler,
};

/**
 * Register a custom element handler
 */
export function registerHandler(type: string, handler: ElementHandler): void {
  handlers[type] = handler;
}

/**
 * Render a single element with emoji support
 */
export function renderElement(doc: PDFKitDocument, layout: LayoutEngine, element: LayoutElement, typography: TypographyOptions, formatting: FormattingOptions, emojiAvailable: boolean): void {
  const handler = handlers[element.type];
  if (handler) {
    handler(doc, layout, element, typography, formatting, emojiAvailable);
  } else {
    console.warn(`No handler for element type: ${element.type}`);
  }
}

// Set up circular dependency for group handler
// Group handler needs to call renderElement for its children
setRenderElementFn(renderElement as (doc: PDFKitDocument, layout: LayoutEngine, element: unknown, typography: TypographyOptions, formatting: FormattingOptions, emojiAvailable: boolean) => void);

/**
 * Render the complete layout document with emoji support
 */
export function renderLayoutDocument(doc: PDFKitDocument, layout: LayoutEngine, document: LayoutDocument, typography: TypographyOptions, emojiAvailable: boolean): void {
  for (const element of document.elements) {
    renderElement(doc, layout, element, typography, document.formatting, emojiAvailable);
  }
}

// Re-export types
export type { TypographyOptions } from './types.ts';
export { DEFAULT_TYPOGRAPHY } from './types.ts';
