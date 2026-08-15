import { Button } from '@ottabase/ui-shadcn';
import { Link } from '@tanstack/react-router';
import { ArrowRight, Boxes, ShieldCheck, Zap } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import type * as THREE from 'three';

interface OttabaseHeroProps {
    appName: string;
}

interface OrbitalNode {
    mesh: THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
    radius: number;
    speed: number;
    offset: number;
    tilt: number;
}

const FALLBACK_PRIMARY = '221 83% 53%';
const FALLBACK_RING = '262 83% 58%';
const FALLBACK_FOREGROUND = '222 47% 11%';

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
 * A deliberately small, framework-free Three.js scene. Keeping it imperative
 * avoids a second React renderer and lets the landing route freeze motion for
 * people who prefer reduced motion.
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
                    renderer = new THREE.WebGLRenderer({
                        alpha: true,
                        antialias: true,
                        powerPreference: 'high-performance',
                    });
                } catch {
                    // The HTML hero remains fully useful when WebGL is unavailable.
                    return;
                }

                const scene = new THREE.Scene();
                const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
                camera.position.set(0, 0.1, 10);

                renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
                renderer.setClearColor(0x000000, 0);
                renderer.outputColorSpace = THREE.SRGBColorSpace;
                renderer.domElement.style.pointerEvents = 'none';
                host.replaceChildren(renderer.domElement);

                const network = new THREE.Group();
                network.position.set(1.9, 0.1, 0);
                scene.add(network);

                const primaryMaterial = new THREE.MeshBasicMaterial({
                    transparent: true,
                    opacity: 0.33,
                    wireframe: true,
                });
                const coreMaterial = new THREE.PointsMaterial({
                    size: 0.035,
                    transparent: true,
                    opacity: 0.9,
                    sizeAttenuation: true,
                });
                const ringMaterial = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.35 });
                const satelliteMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.94 });

                const coreGeometry = new THREE.IcosahedronGeometry(1.86, 3);
                const core = new THREE.Mesh(coreGeometry, primaryMaterial);
                network.add(core);

                const pointGeometry = new THREE.IcosahedronGeometry(1.9, 3);
                const corePoints = new THREE.Points(pointGeometry, coreMaterial);
                network.add(corePoints);

                // A transparent sphere makes the visual globe easy to hit-test without changing how it looks.
                const interactionGeometry = new THREE.SphereGeometry(2.15, 32, 20);
                const interactionMaterial = new THREE.MeshBasicMaterial({
                    transparent: true,
                    opacity: 0,
                    depthWrite: false,
                });
                const interactionSphere = new THREE.Mesh(interactionGeometry, interactionMaterial);
                network.add(interactionSphere);

                const rings = [
                    { radius: 2.6, tilt: 0.25, yaw: 0.5 },
                    { radius: 3.12, tilt: 1.12, yaw: -0.25 },
                    { radius: 3.58, tilt: 2.05, yaw: 0.6 },
                ].map(({ radius, tilt, yaw }) => {
                    const curve = new THREE.EllipseCurve(0, 0, radius, radius * 0.45, 0, Math.PI * 2, false, 0);
                    const points = curve.getPoints(120).map((point) => new THREE.Vector3(point.x, point.y, 0));
                    const ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), ringMaterial);
                    ring.rotation.set(tilt, yaw, 0);
                    network.add(ring);
                    return ring;
                });

                const satelliteGeometry = new THREE.IcosahedronGeometry(0.13, 1);
                const orbitalNodes: OrbitalNode[] = [
                    { radius: 2.6, speed: 0.72, offset: 0.3, tilt: 0.25 },
                    { radius: 3.12, speed: -0.45, offset: 2.2, tilt: 1.12 },
                    { radius: 3.58, speed: 0.32, offset: 4.5, tilt: 2.05 },
                    { radius: 3.58, speed: 0.32, offset: 1.35, tilt: 2.05 },
                ].map(({ radius, speed, offset, tilt }) => {
                    const mesh = new THREE.Mesh(satelliteGeometry, satelliteMaterial);
                    network.add(mesh);
                    return { mesh, radius, speed, offset, tilt };
                });

                const dustGeometry = new THREE.BufferGeometry();
                const dustPositions = new Float32Array(240 * 3);
                for (let index = 0; index < 240; index += 1) {
                    const offset = index * 3;
                    dustPositions[offset] = (Math.random() - 0.5) * 13;
                    dustPositions[offset + 1] = (Math.random() - 0.5) * 9;
                    dustPositions[offset + 2] = (Math.random() - 0.5) * 5 - 2;
                }
                dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
                const dustMaterial = new THREE.PointsMaterial({
                    size: 0.026,
                    transparent: true,
                    opacity: 0.28,
                    sizeAttenuation: true,
                });
                const dust = new THREE.Points(dustGeometry, dustMaterial);
                scene.add(dust);

                const updateColors = () => {
                    const primary = getThemeColor(THREE, host, '--primary', FALLBACK_PRIMARY);
                    const ring = getThemeColor(THREE, host, '--ring', FALLBACK_RING);
                    const foreground = getThemeColor(THREE, host, '--foreground', FALLBACK_FOREGROUND);
                    primaryMaterial.color.copy(primary);
                    coreMaterial.color.copy(primary);
                    ringMaterial.color.copy(ring);
                    satelliteMaterial.color.copy(ring);
                    dustMaterial.color.copy(foreground);
                    interactionMaterial.color.copy(primary);
                };
                updateColors();

                const resize = () => {
                    const { width, height } = host.getBoundingClientRect();
                    if (!width || !height) return;
                    camera.aspect = width / height;
                    camera.updateProjectionMatrix();
                    renderer.setSize(width, height, false);
                };
                resize();

                const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                const pointer = new THREE.Vector2();
                const raycaster = new THREE.Raycaster();
                const dragPosition = new THREE.Vector2();
                const userRotation = new THREE.Vector2(-0.04, 0.1);
                const rotationVelocity = new THREE.Vector2();
                let activePointerId: number | null = null;

                const intersectGlobe = (event: PointerEvent) => {
                    const bounds = host.getBoundingClientRect();
                    const isInsideHero =
                        event.clientX >= bounds.left &&
                        event.clientX <= bounds.right &&
                        event.clientY >= bounds.top &&
                        event.clientY <= bounds.bottom;

                    if (!isInsideHero) return false;

                    pointer.set(
                        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
                        -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
                    );
                    network.updateMatrixWorld(true);
                    raycaster.setFromCamera(pointer, camera);
                    return raycaster.intersectObject(interactionSphere, false).length > 0;
                };

                let renderStatic = () => {};
                const onPointerDown = (event: PointerEvent) => {
                    if (!intersectGlobe(event)) return;

                    activePointerId = event.pointerId;
                    dragPosition.set(event.clientX, event.clientY);
                    rotationVelocity.set(0, 0);
                    event.preventDefault();
                };
                const onPointerMove = (event: PointerEvent) => {
                    if (event.pointerId !== activePointerId) return;

                    const bounds = host.getBoundingClientRect();
                    const deltaX = (event.clientX - dragPosition.x) / bounds.width;
                    const deltaY = (event.clientY - dragPosition.y) / bounds.height;

                    userRotation.y += deltaX * 3;
                    userRotation.x = THREE.MathUtils.clamp(userRotation.x + deltaY * 2.25, -0.75, 0.75);
                    rotationVelocity.set(deltaY * 0.12, deltaX * 0.12);
                    dragPosition.set(event.clientX, event.clientY);
                    event.preventDefault();

                    if (reducedMotion) renderStatic();
                };
                const onPointerEnd = (event: PointerEvent) => {
                    if (event.pointerId === activePointerId) activePointerId = null;
                };
                window.addEventListener('pointerdown', onPointerDown);
                window.addEventListener('pointermove', onPointerMove);
                window.addEventListener('pointerup', onPointerEnd);
                window.addEventListener('pointercancel', onPointerEnd);

                let frameId = 0;
                const render = (milliseconds = 0) => {
                    const seconds = milliseconds / 1000;

                    if (!reducedMotion) {
                        if (activePointerId === null) {
                            userRotation.x = THREE.MathUtils.clamp(userRotation.x + rotationVelocity.x, -0.75, 0.75);
                            userRotation.y += rotationVelocity.y;
                            rotationVelocity.multiplyScalar(0.94);
                        }
                        core.rotation.set(seconds * 0.09, seconds * 0.13, seconds * 0.05);
                        corePoints.rotation.copy(core.rotation);
                        dust.rotation.y = seconds * 0.012;

                        rings.forEach((ring, index) => {
                            ring.rotation.z = seconds * (index % 2 === 0 ? 0.05 : -0.04);
                        });
                        orbitalNodes.forEach((node) => {
                            const angle = seconds * node.speed + node.offset;
                            node.mesh.position.set(
                                Math.cos(angle) * node.radius,
                                Math.sin(angle) * node.radius * 0.45,
                                0,
                            );
                            node.mesh.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), node.tilt);
                        });
                    }

                    network.rotation.set(userRotation.x, userRotation.y, 0);

                    renderer.render(scene, camera);
                    if (!reducedMotion) frameId = window.requestAnimationFrame(render);
                };
                renderStatic = () => render(performance.now());
                render();

                const resizeObserver = new ResizeObserver(resize);
                resizeObserver.observe(host);
                const themeObserver = new MutationObserver(updateColors);
                themeObserver.observe(document.documentElement, {
                    attributes: true,
                    attributeFilter: ['class', 'style'],
                });

                cleanup = () => {
                    window.cancelAnimationFrame(frameId);
                    window.removeEventListener('pointerdown', onPointerDown);
                    window.removeEventListener('pointermove', onPointerMove);
                    window.removeEventListener('pointerup', onPointerEnd);
                    window.removeEventListener('pointercancel', onPointerEnd);
                    resizeObserver.disconnect();
                    themeObserver.disconnect();
                    coreGeometry.dispose();
                    pointGeometry.dispose();
                    interactionGeometry.dispose();
                    satelliteGeometry.dispose();
                    dustGeometry.dispose();
                    primaryMaterial.dispose();
                    coreMaterial.dispose();
                    ringMaterial.dispose();
                    satelliteMaterial.dispose();
                    dustMaterial.dispose();
                    interactionMaterial.dispose();
                    rings.forEach((ring) => ring.geometry.dispose());
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

    return <div ref={hostRef} aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-90" />;
}

