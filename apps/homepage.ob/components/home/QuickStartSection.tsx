import { AnimateOnView } from '@/components/core/AnimateOnView';
import { TerminalDemo } from '@/components/home/TerminalDemo';

export function QuickStartSection() {
    return (
        <section className="quickstart" aria-labelledby="qs-heading">
            <div className="container quickstart-inner">
                <AnimateOnView className="quickstart-text">
                    <h2 id="qs-heading">
                        From zero to
                        <br />
                        running SaaS.
                    </h2>
                    <p>
                        One command to scaffold. One command to dev. One HTTP call to migrate. No Postgres to spin up,
                        no Docker, no YAML files you&apos;ll never understand.
                    </p>

                    <div className="quickstart-steps" aria-label="Setup steps">
                        <div className="qs-step">
                            <span className="qs-step-num" aria-hidden="true">
                                1
                            </span>
                            <span className="qs-step-text">
                                <strong>Scaffold</strong> — creates the full monorepo with all 47 packages configured.
                            </span>
                        </div>
                        <div className="qs-step">
                            <span className="qs-step-num" aria-hidden="true">
                                2
                            </span>
                            <span className="qs-step-text">
                                <strong>Install &amp; run</strong> — Vite on 3003, Wrangler on 3004, hot reload
                                everywhere.
                            </span>
                        </div>
                        <div className="qs-step">
                            <span className="qs-step-num" aria-hidden="true">
                                3
                            </span>
                            <span className="qs-step-text">
                                <strong>Init database</strong> — one POST request creates every table. No SQL. No
                                migration files.
                            </span>
                        </div>
                        <div className="qs-step">
                            <span className="qs-step-num" aria-hidden="true">
                                4
                            </span>
                            <span className="qs-step-text">
                                <strong>Ship it</strong> — <code>wrangler deploy</code> pushes to 300+ edge locations.
                                Done.
                            </span>
                        </div>
                    </div>
                </AnimateOnView>

                <AnimateOnView delayClass="animate-delay-2">
                    <TerminalDemo />
                </AnimateOnView>
            </div>
        </section>
    );
}
