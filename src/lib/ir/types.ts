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

// ===== Field Templates =====

/**
 * Field templates for rendering field combinations.
 * Each template is a LiquidJS template string.
 * Handlers use these for field-level rendering while maintaining structural layout.
 */
export interface FieldTemplates {
  /** Location display (default: "{{ city }}{% if region %}, {{ region }}{% endif %}") */
  location?: string;
  /** Date range display (default: "{{ start | date }} – {{ end | date | default: 'Present' }}") */
  dateRange?: string;
  /** Education degree line (default: "{{ studyType }}{% if area %}, {{ area }}{% endif %}") */
  degree?: string;
  /** Contact items separator (default: "{{ items | join: ' | ' }}") */
  contactLine?: string;
  /** Credential display (default: "{{ title | default: name }}{% if awarder %}, {{ awarder }}{% endif %}{% if issuer %}, {{ issuer }}{% endif %}{% if publisher %}, {{ publisher }}{% endif %}") */
  credential?: string;
  /** Language display (default: "{{ language }}{% if fluency %} ({{ fluency }}){% endif %}") */
  language?: string;
  /** Skill category display (default: "{{ name }}: {{ keywords | join: ', ' }}") */
  skill?: string;
  /** URL display as markdown link (default: "[{{ text }}]({{ url }})") */
  url?: string;
}

// ===== Sections Config (input) =====

/**
 * Available renderer types for section content.
 * Auto-inferred from data shape if not specified.
 */
export type RenderType =
  | 'header' // Name + contact line (must be explicit, never auto-inferred)
  | 'entry-list' // Work, education, volunteer, projects
  | 'keyword-list' // Skills, interests
  | 'language-list' // Languages
  | 'credential-list' // Awards, certificates, publications
  | 'reference-list' // References
  | 'summary-highlights' // Summary with bullet highlights
  | 'text'; // Plain text or paragraphs

export interface SectionConfig {
  /** Data source path in resume schema using dot notation (e.g., "basics", "work", "education", "meta.customField") */
  source: string;
  /** Renderer type override. Auto-inferred from data shape if omitted. Use "header" for basics → name/contact rendering. */
  render?: RenderType;
  /** Section title (omit for no title) */
  title?: string;
  /** Style overrides for this section */
  style?: StyleOverrides;
  /** LiquidJS template for custom rendering */
  template?: string;
}

export interface DividerConfig {
  type: 'divider';
  thickness?: number;
  color?: string;
  margin?: { top?: number; bottom?: number };
}

export interface SectionsConfig {
  /** Field templates for customizing field-level rendering */
  fieldTemplates?: FieldTemplates;
  sections: (SectionConfig | DividerConfig)[];
}

// ===== IR Element Types (output of transform) =====

interface BaseElement {
  type: string;
  style?: StyleOverrides;
  /** Source path this element was generated from (for layout assignment) */
  source?: string;
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
export interface StructuredContentElement extends BaseElement {
  type: 'structured-content';
  summary?: string | string[];
  bullets?: string[];
  spacing?: {
    paragraphMarginBottom?: number;
    bulletGap?: number;
    bulletMarginBottom?: number;
    bulletIndent?: number;
  };
}

/** Location data for contact items - matches JSON Resume schema */
export interface LocationData {
  address?: string;
  postalCode?: string;
  city?: string;
  region?: string;
  countryCode?: string;
  /** Additional custom fields */
  [key: string]: unknown;
}

/** Contact item for header */
export interface ContactItem {
  text: string;
  url?: string;
  /** Structured location data - renderer builds display text based on options */
  location?: LocationData;
}

/** Header element - name, label, contact info */
export interface HeaderElement extends BaseElement {
  type: 'header';
  name: string;
  label?: string;
  contactItems: ContactItem[];
  /** Full basics data for template access */
  data?: Record<string, unknown>;
}

/** Custom template element - for user-defined LiquidJS templates */
export interface TemplateElement extends BaseElement {
  type: 'template';
  template: string;
  data: Record<string, unknown>;
}

/** Group element - atomic block for page break control (react-pdf style wrap={false}) */
export interface GroupElement extends BaseElement {
  type: 'group';
  /** When false, entire group moves to next page if it doesn't fit (atomic) */
  wrap?: boolean;
  /** Child elements to render together */
  children: LayoutElement[];
}

/** Entry header element - company/position/dates without content (for fine-grained pagination) */
export interface EntryHeaderElement extends BaseElement {
  type: 'entry-header';
  variant: 'work' | 'education';
  /** Full entry data for rendering header portion */
  entry: EntryData;
  /** Whether this is part of a grouped company (multiple positions at same company) */
  isGroupedPosition?: boolean;
  /** Whether to show location (for grouped entries where location varies) */
  showLocation?: boolean;
}

/** Company header element - for grouped entries with multiple positions at same company */
export interface CompanyHeaderElement extends BaseElement {
  type: 'company-header';
  company: string;
  location: string | null;
}

/** Discriminated union of all layout elements */
export type LayoutElement = TextElement | DividerElement | SectionTitleElement | EntryListElement | KeywordListElement | LanguageListElement | CredentialListElement | ReferenceListElement | StructuredContentElement | HeaderElement | TemplateElement | GroupElement | EntryHeaderElement | CompanyHeaderElement;

// ===== Layout Document (complete IR) =====

export interface DocumentMetadata {
  name: string;
  label?: string;
  keywords?: string[];
}

export interface LayoutDocument {
  metadata: DocumentMetadata;
  fieldTemplates: Required<FieldTemplates>;
  elements: LayoutElement[];
}

// ===== Config Type Guards =====

export function isDividerConfig(config: SectionConfig | DividerConfig): config is DividerConfig {
  return 'type' in config && config.type === 'divider';
}

export function isSectionConfig(config: SectionConfig | DividerConfig): config is SectionConfig {
  return 'source' in config;
}