export function OttabaseHero({ appName }: OttabaseHeroProps) {
    return (
        <section
            aria-labelledby="ottabase-hero-heading"
            className="relative isolate overflow-hidden rounded-[2rem] border border-border/70 bg-card shadow-2xl shadow-primary/5"
        >
            <HeroScene />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(108deg,hsl(var(--card))_0%,hsl(var(--card)/0.96)_42%,hsl(var(--card)/0.28)_75%,hsl(var(--card)/0.8)_100%)] dark:bg-[linear-gradient(108deg,hsl(var(--card))_0%,hsl(var(--card)/0.92)_42%,hsl(var(--card)/0.25)_75%,hsl(var(--card)/0.78)_100%)]" />
            <div className="pointer-events-none absolute -right-28 top-1/2 h-80 w-80 -translate-y-1/2 rounded-full bg-primary/20 blur-[110px]" />

            <div className="relative z-10 flex min-h-[40rem] flex-col justify-between px-6 py-8 sm:px-10 sm:py-10 lg:min-h-[42rem] lg:px-14 lg:py-14">
                <div className="max-w-2xl">
                    <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-background/75 px-3 py-1.5 text-xs font-semibold tracking-[0.16em] text-primary shadow-sm backdrop-blur">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_14px_hsl(var(--primary))]" />
                        {appName} / EDGE-NATIVE FOUNDATION
                    </div>
                    <h1
                        id="ottabase-hero-heading"
                        className="leading-relaxed max-w-xl font-bold bg-gradient-to-r from-primary via-primary to-foreground bg-clip-text text-transparent tracking-[-0.065em] text-foreground text-5xl sm:text-6xl lg:text-7xl"
                    >
                        Ship your thing.
                        <span className="block font-normal text-black dark:text-white text-3xl sm:text-4xl lg:text-5xl">
                            Not the thing before the thing.
                        </span>
                    </h1>
                    <p className="mt-7 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                        A Cloudflare-native foundation for production SaaS, apps, and content sites — with tenancy,
                        auth, RLS, theming, media, and 50+ packages already wired together.
                    </p>
                    <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                        <Button asChild size="lg" className="group gap-2 rounded-full px-6 shadow-lg shadow-primary/20">
                            <Link to="/docs">
                                Start building
                                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                            </Link>
                        </Button>
                        <Button
                            asChild
                            size="lg"
                            variant="outline"
                            className="rounded-full border-border/80 bg-background/65 px-6 backdrop-blur hover:bg-background hover:text-primary"
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
                        label="Build faster"
                        detail="50+ connected packages"
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
