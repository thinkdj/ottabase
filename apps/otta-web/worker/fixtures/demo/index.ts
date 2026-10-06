/**
 * Everything the demo seed writes. Trusted, static fixtures for a fresh deployment: a team, a media
 * library, a blog with six months of posts, comment threads, shortlinks and navigation. Every list
 * is keyed on something stable (email, storage key, slug, short code, menu slug), so the seed
 * creates what is missing and never overwrites what an editor changed.
 */
export { THREADS, type DemoComment, type DemoThread } from './comments';
export { DEMO_MEDIA, IMAGES, unsplash, type DemoImage } from './images';
export { MENUS, type DemoMenu } from './menus';
export { PEOPLE, type DemoPerson } from './people';
export { DEMO_POSTS } from './posts';
export { SHORTLINKS, type DemoShortlink } from './shortlinks';
