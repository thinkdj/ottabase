import Link from 'next/link';
import { AnimateOnView } from '@/components/core/AnimateOnView';

export function EcosystemSection() {
    return (
        <section aria-labelledby="ecosystem-heading">
            <div className="container">
                <AnimateOnView className="ecosystem-header">
                    <h2 id="ecosystem-heading">
                        Six categories.
                        <br />
                        Everything SaaS needs.
                    </h2>
                    <p>Not a starter template. Not a boilerplate. A complete, opinionated ecosystem.</p>
                </AnimateOnView>

                <div className="eco-grid">
                    <AnimateOnView
                        className="eco-card animate-delay-1"
                        delayClass="animate-delay-1"
                        style={{ ['--cat-color' as string]: 'var(--cat-core)' }}
                    >
                        <div className="eco-card-head">
                            <span className="eco-dot" />
                            <h3>Core Infrastructure</h3>
                            <span className="eco-count">11 packages</span>
                        </div>
                        <ul className="eco-pkg-list" aria-label="Core infrastructure packages">
                            <li className="eco-pkg">@ottabase/ottaorm</li>
                            <li className="eco-pkg">@ottabase/auth</li>
                            <li className="eco-pkg">@ottabase/rbac</li>
                            <li className="eco-pkg">@ottabase/cf</li>
                            <li className="eco-pkg">@ottabase/queue</li>
                            <li className="eco-pkg-more">+ 6 more →</li>
                        </ul>
                        <p className="eco-card-desc">
                            ORM with fat models, Auth.js v5, role-based access control, Cloudflare bindings, job queues,
                            structured logging, audit trails, analytics.
                        </p>
                    </AnimateOnView>

                    <AnimateOnView
                        className="eco-card animate-delay-2"
                        delayClass="animate-delay-2"
                        style={{ ['--cat-color' as string]: 'var(--cat-ui)' }}
                    >
                        <div className="eco-card-head">
                            <span className="eco-dot" />
                            <h3>UI Components</h3>
                            <span className="eco-count">12 packages</span>
                        </div>
                        <ul className="eco-pkg-list" aria-label="UI component packages">
                            <li className="eco-pkg">@ottabase/ui-shadcn</li>
                            <li className="eco-pkg">@ottabase/ui-datatable</li>
                            <li className="eco-pkg">@ottabase/spotlight</li>
                            <li className="eco-pkg">@ottabase/ottadate</li>
                            <li className="eco-pkg">@ottabase/ui-cropper</li>
                            <li className="eco-pkg-more">+ 7 more →</li>
                        </ul>
                        <p className="eco-card-desc">
                            shadcn/ui, Mantine provider, command palette, date picker with timezone, TanStack Table
                            wrapper, resizable split-pane, image cropper.
                        </p>
                    </AnimateOnView>

                    <AnimateOnView
                        className="eco-card animate-delay-3"
                        delayClass="animate-delay-3"
                        style={{ ['--cat-color' as string]: 'var(--cat-content)' }}
                    >
                        <div className="eco-card-head">
                            <span className="eco-dot" />
                            <h3>Content &amp; Media</h3>
                            <span className="eco-count">5 packages</span>
                        </div>
                        <ul className="eco-pkg-list" aria-label="Content and media packages">
                            <li className="eco-pkg">@ottabase/ottablog</li>
                            <li className="eco-pkg">@ottabase/ottaeditor</li>
                            <li className="eco-pkg">@ottabase/ottarenderer</li>
                            <li className="eco-pkg">@ottabase/ottaupload</li>
                            <li className="eco-pkg">@ottabase/medialibrary</li>
                        </ul>
                        <p className="eco-card-desc">
                            Full blog/CMS engine, an EditorJS wrapper with 30 plugins, block renderer, file uploads to
                            R2 &amp; Cloudflare Images, media library primitives.
                        </p>
                    </AnimateOnView>

                    <AnimateOnView
                        className="eco-card animate-delay-1"
                        delayClass="animate-delay-1"
                        style={{ ['--cat-color' as string]: 'var(--cat-business)' }}
                    >
                        <div className="eco-card-head">
                            <span className="eco-dot" />
                            <h3>Business Features</h3>
                            <span className="eco-count">5 packages</span>
                        </div>
                        <ul className="eco-pkg-list" aria-label="Business feature packages">
                            <li className="eco-pkg">@ottabase/shortlinks</li>
                            <li className="eco-pkg">@ottabase/referrals</li>
                            <li className="eco-pkg">@ottabase/notifications</li>
                            <li className="eco-pkg">@ottabase/comments</li>
                            <li className="eco-pkg">@ottabase/forms</li>
                        </ul>
                        <p className="eco-card-desc">
                            URL shortener, first-touch referral attribution, multi-channel notifications, threaded
                            comment system, and auto-generated CRUD forms from your models.
                        </p>
                    </AnimateOnView>

                    <AnimateOnView
                        className="eco-card animate-delay-2"
                        delayClass="animate-delay-2"
                        style={{ ['--cat-color' as string]: 'var(--cat-brand)' }}
                    >
                        <div className="eco-card-head">
                            <span className="eco-dot" />
                            <h3>Brand &amp; Layout</h3>
                            <span className="eco-count">5 packages</span>
                        </div>
                        <ul className="eco-pkg-list" aria-label="Brand and layout packages">
                            <li className="eco-pkg">@ottabase/brand-engine</li>
                            <li className="eco-pkg">@ottabase/brand-engine-react</li>
                            <li className="eco-pkg">@ottabase/ottalayout</li>
                            <li className="eco-pkg">@ottabase/ottamenu</li>
                            <li className="eco-pkg">@ottabase/homepage-contract</li>
                        </ul>
                        <p className="eco-card-desc">
                            Design token engine with 8 presets, CSS variable injection, email branding, 10 layout
                            presets with React slot system, menu primitives.
                        </p>
                    </AnimateOnView>

                    <AnimateOnView
                        className="eco-card animate-delay-3"
                        delayClass="animate-delay-3"
                        style={{ ['--cat-color' as string]: 'var(--cat-utils)' }}
                    >
                        <div className="eco-card-head">
                            <span className="eco-dot" />
                            <h3>Utilities</h3>
                            <span className="eco-count">9 packages</span>
                        </div>
                        <ul className="eco-pkg-list" aria-label="Utility packages">
                            <li className="eco-pkg">@ottabase/scripts</li>
                            <li className="eco-pkg">@ottabase/email</li>
                            <li className="eco-pkg">@ottabase/i18n</li>
                            <li className="eco-pkg">@ottabase/cf-ai</li>
                            <li className="eco-pkg">@ottabase/utils</li>
                            <li className="eco-pkg-more">+ 4 more →</li>
                        </ul>
                        <p className="eco-card-desc">
                            CLI setup tools, email with Resend/SES/MailChannels/SMTP, i18n for four languages,
                            Cloudflare AI/Gateway wrapper, type-safe fetch, Jotai atoms, timezone utils.
                        </p>
                    </AnimateOnView>
                </div>

                <AnimateOnView className="eco-see-all">
                    <Link href="/packages" className="btn btn-ghost btn-lg">
                        View all 47 packages →
                    </Link>
                </AnimateOnView>
            </div>
        </section>
    );
}
