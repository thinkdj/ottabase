import Link from 'next/link';
import { AnimateOnView } from '@/components/core/AnimateOnView';

export function ManifestoTeaser() {
    return (
        <section className="manifesto-teaser" aria-labelledby="manifesto-heading">
            <div className="container manifesto-inner">
                <AnimateOnView>
                    <p className="manifesto-label">Philosophy</p>
                    <h2 id="manifesto-heading">
                        Fat models.
                        <br />
                        Not a pattern.
                        <br />A commitment.
                    </h2>
                </AnimateOnView>

                <AnimateOnView delayClass="animate-delay-2">
                    <blockquote className="manifesto-quote">
                        <p>
                            There is a ceremony in modern web development. You write a model. Then a service. Then a
                            controller. Then a repository. Then a DTO. Then a transformer.{' '}
                            <strong>
                                By the time you&apos;re done, you&apos;ve touched six files to save one record.
                            </strong>
                        </p>
                        <p>
                            OttaORM says: no. <strong>The model knows how to save itself.</strong> It knows its
                            relationships. Its validation rules. Its domain behavior. The model is the truth. Everything
                            else is thin.
                        </p>
                        <Link href="/philosophy" className="cta-link" aria-label="Read the full fat models manifesto">
                            Read the manifesto →
                        </Link>
                    </blockquote>
                </AnimateOnView>
            </div>
        </section>
    );
}
