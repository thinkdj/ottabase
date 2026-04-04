import Link from 'next/link';
import { AnimateOnView } from '@/components/core/AnimateOnView';

export function ArchitectureSection() {
    return (
        <section aria-labelledby="arch-heading">
            <div className="container arch-inner">
                <AnimateOnView className="arch-text">
                    <h2 id="arch-heading">
                        The stack.
                        <br />
                        All the way down.
                    </h2>
                    <p>
                        Every layer is first-class Cloudflare. Not a wrapper. Not an adapter. Ottabase was designed for
                        the edge from day one.
                    </p>
                    <p>
                        D1 for your database (SQLite, no Postgres to provision). KV for RBAC caching and sessions. R2
                        for files. Durable Objects for real-time WebSockets. Queues for jobs. Analytics Engine for
                        events.
                    </p>
                    <p>
                        You own every bit of it. No vendor lock-in beyond Cloudflare&apos;s pricing, which is — by a
                        large margin — the cheapest option that exists.
                    </p>
                    <Link href="/philosophy" aria-label="Read the full architecture philosophy">
                        Read the philosophy →
                    </Link>
                </AnimateOnView>

                <AnimateOnView className="arch-diagram animate-delay-2" delayClass="animate-delay-2">
                    <div className="arch-layer" aria-label="Architecture layers diagram">
                        <div className="arch-box">
                            <div className="arch-box-label">Browser / Client</div>
                            <div className="arch-box-sub">TanStack Router + Vite</div>
                        </div>
                        <div className="arch-connector">
                            <span className="arch-connector-label">TanStack Query hooks</span>
                        </div>

                        <div className="arch-box">
                            <div className="arch-box-label">Cloudflare Workers Edge</div>
                            <div className="arch-box-sub">300+ locations · zero cold starts</div>
                        </div>
                        <div className="arch-connector">
                            <span className="arch-connector-label">OttaORM + RLS + RBAC</span>
                        </div>

                        <div className="arch-box highlight">
                            <div className="arch-box-label">OttaORM Fat Models</div>
                            <div className="arch-box-sub">domain logic · relationships · auto-CRUD</div>
                        </div>
                        <div className="arch-connector">
                            <span className="arch-connector-label">Drizzle + D1 driver</span>
                        </div>

                        <div className="arch-box">
                            <div className="arch-box-label">Cloudflare D1</div>
                            <div className="arch-box-sub">SQLite · replicated · serverless</div>
                        </div>

                        <div className="arch-side-connectors" aria-label="Supporting Cloudflare services">
                            <div className="arch-side-box">
                                KV
                                <br />
                                Sessions
                            </div>
                            <div className="arch-side-box">
                                R2
                                <br />
                                Files
                            </div>
                            <div className="arch-side-box">
                                DO
                                <br />
                                Realtime
                            </div>
                            <div className="arch-side-box">
                                Queues
                                <br />
                                Jobs
                            </div>
                        </div>
                    </div>
                </AnimateOnView>
            </div>
        </section>
    );
}
