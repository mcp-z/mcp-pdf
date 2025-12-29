/**
 * Transform phase: Resume JSON + SectionsConfig → LayoutDocument (IR)
 *
 * This is the first phase of the resume PDF pipeline. It transforms
 * the resume JSON data into an intermediate representation (IR) that
 * can be rendered by type-specific handlers.
 */

import type { ResumeSchema } from '../../../assets/resume.js';
import { mergeFieldTemplates, registerFieldFilters } from '../formatting.js';
import type {
  CompanyHeaderElement,
  ContactItem,
  CredentialData,
  CredentialListElement,
  DividerConfig,
  DividerElement,
  DocumentMetadata,
  EntryContentLineElement,
  EntryData,
  EntryHeaderElement,
  EntryListElement,
  FieldTemplates,
  GroupElement,
  HeaderElement,
  KeywordListElement,
  LanguageListElement,
  LayoutDocument,
  LayoutElement,
  LocationData,
  ReferenceListElement,
  SectionConfig,
  SectionsConfig,
  SectionTitleElement,
  SummaryHighlightsElement,
  TemplateElement,
  TextElement,
} from './types.js';
import { isDividerConfig, isSectionConfig } from './types.js';

// =============================================================================
// Typography Spacing Constants (should match measure.ts/render.ts)
// =============================================================================

const SPACING = {
  paragraphMargin: 4,
  bulletMargin: 2,
  blockMargin: 6,
  summaryToBulletGap: 6, // Extra space when transitioning from summary to bullets
};

/**
 * Inferred data types for automatic rendering
 */
type InferredType = 'text' | 'summary-highlights' | 'entry-list' | 'keyword-list' | 'language-list' | 'credential-list' | 'reference-list' | 'unknown';

/**
 * Get a nested value from an object using dot notation
 */
export function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Infer the data type from its shape
 */
function inferDataType(data: unknown): InferredType {
  if (data === null || data === undefined) return 'unknown';

  // Plain string → text
  if (typeof data === 'string') return 'text';

  // String array → text
  if (Array.isArray(data) && data.every((item) => typeof item === 'string')) {
    return 'text';
  }

  // Non-string arrays
  if (Array.isArray(data)) {
    if (data.length === 0) return 'unknown';
    const first = data[0];
    if (typeof first !== 'object' || first === null) return 'unknown';

    // Entry list: work, education, volunteer, projects
    if ('position' in first || 'institution' in first || 'organization' in first || ('name' in first && ('startDate' in first || 'endDate' in first || 'entity' in first || 'description' in first))) {
      return 'entry-list';
    }

    // Keyword list: has keywords array (skills, interests)
    if ('keywords' in first && Array.isArray((first as Record<string, unknown>).keywords)) {
      return 'keyword-list';
    }

    // Language list
    if ('language' in first) {
      return 'language-list';
    }

    // Reference list
    if ('reference' in first) {
      return 'reference-list';
    }

    // Credential list: awards, certificates, publications
    if (('title' in first && 'awarder' in first) || ('name' in first && 'issuer' in first) || ('name' in first && 'publisher' in first) || ('name' in first && 'releaseDate' in first)) {
      return 'credential-list';
    }

    return 'unknown';
  }

  // Object types
  if (typeof data === 'object') {
    const obj = data as Record<string, unknown>;

    // Summary-highlights: has highlights array
    if ('highlights' in obj && Array.isArray(obj.highlights)) {
      return 'summary-highlights';
    }

    // Text: has summary
    if ('summary' in obj && (typeof obj.summary === 'string' || Array.isArray(obj.summary))) {
      return 'text';
    }
  }

  return 'unknown';
}

/**
 * Determine entry variant from source path
 */
function inferEntryVariant(source: string): 'work' | 'education' {
  if (source === 'education') return 'education';
  return 'work'; // Default for work, volunteer, projects, etc.
}

/**
 * Convert content to array of paragraphs.
 */
