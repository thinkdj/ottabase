import { SEOHead } from '@/components/SEOHead';
import { APP_META } from '@/ottabase/config';
import { Link } from '@tanstack/react-router';
import { sanitizeUrl } from '@ottabase/utils/sanitize';
import { ArrowLeft, ArrowRight, Rss } from 'lucide-react';

const rssUrl = sanitizeUrl('/api/blog/rss?title=Slices.&description=Essays%2C%20observations%2C%20and%20photographs');

export function PersonalAboutPage() {
    return (
        <div className="personal-about-page">
            <SEOHead
                title={`About — ${APP_META.appName}`}
                description="A little context for this personal journal."
                ogType="website"
            />
            <Link to="/blog" className="personal-back-link">
                <ArrowLeft size={15} /> Back to writing
            </Link>
            <section className="personal-about-hero">
                <p className="personal-eyebrow">About this space</p>
                <h1>A notebook in public.</h1>
                <p className="personal-about-lede">
                    This is a home for unfinished ideas, useful detours, and the details that are easy to miss when
                    everything moves too quickly.
                </p>
            </section>
            <div className="personal-about-grid">
                <div className="personal-about-copy">
                    <p>
                        I write about the work I am doing, the things I am learning, and the questions that keep
                        following me home. Some notes are polished essays. Others are brief observations or photo
                        journals. They all belong to the same ongoing conversation.
                    </p>
                    <p>
                        There is no publishing schedule here. The archive is chronological on purpose: a record of
                        attention, rather than a catalogue of answers.
                    </p>
                    <Link to="/blog" className="personal-text-link">
                        Browse the archive <ArrowRight size={15} />
                    </Link>
                </div>
                <aside className="personal-about-aside">
                    <p className="personal-eyebrow">Keep in touch</p>
                    <p>Subscribe in the reader you already use.</p>
                    <a href={rssUrl} className="personal-rss-link">
                        <Rss size={16} /> Follow the RSS feed
                    </a>
                </aside>
            </div>
        </div>
    );
}

export default PersonalAboutPage;
