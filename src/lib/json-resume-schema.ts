import { z } from 'zod/v3';

// ISO8601 date pattern: YYYY, YYYY-MM, or YYYY-MM-DD
const iso8601Date = z.string().regex(/^\d{4}(-\d{2}(-\d{2})?)?$/);

// Location schema
const locationSchema = z.object({
  address: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  countryCode: z.string().optional(),
  region: z.string().optional(),
});

// Profile schema (social networks)
const profileSchema = z.object({
  network: z.string().optional(),
  username: z.string().optional(),
  url: z.string().url().optional(),
});

// Basics schema
const basicsSchema = z.object({
  name: z.string().optional(),
  label: z.string().optional(),
  image: z.string().url().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  url: z.string().url().optional(),
  summary: z.string().optional(),
  location: locationSchema.optional(),
  profiles: z.array(profileSchema).optional(),
});

// Work schema
const workSchema = z.object({
  name: z.string().optional(),
  location: z.string().optional(),
  description: z.string().optional(),
  position: z.string().optional(),
  url: z.string().url().optional(),
  startDate: iso8601Date.optional(),
  endDate: iso8601Date.optional(),
  summary: z.string().optional(),
  highlights: z.array(z.string()).optional(),
});

// Volunteer schema
const volunteerSchema = z.object({
  organization: z.string().optional(),
  position: z.string().optional(),
  url: z.string().url().optional(),
  startDate: iso8601Date.optional(),
  endDate: iso8601Date.optional(),
  summary: z.string().optional(),
  highlights: z.array(z.string()).optional(),
});

// Education schema
const educationSchema = z.object({
  institution: z.string().optional(),
  url: z.string().url().optional(),
  area: z.string().optional(),
  studyType: z.string().optional(),
  startDate: iso8601Date.optional(),
  endDate: iso8601Date.optional(),
  score: z.string().optional(),
  courses: z.array(z.string()).optional(),
});

// Award schema
const awardSchema = z.object({
  title: z.string().optional(),
  date: iso8601Date.optional(),
  awarder: z.string().optional(),
  summary: z.string().optional(),
});

// Certificate schema
const certificateSchema = z.object({
  name: z.string().optional(),
  date: iso8601Date.optional(),
  issuer: z.string().optional(),
  url: z.string().url().optional(),
});

// Publication schema
const publicationSchema = z.object({
  name: z.string().optional(),
  publisher: z.string().optional(),
  releaseDate: iso8601Date.optional(),
  url: z.string().url().optional(),
  summary: z.string().optional(),
});

// Skill schema
const skillSchema = z.object({
  name: z.string().optional(),
  level: z.string().optional(),
  keywords: z.array(z.string()).optional(),
});

// Language schema
const languageSchema = z.object({
  language: z.string().optional(),
  fluency: z.string().optional(),
});

// Interest schema
const interestSchema = z.object({
  name: z.string().optional(),
  keywords: z.array(z.string()).optional(),
});

// Reference schema
const referenceSchema = z.object({
  name: z.string().optional(),
  reference: z.string().optional(),
});

// Project schema
const projectSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  highlights: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  startDate: iso8601Date.optional(),
  endDate: iso8601Date.optional(),
  url: z.string().url().optional(),
  roles: z.array(z.string()).optional(),
  entity: z.string().optional(),
  type: z.string().optional(),
});

// Main JSON Resume schema
export const jsonResumeSchema = z.object({
  basics: basicsSchema.optional(),
  work: z.array(workSchema).optional(),
  volunteer: z.array(volunteerSchema).optional(),
  education: z.array(educationSchema).optional(),
  awards: z.array(awardSchema).optional(),
  certificates: z.array(certificateSchema).optional(),
  publications: z.array(publicationSchema).optional(),
  skills: z.array(skillSchema).optional(),
  languages: z.array(languageSchema).optional(),
  interests: z.array(interestSchema).optional(),
  references: z.array(referenceSchema).optional(),
  projects: z.array(projectSchema).optional(),
});

export type JsonResume = z.infer<typeof jsonResumeSchema>;