function paragraphsFromContent(content: string | string[] | undefined): string[] {
  if (!content) return [];
  if (Array.isArray(content)) return content.filter(Boolean);
  return content
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * Ensure a value is a string.
 */
function ensureString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  return String(value);
}

/**
 * Group entries by company name (for work entries).
 */
function groupByCompany(entries: EntryData[]): EntryData[][] {
  const groups: EntryData[][] = [];
  let currentGroup: EntryData[] = [];
  let currentCompany = '';

  for (const entry of entries) {
    const rec = entry as Record<string, unknown>;
    const company = ensureString(rec.name ?? rec.organization ?? rec.entity)
      .trim()
      .toLowerCase();

    if (company === currentCompany && currentGroup.length > 0) {
      currentGroup.push(entry);
    } else {
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
      }
      currentGroup = [entry];
      currentCompany = company;
    }
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}

/**
 * Create content line elements from an entry's summary and highlights.
 * Returns array of EntryContentLineElement with proper spacing metadata.
 */
function createContentLines(entry: EntryData): EntryContentLineElement[] {
  const entryData = entry as Record<string, unknown>;
  const summaryText = entryData.summary ?? entryData.description;
  const summaryParagraphs = paragraphsFromContent(summaryText as string | string[] | undefined);
  const highlights = Array.isArray(entryData.highlights) ? (entryData.highlights as string[]).map(ensureString).filter(Boolean) : [];

  const contentLines: EntryContentLineElement[] = [];
  const totalItems = summaryParagraphs.length + highlights.length;

  // Add summary paragraphs
  for (let i = 0; i < summaryParagraphs.length; i++) {
    const isFirst = contentLines.length === 0;
    const isLast = contentLines.length === totalItems - 1;

    contentLines.push({
      type: 'entry-content-line',
      contentType: 'summary',
      text: summaryParagraphs[i],
      position: totalItems === 1 ? 'only' : isFirst ? 'first' : isLast ? 'last' : 'middle',
      afterTypeChange: false,
      marginTop: isFirst ? 0 : SPACING.paragraphMargin,
    });
  }

  // Add bullet highlights
  for (let i = 0; i < highlights.length; i++) {
    const isFirst = contentLines.length === 0;
    const isLast = contentLines.length === totalItems - 1;
    const afterTypeChange = i === 0 && summaryParagraphs.length > 0;

    contentLines.push({
      type: 'entry-content-line',
      contentType: 'bullet',
      text: highlights[i],
      position: totalItems === 1 ? 'only' : isFirst ? 'first' : isLast ? 'last' : 'middle',
      afterTypeChange,
      marginTop: isFirst ? 0 : afterTypeChange ? SPACING.summaryToBulletGap : SPACING.bulletMargin,
    });
  }

  return contentLines;
}

/**
 * Decompose a single entry into header + content line elements.
 * Returns elements that should be added to the layout.
 *
 * @param entry - The entry data
 * @param variant - 'work' or 'education'
 * @param isFirstEntry - Whether this is the first entry (for grouping with section title)
 * @param sectionTitleElement - Optional section title to group with first entry
 * @param isGroupedPosition - Whether this entry is part of a grouped company
 * @param showLocation - Whether to show location on this entry
 */
