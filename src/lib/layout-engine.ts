import type PDFDocument from 'pdfkit';

type PDFDocumentType = InstanceType<typeof PDFDocument>;

export type LayoutMode = 'document' | 'fixed';

export interface LayoutOptions {
  mode?: LayoutMode;
}

/**
 * LayoutEngine manages vertical page flow with automatic page breaks.
 *
 * Modes:
 * - 'document' (default): Measures content and auto-breaks at page boundaries
 * - 'fixed': No auto breaks, content renders at exact positions (for flyers/posters)
 */
export class LayoutEngine {
  private currentY = 0;
  private pageWidth = 0;
  private contentWidth = 0;
  private marginLeft = 0;
  private marginTop = 0;
  private marginBottom = 0;
  private mode: LayoutMode = 'document';

  /**
   * Initialize the engine with document dimensions from PDFKit.
   */
  init(doc: PDFDocumentType, options?: LayoutOptions): void {
    this.marginLeft = doc.page.margins.left;
    this.marginTop = doc.page.margins.top;
    this.marginBottom = doc.page.margins.bottom;
    this.pageWidth = doc.page.width;
    this.contentWidth = doc.page.width - this.marginLeft - doc.page.margins.right;
    this.currentY = this.marginTop;
    this.mode = options?.mode ?? 'document';
  }

  /**
   * Get remaining vertical space on current page (in points).
   */
  remainingHeight(doc: PDFDocumentType): number {
    return doc.page.height - this.marginBottom - this.currentY;
  }

  /**
   * Add a new page and reset Y position.
   */
  newPage(doc: PDFDocumentType): void {
    doc.addPage();
    this.currentY = this.marginTop;
  }

  /**
   * Ensure there's enough space for content. If not, add a new page.
   * In 'fixed' mode, this is a no-op.
   */
  ensureSpace(doc: PDFDocumentType, heightNeeded: number): void {
    if (this.mode === 'fixed') {
      return; // No auto page breaks in fixed mode
    }
    if (this.remainingHeight(doc) < heightNeeded) {
      this.newPage(doc);
    }
  }

  /**
   * Move the Y cursor down by the specified amount (in points).
   */
  advanceY(amount: number): void {
    this.currentY += amount;
  }

  /**
   * Alias for ensureSpace - ensure a block fits, otherwise start a new page.
   */
  ensureBlock(doc: PDFDocumentType, height: number): void {
    this.ensureSpace(doc, height);
  }

  /**
   * Get current Y position (in points from top of page).
   */
  getCurrentY(): number {
    return this.currentY;
  }

  /**
   * Set the Y position explicitly (useful for absolute positioning).
   */
  setY(y: number): void {
    this.currentY = y;
  }

  /**
   * Get the content width (page width minus margins).
   */
  getContentWidth(): number {
    return this.contentWidth;
  }

  /**
   * Get the full page width.
   */
  getPageWidth(): number {
    return this.pageWidth;
  }

  /**
   * Get the left margin (alias for getMarginLeft for handler compatibility).
   */
  getMargin(): number {
    return this.marginLeft;
  }

  /**
   * Get the left margin.
   */
  getMarginLeft(): number {
    return this.marginLeft;
  }

  /**
   * Get the top margin.
   */
  getMarginTop(): number {
    return this.marginTop;
  }

  /**
   * Check if engine is in document mode (auto page breaks enabled).
   */
  isDocumentMode(): boolean {
    return this.mode === 'document';
  }

  /**
   * Check if engine is in fixed mode (no auto page breaks).
   */
  isFixedMode(): boolean {
    return this.mode === 'fixed';
  }
}
