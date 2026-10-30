import type { BlockRenderer } from '../types';

export interface StepItem {
    title?: string;
    content?: string;
}

export interface StepsData {
    items?: StepItem[];
}

const Steps: BlockRenderer<StepsData> = ({ data, className = '' }) => {
    const items = (data?.items || [])
        .map((item) => ({
            title: item?.title?.trim() || '',
            content: item?.content?.trim() || '',
        }))
        .filter((item) => item.title !== '' || item.content !== '');

    if (!items.length) {
        return null;
    }

    return (
        <section className={`${className} not-prose otta-steps`} aria-label="Step list">
            <div role="list">
                {items.map((item, index) => (
                    <div
                        key={`${item.title}-${index}`}
                        className="otta-steps-item"
                        role="listitem"
                        data-step-index={index + 1}
                    >
                        {/* Rail: badge + connecting line */}
                        <div className="otta-steps-rail" aria-hidden="true">
                            <div className="otta-steps-badge">{index + 1}</div>
                            {index < items.length - 1 ? <div className="otta-steps-line" /> : null}
                        </div>

                        {/* Content: title + description */}
                        <article className="otta-steps-content">
                            {item.title ? <h3 className="otta-steps-title">{item.title}</h3> : null}
                            {item.content ? (
                                /* Textarea content is plain text; the stylesheet's pre-line keeps its line breaks */
                                <p className={`otta-steps-text${item.title ? '' : ' otta-steps-text--no-title'}`}>
                                    {item.content}
                                </p>
                            ) : null}
                        </article>
                    </div>
                ))}
            </div>
        </section>
    );
};

export default Steps;
