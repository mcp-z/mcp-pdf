/**
 * Intermediate Representation (IR) types for resume PDF generation.
 *
 * The IR provides a declarative layer between resume JSON data and PDF rendering:
 * Resume JSON → IR (LayoutDocument) → PDF
 *
 * This enables:
 * - Type-safe element rendering
 * - Pluggable handlers for each element type
 * - Layout configuration and customization
 * - Proper page break decisions
 */

// ===== Style Overrides =====

export interface StyleOverrides {
  font?: 'regular' | 'italic' | 'bold';
  alignment?: 'left' | 'center' | 'justify';
  fontSize?: number;
  lineHeight?: number;
  paragraphMargin?: number;
  itemMargin?: number;
  blockMargin?: number;
}

// ===== Formatting Options =====

export interface FormattingOptions {
  /** Date format pattern (e.g., "MMM YYYY", "DD/MM/YYYY") */
  dateFormat?: string;
  /** Separator between start and end dates (e.g., " - ", " to ") */
  dateSeparator?: string;
  /** Text for ongoing positions (e.g., "Present", "Current", "Aujourd'hui") */
  presentText?: string;
  /** Separator between contact items (e.g., " | ", " • ") */
  contactSeparator?: string;
}

// ===== Layout Config (input) =====

export interface SectionConfig {
  /** Data source path (e.g., "work", "meta.valueProp", "header") */
  source: string;
  /** Section title (omit for no title) */
  title?: string;
  /** Style overrides for this section */
  style?: StyleOverrides;
  /** LiquidJS template for custom rendering */
  template?: string;
  /** Show tenure duration for entries */
  showTenure?: boolean;
}

export interface DividerConfig {
  type: 'divider';
  thickness?: number;
  color?: string;
  margin?: { top?: number; bottom?: number };
}

export interface LayoutConfig {
  formatting?: FormattingOptions;
  sections: (SectionConfig | DividerConfig)[];
}

// ===== IR Element Types (output of transform) =====

interface BaseElement {
  type: string;
  style?: StyleOverrides;
}

/** Text element - plain text or paragraphs */
export interface TextElement extends BaseElement {
  type: 'text';
  content: string | string[];
}

/** Divider element - horizontal rule */
export interface DividerElement extends BaseElement {
  type: 'divider';
  thickness?: number;
  color?: string;
  margin?: { top?: number; bottom?: number };
}

/** Section title element */
export interface SectionTitleElement extends BaseElement {
  type: 'section-title';
  title: string;
}

/** Entry data for work/education/volunteer/projects */
export interface EntryData {
  name?: string;
  position?: string;
  location?: string;
  url?: string;
  startDate?: string;
  endDate?: string;
  summary?: string | string[];
  highlights?: string[];
  // Education-specific
  institution?: string;
  area?: string;
  studyType?: string;
  score?: string;
  courses?: string[];
  // Volunteer-specific
  organization?: string;
  // Project-specific
  entity?: string;
  description?: string;
  keywords?: string[];
  roles?: string[];
}

/** Entry list element - work, education, volunteer, projects */
export interface EntryListElement extends BaseElement {
  type: 'entry-list';
  variant: 'work' | 'education';
  entries: EntryData[];
  showTenure?: boolean;
}

/** Keyword list element - skills, interests */
export interface KeywordListElement extends BaseElement {
  type: 'keyword-list';
  items: Array<{ name?: string; level?: string; keywords?: string[] }>;
}

/** Language list element */
export interface LanguageListElement extends BaseElement {
  type: 'language-list';
  items: Array<{ language?: string; fluency?: string }>;
}

/** Credential data for awards, certificates, publications */
export interface CredentialData {
  // Common
  name?: string;
  date?: string;
  url?: string;
  summary?: string;
  // Awards
  title?: string;
  awarder?: string;
  // Certificates
  issuer?: string;
  // Publications
  publisher?: string;
  releaseDate?: string;
}

/** Credential list element - awards, certificates, publications */
export interface CredentialListElement extends BaseElement {
  type: 'credential-list';
  items: CredentialData[];
}

/** Reference list element */
export interface ReferenceListElement extends BaseElement {
  type: 'reference-list';
  items: Array<{ name?: string; reference?: string }>;
}

/** Summary with highlights element */
export interface SummaryHighlightsElement extends BaseElement {
  type: 'summary-highlights';
  summary?: string;
  highlights: string[];
}

/** Contact item for header */
export interface ContactItem {
  text: string;
  url?: string;
}

/** Header element - name, label, contact info */
export interface HeaderElement extends BaseElement {
  type: 'header';
  name: string;
  label?: string;
  contactItems: ContactItem[];
}

/** Custom template element - for user-defined LiquidJS templates */
export interface TemplateElement extends BaseElement {
  type: 'template';
  template: string;
  data: Record<string, unknown>;
}

/** Discriminated union of all layout elements */
export type LayoutElement = TextElement | DividerElement | SectionTitleElement | EntryListElement | KeywordListElement | LanguageListElement | CredentialListElement | ReferenceListElement | SummaryHighlightsElement | HeaderElement | TemplateElement;

// ===== Layout Document (complete IR) =====

export interface DocumentMetadata {
  name: string;
  label?: string;
  keywords?: string[];
}

export interface LayoutDocument {
  metadata: DocumentMetadata;
  formatting: FormattingOptions;
  elements: LayoutElement[];
}

// ===== Config Type Guards =====

export function isDividerConfig(config: SectionConfig | DividerConfig): config is DividerConfig {
  return 'type' in config && config.type === 'divider';
}

export function isSectionConfig(config: SectionConfig | DividerConfig): config is SectionConfig {
  return 'source' in config;
}
