import { RenderFn } from 'editorjs-blocks-react-renderer';

export interface StepItem {
    title?: string;
    content?: string;
}

export interface StepsData {
    items?: StepItem[];
}

const Steps: RenderFn<StepsData> = ({ data, className = '' }) => {
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
        <section className={`${className} my-6 not-prose cdc-content-steps`} aria-label="Step list">
            <div role="list">
                {items.map((item, index) => (
                    <div
                        key={`${item.title}-${index}`}
                        className="cdc-steps-item"
                        role="listitem"
                        data-step-index={index + 1}
                    >
                        {/* Rail: badge + connecting line */}
                        <div className="cdc-steps-rail" aria-hidden="true">
                            <div className="cdc-steps-badge">{index + 1}</div>
                            {index < items.length - 1 ? <div className="cdc-steps-line" /> : null}
                        </div>

                        {/* Content: title + description */}
                        <article className="cdc-steps-content">
                            {item.title ? <h3 className="cdc-steps-title">{item.title}</h3> : null}
                            {item.content ? (
                                <p className={`cdc-steps-text${item.title ? '' : ' cdc-steps-text--no-title'}`}>
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