function decomposeEntry(entry: EntryData, variant: 'work' | 'education', isFirstEntry: boolean, sectionTitleElement: SectionTitleElement | null, isGroupedPosition = false, showLocation = true): LayoutElement[] {
  const elements: LayoutElement[] = [];
  const contentLines = createContentLines(entry);

  // Create entry header element
  const headerElement: EntryHeaderElement = {
    type: 'entry-header',
    variant,
    entry,
    isGroupedPosition,
    showLocation,
  };

  // Determine what goes in the atomic group
  const atomicChildren: LayoutElement[] = [];

  // First entry gets section title in the atomic group
  if (isFirstEntry && sectionTitleElement) {
    atomicChildren.push(sectionTitleElement);
  }

  // Header always goes in atomic group
  atomicChildren.push(headerElement);

  // First content line (if any) goes in atomic group to prevent orphaned header
  const firstLine = contentLines.shift();
  if (firstLine) {
    atomicChildren.push(firstLine);
  }

  // Create the atomic group
  const atomicGroup: GroupElement = {
    type: 'group',
    wrap: false,
    children: atomicChildren,
  };
  elements.push(atomicGroup);

  // Remaining content lines are separate elements for fine-grained pagination
  for (const line of contentLines) {
    elements.push(line);
  }

  return elements;
}

/**
 * Decompose grouped entries (multiple positions at same company).
 */
function decomposeGroupedEntries(entries: EntryData[], variant: 'work' | 'education', isFirstGroup: boolean, sectionTitleElement: SectionTitleElement | null): LayoutElement[] {
  const elements: LayoutElement[] = [];

  // Get company info from first entry
  const firstEntry = entries[0] as Record<string, unknown>;
  const company = ensureString(firstEntry.name ?? firstEntry.organization ?? firstEntry.entity);

  // Check if all entries have the same location
  const locations = entries.map((e) => ensureString((e as Record<string, unknown>).location)).filter(Boolean);
  const uniqueLocations = [...new Set(locations)];
  const sameLocation = uniqueLocations.length <= 1;
  const sharedLocation = sameLocation && uniqueLocations.length === 1 ? (uniqueLocations[0] ?? null) : null;

  // Create company header element
  const companyHeader: CompanyHeaderElement = {
    type: 'company-header',
    company,
    location: sharedLocation,
  };

  // For the first group, section title + company header + first position header + first content
  // For subsequent groups, company header + first position header + first content
  const firstPositionElements = decomposeEntry(entries[0], variant, false, null, true, !sameLocation);

  // Build atomic group for company header + first position
  const atomicChildren: LayoutElement[] = [];
  if (isFirstGroup && sectionTitleElement) {
    atomicChildren.push(sectionTitleElement);
  }
  atomicChildren.push(companyHeader);

  // Add the first position's atomic group children (unwrap it)
  const firstPositionAtomic = firstPositionElements.shift() as GroupElement;
  atomicChildren.push(...firstPositionAtomic.children);

  const atomicGroup: GroupElement = {
    type: 'group',
    wrap: false,
    children: atomicChildren,
  };
  elements.push(atomicGroup);

  // Add remaining content lines from first position
  elements.push(...firstPositionElements);

  // Add remaining positions
  for (let i = 1; i < entries.length; i++) {
    const positionElements = decomposeEntry(entries[i], variant, false, null, true, !sameLocation);
    elements.push(...positionElements);
  }

  return elements;
}

/**
 * Transform entry-list into fine-grained elements for better pagination.
 */
function transformEntryListFineGrained(entryList: EntryListElement, sectionTitleElement: SectionTitleElement | null, source: string): LayoutElement[] {
  const elements: LayoutElement[] = [];
  const { entries, variant } = entryList;

  if (entries.length === 0) {
    if (sectionTitleElement) {
      elements.push(sectionTitleElement);
    }
    return elements;
  }

  if (variant === 'education') {
    // Education entries are not grouped by company
    for (let i = 0; i < entries.length; i++) {
      const entryElements = decomposeEntry(entries[i], variant, i === 0, i === 0 ? sectionTitleElement : null);
      elements.push(...entryElements);
    }
  } else {
    // Work entries - group by company
    const groups = groupByCompany(entries);

    for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
      const group = groups[groupIndex];
      const isFirstGroup = groupIndex === 0;

      if (group.length === 1) {
        // Single entry - no company grouping needed
        const entryElements = decomposeEntry(group[0], variant, isFirstGroup, isFirstGroup ? sectionTitleElement : null);
        elements.push(...entryElements);
      } else {
        // Multiple entries at same company
        const groupElements = decomposeGroupedEntries(group, variant, isFirstGroup, isFirstGroup ? sectionTitleElement : null);
        elements.push(...groupElements);
      }
    }
  }

  // Tag all elements with source
  for (const el of elements) {
    el.source = source;
    if (el.type === 'group' && 'children' in el) {
      for (const child of (el as GroupElement).children) {
        child.source = source;
      }
    }
  }

  return elements;
}

