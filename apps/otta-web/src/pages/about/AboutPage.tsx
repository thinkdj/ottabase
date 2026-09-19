import { SEOHead } from '@/components/SEOHead';
import { APP_META } from '@/ottabase/config';
import { Link } from '@tanstack/react-router';
import { BlogMeasure } from '@/pages/blog/blogUi';
import { BLOG_SITE } from '@/pages/blog/site';

export function AboutPage() {
    const year = new Date().getFullYear();

    return (
        <BlogMeasure className="space-y-10">
            <SEOHead title="About" description={BLOG_SITE.about} ogType="website" twitterCard="summary" />

            <header className="space-y-4">
                <p className="text-[0.75rem] tracking-[0.16em] text-muted-foreground uppercase">About</p>
                <h1 className="font-serif text-4xl font-medium tracking-[-0.035em] sm:text-5xl">{BLOG_SITE.name}</h1>
            </header>

            <div className="space-y-6 font-serif text-lg leading-[1.7] text-foreground">
                <p>{BLOG_SITE.about}</p>
                <p className="text-muted-foreground">
                    Essays live on the writing index. Short thoughts show up as notes. Photographs get their own
                    journals. If you want everything in a reader, there is an{' '}
                    <a
                        href={BLOG_SITE.rssPath}
                        className="underline decoration-foreground/25 underline-offset-4 hover:decoration-foreground/60"
                    >
                        RSS feed
                    </a>
                    .
                </p>
            </div>

            <p className="text-[0.8125rem] text-muted-foreground">
                <Link to="/blog" className="hover:text-foreground">
                    ← Writing
                </Link>
                <span className="mx-3 text-border">·</span>
                <span>
                    © {year} {APP_META.author || BLOG_SITE.name}
                </span>
            </p>
        </BlogMeasure>
    );
}

export default AboutPage;
