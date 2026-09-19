/**
 * Public copy and paths for this personal blog.
 * Detach-friendly: one place to rename the person, the intro, and the RSS feed.
 */
export const BLOG_SITE = {
    name: 'Deepak Thomas',
    firstName: 'Deepak',
    intro: 'Writing, photographs, and notes.',
    about: 'I write about building software, photographs, and whatever I am thinking through. This is a personal site — essays, short notes, and the occasional photo journal.',
    rssPath: '/api/blog/rss',
} as const;

export const BLOG_INDEX_PATH = '/blog';
export const ABOUT_PATH = '/about';