/**
 * Transform header section
 */
function transformHeader(resume: ResumeSchema): HeaderElement {
  const basics = resume.basics || {};

  // Build contact items
  const contactItems: ContactItem[] = [];

  if (basics.phone) {
    contactItems.push({ text: basics.phone });
  }
  if (basics.email) {
    contactItems.push({ text: basics.email });
  }

  // Location - preserve full object for template access
  if (basics.location) {
    contactItems.push({
      text: '', // Placeholder - renderer builds display text
      location: basics.location as LocationData,
    });
  }

  if (basics.url) {
    contactItems.push({ text: basics.url, url: basics.url });
  }

  // Profiles
  if (basics.profiles && Array.isArray(basics.profiles)) {
    for (const profile of basics.profiles) {
      if (profile.network) {
        contactItems.push({ text: profile.network, url: profile.url });
      }
    }
  }

  return {
    type: 'header',
    name: basics.name || '',
    label: basics.label,
    contactItems,
    // Full basics data for template access
    data: basics as Record<string, unknown>,
  };
}

/**
 * Transform data to an IR element based on inferred type
 */
function transformData(data: unknown, source: string, config: SectionConfig): LayoutElement | null {
  const dataType = inferDataType(data);

  switch (dataType) {
    case 'text': {
      let content: string | string[];
      if (typeof data === 'string') {
        content = data;
      } else if (Array.isArray(data)) {
        content = data as string[];
      } else {
        const obj = data as { summary?: string | string[] };
        content = obj.summary || '';
      }
      return {
        type: 'text',
        content,
        style: config.style,
      } as TextElement;
    }

    case 'summary-highlights': {
      const obj = data as { summary?: string | string[]; highlights?: string[] };
      return {
        type: 'summary-highlights',
        summary: typeof obj.summary === 'string' ? obj.summary : obj.summary?.join('\n'),
        highlights: obj.highlights || [],
        style: config.style,
      } as SummaryHighlightsElement;
    }

    case 'entry-list': {
      return {
        type: 'entry-list',
        variant: inferEntryVariant(source),
        entries: data as EntryData[],
        style: config.style,
      } as EntryListElement;
    }

    case 'keyword-list': {
      return {
        type: 'keyword-list',
        items: data as Array<{ name?: string; level?: string; keywords?: string[] }>,
        style: config.style,
      } as KeywordListElement;
    }

    case 'language-list': {
      return {
        type: 'language-list',
        items: data as Array<{ language?: string; fluency?: string }>,
        style: config.style,
      } as LanguageListElement;
    }

    case 'credential-list': {
      return {
        type: 'credential-list',
        items: data as CredentialData[],
        style: config.style,
      } as CredentialListElement;
    }

    case 'reference-list': {
      return {
        type: 'reference-list',
        items: data as Array<{ name?: string; reference?: string }>,
        style: config.style,
      } as ReferenceListElement;
    }

    default:
      return null;
  }
}

/**
 * Transform a section config into IR elements.
 *
 * For sections with titles and entry-list content, creates an atomic group
 * containing the section title + first entry. This implements react-pdf style
 * wrap={false} behavior to prevent orphaned section titles.
 */
