import { Button } from '@ottabase/ui';
import { Link } from '@tanstack/react-router';
import { ArrowRight, Boxes, ShieldCheck, Zap } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import type * as THREE from 'three';

interface OttabaseHeroProps {
    appName: string;
}

/** Both negations share one class so the pair keeps reading as a matched set. */
const HERO_SUBLINE = 'font-normal text-black dark:text-white text-3xl sm:text-4xl lg:text-5xl';

const FALLBACK_PRIMARY = '221 83% 53%';
const FALLBACK_MUTED = '210 40% 96%';
const FALLBACK_CARD = '0 0% 100%';

/** Resolve a Brand Engine HSL token for a WebGL material. */
function getThemeColor(three: typeof import('three'), element: HTMLElement, token: string, fallback: string) {
    const value = getComputedStyle(element).getPropertyValue(token).trim() || fallback;
    const parts = value.match(/-?(?:\d+\.?\d*|\.\d+)%?/g)?.map(Number.parseFloat) ?? [];

    if (parts.length >= 3) {
        return new three.Color().setHSL((((parts[0] % 360) + 360) % 360) / 360, parts[1] / 100, parts[2] / 100);
    }

    const fallbackParts = fallback.match(/-?(?:\d+\.?\d*|\.\d+)%?/g)?.map(Number.parseFloat) ?? [221, 83, 53];
    return new three.Color().setHSL(fallbackParts[0] / 360, fallbackParts[1] / 100, fallbackParts[2] / 100);
}

/**
 * A deliberately small, framework-free Three.js scene: a field of instanced
 * slabs (the wired foundation) with a few tiles lit in the brand primary and
 * one raised tile near the headline, "your thing". One draw call, no pointer
 * handling, a single static frame under reduced motion.
 */
