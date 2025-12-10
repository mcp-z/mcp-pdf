/**
 * Typography and styling types for resume PDF generation.
 * Adapted from pdf-resume reference with emoji support integration.
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

export type TextStyle = FontStyle &
  SpacingStyle &
  LineHeightStyle & {
    blockMarginBottom?: number;
  };

export type BulletStyle = IndentStyle & SpacingStyle;

export type QuoteStyle = IndentStyle;

export type DividerStyle = SpacingStyle & ThicknessStyle & ColorStyle;

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
  entry: EntryStyle;
  text: TextStyle;
  bullet: BulletStyle;
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
    marginBottom: 12,
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
    fontSize: 11,
    marginTop: 12,
    marginBottom: 8,
    letterSpacing: 1,
    underlineGap: 2,
    underlineThickness: 0.5,
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
  text: {
    fontSize: 10,
    lineHeight: 1.3,
    marginBottom: 4,
    blockMarginBottom: 6,
  },
  bullet: {
    indent: 12,
    marginBottom: 2,
  },
  quote: {
    indent: 16,
  },
  divider: {
    marginTop: 8,
    marginBottom: 8,
    thickness: 0.5,
    color: '#cccccc',
  },
};