function transformSection(resume: ResumeSchema, config: SectionConfig): LayoutElement[] {
  const elements: LayoutElement[] = [];
  const { source, render, title, template, style } = config;

  // Helper to tag all elements with their source
  const tagElements = () => {
    for (const el of elements) {
      el.source = source;
      // Also tag children in groups
      if (el.type === 'group' && 'children' in el) {
        for (const child of (el as GroupElement).children) {
          child.source = source;
        }
      }
    }
    return elements;
  };

  // Get data from source path
  const data = getNestedValue(resume as unknown as Record<string, unknown>, source);

  // Handle explicit header render type (for basics → name/contact rendering)
  if (render === 'header') {
    if (template) {
      // Use custom template for header
      elements.push({
        type: 'template',
        template,
        data: (typeof data === 'object' ? data : { value: data }) as Record<string, unknown>,
        style,
      } as TemplateElement);
    } else {
      // Pass resume for backwards compatibility with transformHeader
      elements.push(transformHeader(resume));
    }
    return tagElements();
  }

  // Skip empty data
  if (data === undefined || data === null) return elements;
  if (Array.isArray(data) && data.length === 0) return elements;

  // Transform content first to determine grouping strategy
  let contentElement: LayoutElement | null = null;
  if (template) {
    // Use custom template
    contentElement = {
      type: 'template',
      template,
      data: (typeof data === 'object' ? data : { value: data }) as Record<string, unknown>,
      style,
    } as TemplateElement;
  } else {
    // Use inferred type
    contentElement = transformData(data, source, config);
  }

  // Create section title element if specified
  const sectionTitleElement: SectionTitleElement | null = title
    ? {
        type: 'section-title',
        title,
        style,
      }
    : null;

  // Create atomic groups to prevent orphaned section titles (react-pdf style wrap={false})
  // Section title stays with at least one item/sentence from its content
  if (sectionTitleElement && contentElement) {
    const type = contentElement.type;

    if (type === 'entry-list') {
      // Entry list: use fine-grained decomposition for optimal pagination
      const entryList = contentElement as EntryListElement;
      const fineGrainedElements = transformEntryListFineGrained(entryList, sectionTitleElement, source);
      elements.push(...fineGrainedElements);
      return tagElements(); // Early return since elements are already tagged
    }
    if (type === 'keyword-list') {
      // Keyword list (skills, interests): group title with first category, then each remaining as separate node
      const keywordList = contentElement as KeywordListElement;
      const items = keywordList.items;

      if (items.length > 0) {
        const firstKeywordList: KeywordListElement = {
          ...keywordList,
          items: items.slice(0, 1),
        };

        const atomicGroup: GroupElement = {
          type: 'group',
          wrap: false,
          children: [sectionTitleElement, firstKeywordList],
        };
        elements.push(atomicGroup);

        // Each remaining keyword category as a separate node for better pagination
        for (let i = 1; i < items.length; i++) {
          const singleKeywordList: KeywordListElement = {
            ...keywordList,
            items: [items[i]],
          };
          elements.push(singleKeywordList);
        }
      } else {
        elements.push(sectionTitleElement);
      }
    } else if (type === 'language-list') {
      // Language list: group title with ALL languages (they render as a single comma-separated line)
      const languageList = contentElement as LanguageListElement;

      if (languageList.items.length > 0) {
        const atomicGroup: GroupElement = {
          type: 'group',
          wrap: false,
          children: [sectionTitleElement, languageList],
        };
        elements.push(atomicGroup);
      } else {
        elements.push(sectionTitleElement);
      }
    } else if (type === 'credential-list') {
      // Credential list (awards, certificates, publications): group title with first item, then each remaining as separate node
      const credentialList = contentElement as CredentialListElement;
      const items = credentialList.items;

      if (items.length > 0) {
        const firstCredentialList: CredentialListElement = {
          ...credentialList,
          items: items.slice(0, 1),
        };

        const atomicGroup: GroupElement = {
          type: 'group',
          wrap: false,
          children: [sectionTitleElement, firstCredentialList],
        };
        elements.push(atomicGroup);

        // Each remaining credential as a separate node for better pagination
        for (let i = 1; i < items.length; i++) {
          const singleCredentialList: CredentialListElement = {
            ...credentialList,
            items: [items[i]],
          };
          elements.push(singleCredentialList);
        }
      } else {
        elements.push(sectionTitleElement);
      }
    } else if (type === 'reference-list') {
      // Reference list: group title with first reference, then each remaining as separate node
      const referenceList = contentElement as ReferenceListElement;
      const items = referenceList.items;

      if (items.length > 0) {
        const firstReferenceList: ReferenceListElement = {
          ...referenceList,
          items: items.slice(0, 1),
        };

        const atomicGroup: GroupElement = {
          type: 'group',
          wrap: false,
          children: [sectionTitleElement, firstReferenceList],
        };
        elements.push(atomicGroup);

        // Each remaining reference as a separate node for better pagination
        for (let i = 1; i < items.length; i++) {
          const singleReferenceList: ReferenceListElement = {
            ...referenceList,
            items: [items[i]],
          };
          elements.push(singleReferenceList);
        }
      } else {
        elements.push(sectionTitleElement);
      }
    } else {
      // Other types (text, summary-highlights, template): group entire content with title
      const atomicGroup: GroupElement = {
        type: 'group',
        wrap: false,
        children: [sectionTitleElement, contentElement],
      };
      elements.push(atomicGroup);
    }
  } else {
    // No title or no content - add elements normally
    if (sectionTitleElement) {
      elements.push(sectionTitleElement);
    }
    if (contentElement) {
      elements.push(contentElement);
    }
  }

  return tagElements();
}

