import { AnimateOnView } from '@/components/core/AnimateOnView';

export function MetricsStrip() {
    return (
        <AnimateOnView className="metrics" delayClass="animate-delay-1">
            <div className="container metrics-grid" aria-label="Ottabase by the numbers">
                <div className="metric">
                    <span className="metric-value">47</span>
                    <span className="metric-label">packages</span>
                </div>
                <div className="metric">
                    <span className="metric-value">100%</span>
                    <span className="metric-label">TypeScript</span>
                </div>
                <div className="metric">
                    <span className="metric-value">~$5</span>
                    <span className="metric-label">per month</span>
                </div>
                <div className="metric">
                    <span className="metric-value">300+</span>
                    <span className="metric-label">edge locations</span>
                </div>
                <div className="metric">
                    <span className="metric-value">0</span>
                    <span className="metric-label">servers to manage</span>
                </div>
            </div>
        </AnimateOnView>
    );
}