function HeroScene() {
    const hostRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let disposed = false;
        let cleanup: (() => void) | undefined;

        void import('three')
            .then((THREE) => {
                const host = hostRef.current;
                if (disposed || !host || typeof window === 'undefined' || !('WebGLRenderingContext' in window)) return;

                let renderer: THREE.WebGLRenderer;
                try {
                    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
                } catch {
                    // The HTML hero remains fully useful when WebGL is unavailable.
                    return;
                }

                const scene = new THREE.Scene();
                // A long lens from far back flattens the perspective so the near slabs stay small.
                const camera = new THREE.PerspectiveCamera(22, 1, 0.1, 80);
                camera.position.set(0, 9, 20);
                camera.lookAt(0, -0.4, 0);

                const canvas = renderer.domElement;
                canvas.style.display = 'block';
                canvas.style.width = '100%';
                canvas.style.height = '100%';
                canvas.style.pointerEvents = 'none';
                renderer.outputColorSpace = THREE.SRGBColorSpace;
                host.replaceChildren(canvas);

                scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.6));
                const sun = new THREE.DirectionalLight(0xffffff, 1.4);
                sun.position.set(-4, 8, 6);
                scene.add(sun);

                const COLS = 30;
                const ROWS = 24;
                const PITCH = 1;
                const count = COLS * ROWS;
                // The last instance is "your thing": a slab hovering above its base tile.
                const heroIndex = count;
                const geometry = new THREE.BoxGeometry(0.86, 0.16, 0.86);
                const material = new THREE.MeshLambertMaterial();
                const field = new THREE.InstancedMesh(geometry, material, count + 1);
                field.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
                field.position.set(3, -0.8, 0);
                field.rotation.y = Math.PI / 4;
                scene.add(field);

                const tileX = (col: number) => (col - COLS / 2 + 0.5) * PITCH;
                const tileZ = (row: number) => (row - ROWS / 2 + 0.5) * PITCH;
                // Cells chosen by projecting the grid through this camera: the hero lands just right of
                // the headline, the lit cells scatter across the open right half of the card.
                const heroCol = 15;
                const heroRow = 11;
                const litCells: Array<[number, number]> = [
                    [19, 10],
                    [14, 14],
                    [21, 7],
                    [11, 13],
                    [17, 13],
                    [13, 9],
                    [22, 11],
                    [18, 6],
                    [12, 16],
                    [20, 13],
                ];
                const lit = litCells.map(([col, row], i) => ({
                    index: row * COLS + col,
                    phase: i * 1.7,
                    speed: 0.5 + (i % 3) * 0.2,
                }));
                const litByIndex = new Map(lit.map((tile) => [tile.index, tile]));

                const base = new THREE.Color();
                const primary = new THREE.Color();
                const card = new THREE.Color();
                const tint = new THREE.Color();
                const dummy = new THREE.Object3D();
                const fog = new THREE.Fog(card, 17, 34);
                scene.fog = fog;

                const wave = (x: number, z: number, seconds: number) =>
                    Math.sin(x * 0.55 + seconds * 0.6) * 0.11 + Math.cos(z * 0.5 - seconds * 0.45) * 0.09;

                const paint = (seconds: number) => {
                    for (let index = 0; index < count; index += 1) {
                        const x = tileX(index % COLS);
                        const z = tileZ(Math.floor(index / COLS));
                        dummy.position.set(x, wave(x, z, seconds), z);
                        dummy.updateMatrix();
                        field.setMatrixAt(index, dummy.matrix);

                        const litTile = litByIndex.get(index);
                        const glow = litTile
                            ? 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(seconds * litTile.speed + litTile.phase))
                            : 0;
                        field.setColorAt(index, tint.copy(base).lerp(primary, glow));
                    }

                    const heroX = tileX(heroCol);
                    const heroZ = tileZ(heroRow);
                    dummy.position.set(
                        heroX,
                        wave(heroX, heroZ, seconds) + 0.7 + Math.sin(seconds * 0.9) * 0.06,
                        heroZ,
                    );
                    dummy.updateMatrix();
                    field.setMatrixAt(heroIndex, dummy.matrix);
                    field.setColorAt(heroIndex, primary);
                    field.instanceMatrix.needsUpdate = true;
                    if (field.instanceColor) field.instanceColor.needsUpdate = true;
                };

                const updateColors = () => {
                    base.copy(getThemeColor(THREE, host, '--muted', FALLBACK_MUTED));
                    primary.copy(getThemeColor(THREE, host, '--primary', FALLBACK_PRIMARY));
                    card.copy(getThemeColor(THREE, host, '--card', FALLBACK_CARD));
                    fog.color.copy(card);
                    renderer.setClearColor(card, 1);
                };

                const resize = () => {
                    const { width, height } = host.getBoundingClientRect();
                    if (!width || !height) return;
                    camera.aspect = width / height;
                    camera.updateProjectionMatrix();
                    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
                    // CSS already fills the host; false keeps the drawing buffer on device pixels.
                    renderer.setSize(width, height, false);
                };

                const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                let frameId = 0;
                const render = (milliseconds = 0) => {
                    paint(reducedMotion ? 0 : milliseconds / 1000);
                    renderer.render(scene, camera);
                    if (!reducedMotion) frameId = window.requestAnimationFrame(render);
                };

                updateColors();
                resize();
                render();

                const resizeObserver = new ResizeObserver(() => {
                    resize();
                    if (reducedMotion) render();
                });
                resizeObserver.observe(host);
                const themeObserver = new MutationObserver(() => {
                    updateColors();
                    if (reducedMotion) render();
                });
                themeObserver.observe(document.documentElement, {
                    attributes: true,
                    attributeFilter: ['class', 'style'],
                });

                cleanup = () => {
                    window.cancelAnimationFrame(frameId);
                    resizeObserver.disconnect();
                    themeObserver.disconnect();
                    geometry.dispose();
                    material.dispose();
                    field.dispose();
                    renderer.dispose();
                    renderer.domElement.remove();
                };
            })
            .catch(() => {
                // If the enhancement cannot load, retain the HTML-first hero.
            });

        return () => {
            disposed = true;
            cleanup?.();
        };
    }, []);

    return (
        <div
            ref={hostRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] opacity-90"
        />
    );
}