/**
 * Transform a divider config into an IR element
 */
function transformDivider(config: DividerConfig): DividerElement {
  return {
    type: 'divider',
    thickness: config.thickness,
    color: config.color,
    margin: config.margin,
  };
}

/**
 * Extract document metadata from resume
 */
function extractMetadata(resume: ResumeSchema): DocumentMetadata {
  const name = resume.basics?.name || 'Resume';
  const label = resume.basics?.label;

  // Extract keywords from skills
  const keywords: string[] = [];
  if (resume.skills) {
    for (const skill of resume.skills) {
      if (skill.name) keywords.push(skill.name);
    }
  }

  return { name, label, keywords: keywords.length > 0 ? keywords : undefined };
}

/**
 * Main transform function: Resume + SectionsConfig → LayoutDocument
 */
export function transformToLayout(resume: ResumeSchema, config: SectionsConfig): LayoutDocument {
  const fieldTemplates: Required<FieldTemplates> = mergeFieldTemplates(config.fieldTemplates);

  // Register LiquidJS filters for field templates
  registerFieldFilters();

  const elements: LayoutElement[] = [];

  for (const sectionConfig of config.sections) {
    if (isDividerConfig(sectionConfig)) {
      elements.push(transformDivider(sectionConfig));
    } else if (isSectionConfig(sectionConfig)) {
      const sectionElements = transformSection(resume, sectionConfig);
      elements.push(...sectionElements);
    }
  }

  return {
    metadata: extractMetadata(resume),
    fieldTemplates,
    elements,
  };
}

/**
 * Default sections config matching the original section order
 */
export const DEFAULT_SECTIONS: SectionsConfig = {
  sections: [
    { source: 'basics', render: 'header' },
    { source: 'basics.summary', title: 'Summary' },
    { source: 'work', title: 'Experience' },
    { source: 'volunteer', title: 'Volunteer Experience' },
    { source: 'education', title: 'Education' },
    { source: 'awards', title: 'Awards' },
    { source: 'certificates', title: 'Certifications' },
    { source: 'publications', title: 'Publications' },
    { source: 'skills', title: 'Skills' },
    { source: 'languages', title: 'Languages' },
    { source: 'interests', title: 'Interests' },
    { source: 'projects', title: 'Projects' },
    { source: 'references', title: 'References' },
  ],
};
