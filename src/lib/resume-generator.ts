import PDFDocument from 'pdfkit';
import { registerEmojiFont } from './emoji-renderer.ts';
import { hasEmoji, needsUnicodeFont, setupFonts } from './fonts.ts';
import type { JsonResume } from './json-resume-schema.ts';
import { renderTextWithEmoji } from './pdf-helpers.ts';

export interface ResumeStyling {
  fontSize?: {
    name?: number;
    label?: number;
    heading?: number;
    subheading?: number;
    body?: number;
    contact?: number;
  };
  spacing?: {
    afterName?: number;
    afterLabel?: number;
    afterContact?: number;
    afterHeading?: number;
    afterSubheading?: number;
    afterText?: number;
    betweenSections?: number;
  };
  alignment?: {
    header?: 'left' | 'center' | 'right';
  };
  margins?: {
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
  };
}

export async function generateResumePDFBuffer(resume: JsonResume, font?: string, styling?: ResumeStyling): Promise<Buffer> {
  // Merge styling with defaults
  const margins = {
    top: styling?.margins?.top ?? 50,
    bottom: styling?.margins?.bottom ?? 50,
    left: styling?.margins?.left ?? 50,
    right: styling?.margins?.right ?? 50,
  };

  const fontSize = {
    name: styling?.fontSize?.name ?? 24,
    label: styling?.fontSize?.label ?? 12,
    heading: styling?.fontSize?.heading ?? 18,
    subheading: styling?.fontSize?.subheading ?? 14,
    body: styling?.fontSize?.body ?? 10,
    contact: styling?.fontSize?.contact ?? 10,
  };

  const spacing = {
    afterName: styling?.spacing?.afterName ?? 0.3,
    afterLabel: styling?.spacing?.afterLabel ?? 0.3,
    afterContact: styling?.spacing?.afterContact ?? 0.5,
    afterHeading: styling?.spacing?.afterHeading ?? 0.5,
    afterSubheading: styling?.spacing?.afterSubheading ?? 0.3,
    afterText: styling?.spacing?.afterText ?? 0.3,
    betweenSections: styling?.spacing?.betweenSections ?? 0.5,
  };

  const alignment = {
    header: styling?.alignment?.header ?? 'center',
  };

  const doc = new PDFDocument({
    margins,
    info: {
      Title: resume.basics?.name ? `Resume - ${resume.basics.name}` : 'Resume',
      ...(resume.basics?.name && { Author: resume.basics.name }),
    },
  });

  // Capture PDF in memory
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const pdfPromise = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  // Check if content has Unicode characters or emoji
  const resumeText = JSON.stringify(resume);
  const containsUnicode = needsUnicodeFont(resumeText);
  const containsEmoji = hasEmoji(resumeText);
  const isDefaultFont = !font || font === 'auto';

  // Register emoji font for rendering
  const emojiAvailable = containsEmoji ? registerEmojiFont() : false;

  // Warn about emoji if font not available
  if (containsEmoji && !emojiAvailable) {
    console.warn('⚠️  EMOJI DETECTED but emoji font not available.\n' + '   Run: npm install (to download Noto Color Emoji)\n' + '   Emojis will be skipped in the PDF.');
  } else if (containsEmoji && emojiAvailable) {
    console.log('✅ Emoji support enabled - rendering emojis as inline images');
  }

  // Warn if Unicode detected with default font
  if (containsUnicode && isDefaultFont && !containsEmoji) {
    console.warn("⚠️  Unicode characters detected. If they don't render properly, " + 'provide a Unicode font URL. Find fonts at https://fontsource.org');
  }

  // Setup fonts
  const fonts = await setupFonts(doc, font);
  const { regular: regularFont, bold: boldFont, oblique: obliqueFont } = fonts;

  // Helper functions
  const addHeading = (text: string) => {
    renderTextWithEmoji(doc, text, fontSize.heading, boldFont, emojiAvailable);
    doc.moveDown(spacing.afterHeading);
  };

  const addSubheading = (text: string) => {
    renderTextWithEmoji(doc, text, fontSize.subheading, boldFont, emojiAvailable);
    doc.moveDown(spacing.afterSubheading);
  };

  const addText = (text: string, indent = 0) => {
    renderTextWithEmoji(doc, text, fontSize.body, regularFont, emojiAvailable, { indent });
    doc.moveDown(spacing.afterText);
  };

  const addBullets = (items: string[]) => {
    for (const item of items) {
      renderTextWithEmoji(doc, `• ${item}`, fontSize.body, regularFont, emojiAvailable, { indent: 20 });
    }
    doc.moveDown(spacing.afterText);
  };

  const formatDate = (date?: string) => {
    if (!date) return '';
    // Handle YYYY, YYYY-MM, YYYY-MM-DD formats
    const parts = date.split('-');
    if (parts.length === 1) return parts[0]; // YYYY
    if (parts.length === 2) {
      // YYYY-MM
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthIndex = Number.parseInt(parts[1] ?? '1', 10) - 1;
      return `${months[monthIndex]} ${parts[0]}`;
    }
    // YYYY-MM-DD
    const date2 = new Date(date);
    return date2.toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
    });
  };

  // BASICS SECTION
  if (resume.basics) {
    const { name, label, email, phone, url, location, summary, profiles } = resume.basics;

    if (name) {
      renderTextWithEmoji(doc, name, fontSize.name, boldFont, emojiAvailable, { align: alignment.header });
      doc.moveDown(spacing.afterName);
    }

    if (label) {
      renderTextWithEmoji(doc, label, fontSize.label, regularFont, emojiAvailable, { align: alignment.header });
      doc.moveDown(spacing.afterLabel);
    }

    // Contact info
    const contactInfo = [];
    if (email) contactInfo.push(email);
    if (phone) contactInfo.push(phone);
    if (url) contactInfo.push(url);
    if (location?.city && location?.region) {
      contactInfo.push(`${location.city}, ${location.region}`);
    } else if (location?.city) {
      contactInfo.push(location.city);
    }

    if (contactInfo.length > 0) {
      renderTextWithEmoji(doc, contactInfo.join(' | '), fontSize.contact, regularFont, emojiAvailable, {
        align: alignment.header,
      });
      doc.moveDown(spacing.afterContact);
    }

    // Profiles
    if (profiles && profiles.length > 0) {
      const profileLinks = profiles
        .map((p) => {
          if (p.network && p.username) return `${p.network}: ${p.username}`;
          if (p.url) return p.url;
          return null;
        })
        .filter(Boolean);
      if (profileLinks.length > 0) {
        renderTextWithEmoji(doc, profileLinks.join(' | '), fontSize.contact, regularFont, emojiAvailable, {
          align: alignment.header,
        });
        doc.moveDown(spacing.afterContact);
      }
    }

    doc.moveDown(spacing.betweenSections);

    // Summary
    if (summary) {
      addHeading('Summary');
      addText(summary);
      doc.moveDown(spacing.betweenSections);
    }
  }

  // WORK EXPERIENCE
  if (resume.work && resume.work.length > 0) {
    addHeading('Experience');

    for (const job of resume.work) {
      if (job.position || job.name) {
        const title = [job.position, job.name].filter(Boolean).join(' at ');
        addSubheading(title);
      }

      const details = [];
      if (job.location) details.push(job.location);
      if (job.startDate || job.endDate) {
        const start = formatDate(job.startDate) || 'Present';
        const end = formatDate(job.endDate) || 'Present';
        details.push(`${start} - ${end}`);
      }

      if (details.length > 0) {
        renderTextWithEmoji(doc, details.join(' | '), fontSize.body, obliqueFont, emojiAvailable);
        doc.moveDown(spacing.afterText);
      }

      if (job.summary) {
        addText(job.summary);
      }

      if (job.highlights && job.highlights.length > 0) {
        addBullets(job.highlights);
      }

      doc.moveDown(spacing.betweenSections);
    }
  }

  // EDUCATION
  if (resume.education && resume.education.length > 0) {
    addHeading('Education');

    for (const edu of resume.education) {
      const degree = [edu.studyType, edu.area].filter(Boolean).join(' in ');
      if (degree) {
        addSubheading(degree);
      }

      const details = [];
      if (edu.institution) details.push(edu.institution);
      if (edu.startDate || edu.endDate) {
        const start = formatDate(edu.startDate) || '';
        const end = formatDate(edu.endDate) || 'Present';
        details.push(`${start} - ${end}`);
      }
      if (edu.score) details.push(`GPA: ${edu.score}`);

      if (details.length > 0) {
        renderTextWithEmoji(doc, details.join(' | '), fontSize.body, regularFont, emojiAvailable);
        doc.moveDown(spacing.afterText);
      }

      if (edu.courses && edu.courses.length > 0) {
        renderTextWithEmoji(doc, `Courses: ${edu.courses.join(', ')}`, fontSize.body, regularFont, emojiAvailable);
        doc.moveDown(spacing.afterText);
      }

      doc.moveDown(spacing.betweenSections);
    }
  }

  // PROJECTS
  if (resume.projects && resume.projects.length > 0) {
    addHeading('Projects');

    for (const project of resume.projects) {
      if (project.name) {
        addSubheading(project.name);
      }

      if (project.description) {
        addText(project.description);
      }

      if (project.highlights && project.highlights.length > 0) {
        addBullets(project.highlights);
      }

      const details = [];
      if (project.url) details.push(project.url);
      if (project.keywords && project.keywords.length > 0) {
        details.push(`Tech: ${project.keywords.join(', ')}`);
      }

      if (details.length > 0) {
        renderTextWithEmoji(doc, details.join(' | '), fontSize.body, obliqueFont, emojiAvailable);
        doc.moveDown(spacing.afterText);
      }

      doc.moveDown(spacing.betweenSections);
    }
  }

  // SKILLS
  if (resume.skills && resume.skills.length > 0) {
    addHeading('Skills');

    for (const skill of resume.skills) {
      if (skill.name) {
        const skillText = skill.keywords ? `${skill.name}: ${skill.keywords.join(', ')}` : skill.name;
        addText(skillText);
      }
    }

    doc.moveDown(spacing.betweenSections);
  }

  // AWARDS
  if (resume.awards && resume.awards.length > 0) {
    addHeading('Awards');

    for (const award of resume.awards) {
      if (award.title) {
        addSubheading(award.title);
      }

      const details = [];
      if (award.awarder) details.push(award.awarder);
      if (award.date) details.push(formatDate(award.date));

      if (details.length > 0) {
        renderTextWithEmoji(doc, details.join(' | '), fontSize.body, regularFont, emojiAvailable);
        doc.moveDown(spacing.afterText);
      }

      if (award.summary) {
        addText(award.summary);
      }

      doc.moveDown(spacing.betweenSections);
    }
  }

  // CERTIFICATES
  if (resume.certificates && resume.certificates.length > 0) {
    addHeading('Certificates');

    for (const cert of resume.certificates) {
      if (cert.name) {
        addSubheading(cert.name);
      }

      const details = [];
      if (cert.issuer) details.push(cert.issuer);
      if (cert.date) details.push(formatDate(cert.date));
      if (cert.url) details.push(cert.url);

      if (details.length > 0) {
        renderTextWithEmoji(doc, details.join(' | '), fontSize.body, regularFont, emojiAvailable);
        doc.moveDown(spacing.afterText);
      }

      doc.moveDown(spacing.betweenSections);
    }
  }

  // LANGUAGES
  if (resume.languages && resume.languages.length > 0) {
    addHeading('Languages');

    const langText = resume.languages
      .map((lang) => {
        if (lang.language && lang.fluency) {
          return `${lang.language} (${lang.fluency})`;
        }
        return lang.language || '';
      })
      .filter(Boolean)
      .join(', ');

    if (langText) {
      addText(langText);
    }

    doc.moveDown(spacing.betweenSections);
  }

  // Finalize
  doc.end();

  // Return the PDF buffer
  return await pdfPromise;
}
