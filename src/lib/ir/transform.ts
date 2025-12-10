/**
 * Transform phase: Resume JSON + SectionsConfig → LayoutDocument (IR)
 *
 * This is the first phase of the resume PDF pipeline. It transforms
 * the resume JSON data into an intermediate representation (IR) that
 * can be rendered by type-specific handlers.
 */

import type { ResumeSchema } from '../../../assets/resume.d.ts';
import { mergeFieldTemplates, registerFieldFilters } from '../formatting.ts';
import type {
  ContactItem,
  CredentialData,
  CredentialListElement,
  DividerConfig,
  DividerElement,
  DocumentMetadata,
  EntryData,
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
} from './types.ts';
import { isDividerConfig, isSectionConfig } from './types.ts';

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
  const { source, title, template, style } = config;

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

  // Special case: header
  if (source === 'header') {
    if (template) {
      // Use custom template for header
      const headerData = {
        ...resume.basics,
        profiles: resume.basics?.profiles,
      };
      elements.push({
        type: 'template',
        template,
        data: headerData as Record<string, unknown>,
        style,
      } as TemplateElement);
    } else {
      elements.push(transformHeader(resume));
    }
    return tagElements();
  }

  // Get data from source path
  const data = getNestedValue(resume as unknown as Record<string, unknown>, source);

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

  // If we have both a section title and an entry-list, create atomic groups
  // to prevent orphaned section titles (react-pdf style wrap={false})
  if (sectionTitleElement && contentElement && contentElement.type === 'entry-list') {
    const entryList = contentElement as EntryListElement;
    const entries = entryList.entries;

    if (entries.length > 0) {
      // Create entry-list with just the first entry for the atomic group
      const firstEntryList: EntryListElement = {
        ...entryList,
        entries: [entries[0] as EntryData],
      };

      // Create atomic group: section-title + first entry stay together
      const atomicGroup: GroupElement = {
        type: 'group',
        wrap: false,
        children: [sectionTitleElement, firstEntryList],
      };
      elements.push(atomicGroup);

      // Add remaining entries as separate entry-list (flow normally)
      if (entries.length > 1) {
        const remainingEntryList: EntryListElement = {
          ...entryList,
          entries: entries.slice(1) as EntryData[],
        };
        elements.push(remainingEntryList);
      }
    } else {
      // Empty entry list - just add title (shouldn't happen with earlier empty check)
      elements.push(sectionTitleElement);
    }
  } else {
    // No entry-list or no title - add elements normally
    // (Other content types handle their own page breaks)
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
    { source: 'header' },
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

/** @deprecated Use DEFAULT_SECTIONS instead */
export const DEFAULT_LAYOUT = DEFAULT_SECTIONS;
