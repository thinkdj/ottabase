import type { ResumeTemplateData } from './types';

/**
 * Dummy avatar for guest mode — a neutral placeholder silhouette.
 * Uses UI Avatars service for a deterministic "JD" placeholder.
 */
// AI-generated portrait — stable URL from randomuser.me (CC-licensed placeholder faces)
export const GUEST_AVATAR_URL = 'https://randomuser.me/api/portraits/men/32.jpg';

/**
 * Mock resume data for guest/demo mode.
 *
 * Restrictions enforced by the builder:
 * - `fullName` is always "John Doe" (locked, not editable)
 * - Printing / PDF export is disabled
 * - No save/persist — edits live only in component state
 */
export const GUEST_DATA: ResumeTemplateData = {
    fullName: 'John Doe',
    profile: {
        headline: 'Full-Stack Software Engineer',
        summary:
            'Results-driven software engineer with 6+ years of experience designing, building, and shipping ' +
            'web applications at scale. Adept at translating business requirements into clean, maintainable code. ' +
            'Strong communicator who thrives in cross-functional teams and fast-paced environments.',
        avatarUrl: GUEST_AVATAR_URL,
        email: 'john.doe@example.com',
        phone: '+1 555-987-6543',
        location: 'New York, NY',
        website: 'https://johndoe.dev',
        linkedinUrl: 'https://linkedin.com/in/johndoe',
        githubUrl: 'https://github.com/johndoe',
    },
    skillSets: [
        {
            id: 'g-sk-1',
            name: 'Languages & Frameworks',
            skills: ['TypeScript', 'React', 'Node.js', 'Python', 'Next.js', 'Tailwind CSS'],
        },
        {
            id: 'g-sk-2',
            name: 'Infrastructure',
            skills: ['AWS', 'Docker', 'PostgreSQL', 'Redis', 'GitHub Actions'],
        },
        {
            id: 'g-sk-3',
            name: 'Practices',
            skills: ['Agile / Scrum', 'Code Review', 'TDD', 'System Design', 'Technical Writing'],
        },
    ],
    workExperiences: [
        {
            id: 'g-we-1',
            company: 'Acme Corp',
            designation: 'Senior Software Engineer',
            location: 'New York, NY',
            startDate: '2022-01',
            endDate: null,
            isCurrent: true,
            description: null,
            highlights: [
                'Architected a real-time analytics dashboard used by 200+ enterprise clients, processing 10M events/day',
                'Reduced API latency by 40% through query optimisation and strategic caching with Redis',
                'Led a team of 5 engineers to deliver a greenfield billing platform on schedule',
            ],
        },
        {
            id: 'g-we-2',
            company: 'Bright Solutions',
            designation: 'Software Engineer',
            location: 'Boston, MA',
            startDate: '2019-06',
            endDate: '2021-12',
            isCurrent: false,
            description: null,
            highlights: [
                'Built and maintained a multi-tenant SaaS platform serving 50K+ users',
                'Implemented CI/CD pipeline that cut release cycles from 2 weeks to 2 days',
                'Mentored 3 junior developers through pair programming and code review sessions',
            ],
        },
        {
            id: 'g-we-3',
            company: 'WebStart Agency',
            designation: 'Junior Developer',
            location: 'Remote',
            startDate: '2017-09',
            endDate: '2019-05',
            isCurrent: false,
            description: null,
            highlights: [
                'Developed responsive marketing sites and e-commerce storefronts for 15+ clients',
                'Introduced automated visual regression testing, reducing QA time by 30%',
            ],
        },
    ],
    educations: [
        {
            id: 'g-ed-1',
            institution: 'Massachusetts Institute of Technology',
            degree: 'Bachelor of Science',
            field: 'Computer Science',
            startDate: '2013-09',
            endDate: '2017-06',
            grade: '3.9 GPA',
            description: null,
        },
    ],
    projects: [
        {
            id: 'g-pj-1',
            title: 'TaskFlow',
            description: 'Open-source project management tool with real-time collaboration and Kanban boards',
            url: 'https://github.com/johndoe/taskflow',
            techStack: ['React', 'TypeScript', 'WebSockets', 'PostgreSQL'],
            startDate: '2023-03',
            endDate: null,
        },
        {
            id: 'g-pj-2',
            title: 'CryptoWatch',
            description: 'Cryptocurrency portfolio tracker with live price alerts and performance charts',
            url: 'https://github.com/johndoe/cryptowatch',
            techStack: ['Next.js', 'D3.js', 'Redis', 'REST API'],
            startDate: '2022-08',
            endDate: '2023-01',
        },
    ],
    certifications: [
        {
            id: 'g-ct-1',
            name: 'AWS Certified Solutions Architect — Associate',
            issuer: 'Amazon Web Services',
            issueDate: '2023-04',
            expiryDate: '2026-04',
            credentialUrl: 'https://aws.amazon.com/verification',
        },
        {
            id: 'g-ct-2',
            name: 'Google Professional Cloud Developer',
            issuer: 'Google Cloud',
            issueDate: '2022-11',
            expiryDate: '2024-11',
            credentialUrl: null,
        },
    ],
};
