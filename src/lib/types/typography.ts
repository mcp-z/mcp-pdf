/**
 * Typography and styling types for resume PDF generation.
 */

// =============================================================================
// Base Style Types (CSS-like building blocks)
// =============================================================================

export interface FontStyle {
  fontSize: number;
}

export interface SpacingStyle {
  marginTop?: number;
  marginBottom?: number;
}

export interface LetterSpacingStyle {
  letterSpacing?: number;
}

export interface ColorStyle {
  color?: string;
}

export interface LineHeightStyle {
  lineHeight?: number;
}

export interface WidthStyle {
  width: number;
}

export interface IndentStyle {
  indent: number;
}

export interface ThicknessStyle {
  thickness?: number;
}

// =============================================================================
// Element Style Types
// =============================================================================

export type HeaderNameStyle = FontStyle & SpacingStyle & LetterSpacingStyle;
export type HeaderContactStyle = FontStyle & LetterSpacingStyle;
export interface HeaderStyle extends SpacingStyle {
  name: HeaderNameStyle;
  contact: HeaderContactStyle;
}

export type SectionTitleStyle = FontStyle &
  SpacingStyle &
  LetterSpacingStyle & {
    underlineGap?: number;
    underlineThickness?: number;
  };

export type EntryPositionStyle = FontStyle & SpacingStyle;
export type EntryCompanyStyle = FontStyle & ColorStyle;
export type EntryLocationStyle = FontStyle & ColorStyle;
export type EntryDateStyle = WidthStyle;
export interface EntryStyle {
  position: EntryPositionStyle;
  company: EntryCompanyStyle;
  location: EntryLocationStyle;
  date: EntryDateStyle;
}

export type BulletStyle = IndentStyle;

export type QuoteStyle = IndentStyle;

export type DividerStyle = SpacingStyle & ThicknessStyle & ColorStyle;

// =============================================================================
// Content Style (unified settings for all content types)
// =============================================================================

export interface ContentStyle {
  fontSize: number;
  lineHeight: number;
  marginTop: number;
  marginBottom: number;
  paragraphMarginBottom: number;
  bulletGap: number;
  bulletMarginBottom: number;
  bulletIndent: number;
  itemMarginBottom: number;
}

// =============================================================================
// Entry Header Style (for work/education/volunteer entry headers)
// =============================================================================

export interface EntryHeaderStyle {
  lineSpacing: number; // Space between lines within entry header (company→position, institution→degree→GPA)
  marginBottom: number; // Space after complete entry header (before content or next entry)
}

// =============================================================================
// Font Configuration
// =============================================================================

export interface FontConfig {
  regular: string;
  bold: string;
  italic: string;
  boldItalic?: string;
}

// =============================================================================
// Typography Options (main configuration object)
// =============================================================================

export interface TypographyOptions {
  fonts: FontConfig;
  header: HeaderStyle;
  sectionTitle: SectionTitleStyle;
  content: ContentStyle;
  entryHeader: EntryHeaderStyle;
  entry: EntryStyle;
  quote: QuoteStyle;
  divider: DividerStyle;
}

// =============================================================================
// Resolved Style (computed values for rendering)
// =============================================================================

export interface ResolvedTextStyle {
  fontSize: number;
  lineGap: number;
  paragraphMarginBottom: number;
  itemMarginBottom: number;
  blockMarginBottom: number;
}

// =============================================================================
// Default Typography
// =============================================================================

export const DEFAULT_TYPOGRAPHY: TypographyOptions = {
  fonts: {
    regular: 'Helvetica',
    bold: 'Helvetica-Bold',
    italic: 'Helvetica-Oblique',
    boldItalic: 'Helvetica-BoldOblique',
  },
  header: {
    marginBottom: 8,
    name: {
      fontSize: 24,
      marginBottom: 4,
      letterSpacing: 2,
    },
    contact: {
      fontSize: 10,
      letterSpacing: 0,
    },
  },
  sectionTitle: {
    fontSize: 12,
    marginTop: 6,
    marginBottom: 6,
    letterSpacing: 1.5,
    underlineGap: 2,
    underlineThickness: 1,
  },
  content: {
    fontSize: 10,
    lineHeight: 1.3,
    marginTop: 0,
    marginBottom: 6,
    paragraphMarginBottom: 4,
    bulletGap: 2,
    bulletMarginBottom: 2,
    bulletIndent: 12,
    itemMarginBottom: 4,
  },
  entryHeader: {
    lineSpacing: 2,
    marginBottom: 4,
  },
  entry: {
    position: {
      fontSize: 11,
      marginBottom: 2,
    },
    company: {
      fontSize: 10,
      color: '#444444',
    },
    location: {
      fontSize: 10,
      color: '#444444',
    },
    date: {
      width: 130,
    },
  },
  quote: {
    indent: 16,
  },
  divider: {
    marginTop: 6,
    marginBottom: 6,
    thickness: 0.5,
    color: '#cccccc',
  },
};
