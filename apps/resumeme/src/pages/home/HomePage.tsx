import { Link } from '@tanstack/react-router';

export function HomePage() {
    return (
        <div className="min-h-screen flex flex-col relative overflow-hidden">
            {/* Background image layer — sits behind content, receives sepia + blur */}
            <div
                className="absolute inset-0 z-0"
                style={{
                    backgroundImage: 'url(/resumemehero.png)',
                    backgroundPosition: 'center center',
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: 'contain',
                    filter: 'sepia(0.64) blur(0px)',
                    opacity: 0.256,
                }}
            />
            {/* Gooey SVG filter (hidden) — gives inline backgrounds smooth rounded corners */}
            <svg
                style={{ visibility: 'hidden', position: 'absolute' }}
                width="0"
                height="0"
                xmlns="http://www.w3.org/2000/svg"
                version="1.1"
            >
                <defs>
                    <filter id="goo">
                        <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
                        <feColorMatrix
                            in="blur"
                            mode="matrix"
                            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9"
                            result="goo"
                        />
                        <feComposite in="SourceGraphic" in2="goo" operator="atop" />
                    </filter>
                </defs>
            </svg>

            {/* Centered hero content — each element gets its own gooey blob */}
            <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 relative z-10 text-center">
                {/* Title */}
                <h1
                    className="bg-background/90 text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-50"
                    style={{
                        display: 'inline',
                        boxDecorationBreak: 'clone',
                        WebkitBoxDecorationBreak: 'clone',
                        padding: '0.4rem 0.8rem',
                        lineHeight: 1.5,
                        filter: "url('#goo')",
                    }}
                >
                    ResumeMe
                </h1>

                {/* Description */}
                <p
                    className="bg-background/90 mt-0 max-w-md text-sm text-gray-600 dark:text-gray-300"
                    style={{
                        display: 'inline',
                        boxDecorationBreak: 'clone',
                        WebkitBoxDecorationBreak: 'clone',
                        padding: '1rem 1rem',
                        lineHeight: 1.8,
                        filter: "url('#goo')",
                    }}
                >
                    <strong>Resume your hunt</strong> with an AI resume engine that remembers everything and spins out
                    laser-targeted <strong>tailored variations for every opportunity</strong>. Beat the ATS filters,
                    stay interview-ready, and ship limitless customized resumes - for free.
                </p>

                {/* Buttons */}
                <div
                    className="bg-background/90 mt-0 inline-flex gap-3"
                    style={{
                        padding: '1rem 1rem',
                        filter: "url('#goo')",
                    }}
                >
                    <Link
                        to="/resume-builder"
                        search={{ resumeId: undefined, dataSetId: undefined }}
                        className="rounded-md bg-gray-800 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
                    >
                        Get Started
                    </Link>
                    <Link
                        to="/guest"
                        className="rounded-md border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                        Try it Free
                    </Link>
                </div>

                {/* Footer text */}
                <p
                    className="bg-background/90 mt-0 text-xs text-gray-500 dark:text-gray-400"
                    style={{
                        display: 'inline',
                        boxDecorationBreak: 'clone',
                        WebkitBoxDecorationBreak: 'clone',
                        padding: '1rem 1rem',
                        lineHeight: 1.6,
                        filter: "url('#goo')",
                    }}
                >
                    No sign-up required —{' '}
                    <Link to="/guest" className="underline hover:text-gray-700 dark:hover:text-gray-200">
                        explore as a guest
                    </Link>
                </p>
            </div>
        </div>
    );
}