export function OttabaseHero({ appName }: OttabaseHeroProps) {
    return (
        <section
            aria-labelledby="ottabase-hero-heading"
            className="relative isolate overflow-hidden rounded-[2rem] border border-border/70 bg-card shadow-2xl shadow-primary/5"
        >
            <HeroScene />
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] bg-[linear-gradient(108deg,hsl(var(--card))_0%,hsl(var(--card)/0.96)_42%,hsl(var(--card)/0.28)_75%,hsl(var(--card)/0.8)_100%)] dark:bg-[linear-gradient(108deg,hsl(var(--card))_0%,hsl(var(--card)/0.92)_42%,hsl(var(--card)/0.25)_75%,hsl(var(--card)/0.78)_100%)]" />
            <div className="pointer-events-none absolute -right-28 top-1/2 h-80 w-80 -translate-y-1/2 overflow-hidden rounded-full bg-primary/20 blur-[110px]" />

            <div className="relative z-10 flex min-h-[40rem] flex-col justify-between px-6 py-8 sm:px-10 sm:py-10 lg:min-h-[42rem] lg:px-14 lg:py-14">
                <div className="max-w-2xl">
                    <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-background/75 px-3 py-1.5 text-xs font-semibold tracking-[0.16em] text-primary shadow-sm backdrop-blur-sm">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_14px_hsl(var(--primary))]" />
                        {appName} / EDGE-NATIVE FOUNDATION
                    </div>
                    <h1
                        id="ottabase-hero-heading"
                        className="leading-relaxed sm:leading-none max-w-xl font-bold bg-linear-to-r from-primary via-primary to-foreground bg-clip-text text-transparent tracking-[-0.065em] sm:tracking-normal text-foreground text-5xl sm:text-6xl lg:text-7xl"
                    >
                        Ship your thing.
                        <span className={`block ${HERO_SUBLINE}`}>
                            Not the thing before the thing.{' '}
                            <span className={`inline ${HERO_SUBLINE}`}>Or the thing after it.</span>
                        </span>
                    </h1>
                    <p className="mt-7 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                        Tenancy, auth, RLS, theming, media, and 60+ packages, wired together on a Cloudflare-native
                        foundation. You bring the part only you can build.
                    </p>
                    <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                        <Button asChild size="lg" className="group gap-2 rounded-full px-6 shadow-lg shadow-primary/20">
                            <Link to="/docs/$" params={{ _splat: '' }}>
                                Start building
                                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                            </Link>
                        </Button>
                        <Button
                            asChild
                            size="lg"
                            variant="outline"
                            className="rounded-full border-border/80 bg-background/65 px-6 backdrop-blur-sm hover:bg-background hover:text-primary"
                        >
                            <Link to="/demo">Explore live demos</Link>
                        </Button>
                    </div>
                </div>

                <ul
                    aria-label="Platform capabilities"
                    className="grid max-w-2xl grid-cols-1 gap-3 pt-12 sm:grid-cols-3"
                >
                    <HeroStat
                        icon={<Zap className="h-4 w-4" />}
                        label="Global by default"
                        detail="Workers at the edge"
                    />
                    <HeroStat icon={<ShieldCheck className="h-4 w-4" />} label="Tenant-safe" detail="RLS in the ORM" />
                    <HeroStat
                        icon={<Boxes className="h-4 w-4" />}
                        label="Already wired"
                        detail="60+ packages, one install"
                    />
                </ul>
            </div>
        </section>
    );
}

function HeroStat({ icon, label, detail }: { icon: ReactNode; label: string; detail: string }) {
    return (
        <li className="rounded-2xl border border-border/60 bg-background/65 p-3.5 shadow-sm backdrop-blur-md">
            <div className="mb-3 flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {icon}
            </div>
            <p className="text-sm font-semibold text-foreground">{label}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
        </li>
    );
}
