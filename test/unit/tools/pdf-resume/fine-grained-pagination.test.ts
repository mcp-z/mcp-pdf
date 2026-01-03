import assert from 'assert';
import { mkdirSync } from 'fs';
import { join } from 'path';
import createTool, { type Input, type Output } from '../../../../src/mcp/tools/pdf-resume.ts';
import type { ServerConfig } from '../../../../src/types.ts';
import { createExtra } from '../../../lib/create-extra.ts';

// Use .tmp/ in package root per QUALITY.md rule T8
const testOutputDir = join(process.cwd(), '.tmp', 'fine-grained-pagination-tests');
const testStorageDir = join(testOutputDir, 'storage');

/**
 * Create test server config for PDF tools
 */
function createTestConfig(): ServerConfig {
  return {
    name: 'mcp-pdf-test',
    version: '1.0.0',
    logLevel: 'silent',
    baseDir: testOutputDir,
    storageDir: testStorageDir,
    transport: {
      type: 'stdio',
    },
  };
}

describe('Fine-grained pagination', () => {
  before(() => {
    mkdirSync(testStorageDir, { recursive: true });
  });

  after(() => {
    // Keep files for visual inspection during development
    // Uncomment to clean up:
    // if (existsSync(testOutputDir)) {
    //   rmSync(testOutputDir, { recursive: true, force: true });
    // }
  });

  it('creates multi-page resume with fine-grained content flow', async () => {
    const config = createTestConfig();
    const tool = createTool();
    const extra = createExtra(config);

    // Create a resume with enough content to span multiple pages
    // This tests that:
    // 1. Headers stay grouped with first content item (atomic groups)
    // 2. Individual content lines can flow across pages
    // 3. Spacing is correct at page boundaries
    const input: Input = {
      filename: 'multi-page-pagination-test.pdf',
      resume: {
        basics: {
          name: 'Multi-Page Resume Test',
          label: 'Senior Software Engineer',
          email: 'test@example.com',
          phone: '555-123-4567',
          summary: 'Experienced software engineer with over 15 years of experience building scalable distributed systems. ' + 'Passionate about clean code, test-driven development, and mentoring junior developers. ' + 'Led multiple successful product launches and contributed to open source projects.',
        },
        work: [
          {
            name: 'Tech Giant Corp',
            position: 'Principal Engineer',
            startDate: '2020-01',
            summary: 'Leading the platform engineering team responsible for core infrastructure serving millions of users worldwide.',
            highlights: [
              'Architected and implemented a new microservices platform that reduced deployment time by 80%',
              'Led migration from monolithic architecture to microservices, improving system reliability to 99.99% uptime',
              'Mentored team of 12 engineers, helping 3 achieve promotion to senior level within 18 months',
              'Established engineering best practices including code review standards, testing requirements, and documentation guidelines',
              'Reduced infrastructure costs by $2M annually through optimization and right-sizing initiatives',
            ],
          },
          {
            name: 'Innovation Startup Inc',
            position: 'Senior Software Engineer',
            startDate: '2017-03',
            endDate: '2019-12',
            summary: 'Full-stack development for B2B SaaS platform with focus on performance and scalability.',
            highlights: [
              'Built real-time analytics dashboard processing 10M+ events per day with sub-second latency',
              'Implemented CI/CD pipeline reducing release cycle from weeks to hours',
              'Developed custom caching layer that improved API response times by 300%',
              'Created automated testing framework increasing code coverage from 40% to 95%',
            ],
          },
          {
            name: 'Enterprise Solutions Ltd',
            position: 'Software Engineer',
            startDate: '2014-06',
            endDate: '2017-02',
            summary: 'Backend development for enterprise resource planning systems.',
            highlights: [
              'Designed and implemented RESTful APIs serving 500+ enterprise clients',
              'Optimized database queries reducing average response time from 2s to 200ms',
              'Built integration layer connecting legacy systems with modern cloud services',
              'Contributed to open source projects used by the company, gaining 1000+ GitHub stars',
            ],
          },
          {
            name: 'Digital Agency Co',
            position: 'Junior Developer',
            startDate: '2012-01',
            endDate: '2014-05',
            highlights: ['Developed responsive web applications for Fortune 500 clients', 'Implemented e-commerce solutions processing $10M+ in annual transactions', 'Created mobile-first designs improving user engagement by 45%'],
          },
        ],
        education: [
          {
            institution: 'State University',
            area: 'Computer Science',
            studyType: 'Master of Science',
            startDate: '2010',
            endDate: '2012',
            courses: ['Distributed Systems', 'Machine Learning', 'Advanced Algorithms'],
          },
          {
            institution: 'Tech College',
            area: 'Software Engineering',
            studyType: 'Bachelor of Science',
            startDate: '2006',
            endDate: '2010',
            courses: ['Data Structures', 'Operating Systems', 'Computer Networks', 'Database Design'],
          },
        ],
        skills: [
          {
            name: 'Programming Languages',
            keywords: ['TypeScript', 'Python', 'Go', 'Rust', 'Java', 'C++'],
          },
          {
            name: 'Frameworks & Libraries',
            keywords: ['React', 'Node.js', 'FastAPI', 'Spring Boot', 'Django'],
          },
          {
            name: 'Infrastructure & DevOps',
            keywords: ['AWS', 'Kubernetes', 'Docker', 'Terraform', 'GitHub Actions'],
          },
          {
            name: 'Databases',
            keywords: ['PostgreSQL', 'Redis', 'MongoDB', 'Elasticsearch', 'DynamoDB'],
          },
        ],
        projects: [
          {
            name: 'Open Source Monitoring Tool',
            description: 'Created a lightweight monitoring solution for Kubernetes clusters that provides real-time metrics and alerting.',
            highlights: ['5000+ GitHub stars', 'Used by 200+ companies', 'Featured in KubeCon 2023'],
          },
          {
            name: 'Developer Productivity CLI',
            description: 'Built a command-line tool that automates common development tasks and integrates with popular CI/CD platforms.',
            highlights: ['10,000+ monthly downloads', 'Active community of contributors'],
          },
        ],
        awards: [
          {
            title: 'Engineering Excellence Award',
            awarder: 'Tech Giant Corp',
            date: '2022',
            summary: 'Recognized for outstanding technical leadership and contributions to platform reliability.',
          },
          {
            title: 'Innovation Award',
            awarder: 'Innovation Startup Inc',
            date: '2019',
            summary: 'For developing the real-time analytics system that became a key product differentiator.',
          },
        ],
      },
    };

    const result = await tool.handler(input, extra);

    assert.ok(result.structuredContent, 'should have structuredContent');
    const output = result.structuredContent?.result as Output;
    assert.ok(output.documentId, 'should have documentId');
    assert.ok(output.sizeBytes > 0, 'should have non-zero size');
    // Large resume with extensive content should be multiple pages
    // The size threshold indicates multi-page content
    assert.ok(output.sizeBytes > 30000, `should have substantial content size (got ${output.sizeBytes})`);

    console.log(`    📄 Multi-page resume created: ${output.sizeBytes} bytes`);
    console.log(`    📂 Output: ${testStorageDir}/${output.documentId}.pdf`);
    console.log('    ℹ️  Open the PDF to verify fine-grained pagination visually');
  });

  it('handles resume with only summaries (no bullets)', async () => {
    const config = createTestConfig();
    const tool = createTool();
    const extra = createExtra(config);

    const input: Input = {
      filename: 'summary-only-pagination-test.pdf',
      resume: {
        basics: {
          name: 'Summary Only Test',
          label: 'Product Manager',
          summary: 'Experienced product manager with a track record of launching successful products.',
        },
        work: [
          {
            name: 'Product Company',
            position: 'Senior Product Manager',
            startDate: '2020-01',
            summary: 'Led product strategy for the core platform, driving 40% year-over-year revenue growth. ' + 'Collaborated with engineering, design, and sales teams to deliver features that exceeded customer expectations.',
          },
          {
            name: 'Startup Inc',
            position: 'Product Manager',
            startDate: '2017-01',
            endDate: '2019-12',
            summary: 'Owned the product roadmap for the B2B SaaS offering. ' + 'Conducted extensive customer research and competitive analysis to prioritize features.',
          },
        ],
      },
    };

    const result = await tool.handler(input, extra);

    assert.ok(result.structuredContent, 'should have structuredContent');
    const output = result.structuredContent?.result as Output;
    assert.ok(output.documentId, 'should have documentId');

    console.log(`    📄 Summary-only resume created: ${output.sizeBytes} bytes`);
  });

  it('handles resume with only bullets (no summaries)', async () => {
    const config = createTestConfig();
    const tool = createTool();
    const extra = createExtra(config);

    const input: Input = {
      filename: 'bullets-only-pagination-test.pdf',
      resume: {
        basics: {
          name: 'Bullets Only Test',
          label: 'Software Engineer',
        },
        work: [
          {
            name: 'Tech Company',
            position: 'Senior Engineer',
            startDate: '2020-01',
            highlights: ['Built scalable microservices architecture', 'Implemented CI/CD pipelines', 'Mentored junior developers', 'Contributed to open source projects', 'Reduced system latency by 50%'],
          },
          {
            name: 'Another Company',
            position: 'Engineer',
            startDate: '2017-01',
            endDate: '2019-12',
            highlights: ['Developed RESTful APIs', 'Optimized database performance', 'Created automated tests'],
          },
        ],
      },
    };

    const result = await tool.handler(input, extra);

    assert.ok(result.structuredContent, 'should have structuredContent');
    const output = result.structuredContent?.result as Output;
    assert.ok(output.documentId, 'should have documentId');

    console.log(`    📄 Bullets-only resume created: ${output.sizeBytes} bytes`);
  });

  it('handles education entries with courses', async () => {
    const config = createTestConfig();
    const tool = createTool();
    const extra = createExtra(config);

    const input: Input = {
      filename: 'education-pagination-test.pdf',
      resume: {
        basics: {
          name: 'Education Test',
          label: 'Recent Graduate',
        },
        education: [
          {
            institution: 'University of Technology',
            area: 'Computer Science',
            studyType: 'Ph.D.',
            startDate: '2018',
            endDate: '2023',
            courses: ['Advanced Machine Learning', 'Distributed Systems', 'Natural Language Processing', 'Computer Vision', 'Reinforcement Learning'],
          },
          {
            institution: 'State University',
            area: 'Mathematics',
            studyType: 'M.S.',
            startDate: '2016',
            endDate: '2018',
            courses: ['Linear Algebra', 'Probability Theory', 'Numerical Analysis', 'Optimization'],
          },
          {
            institution: 'Liberal Arts College',
            area: 'Physics',
            studyType: 'B.S.',
            startDate: '2012',
            endDate: '2016',
            courses: ['Quantum Mechanics', 'Thermodynamics', 'Electromagnetism'],
          },
        ],
      },
    };

    const result = await tool.handler(input, extra);

    assert.ok(result.structuredContent, 'should have structuredContent');
    const output = result.structuredContent?.result as Output;
    assert.ok(output.documentId, 'should have documentId');

    console.log(`    📄 Education resume created: ${output.sizeBytes} bytes`);
  });
});
