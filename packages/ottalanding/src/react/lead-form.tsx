'use client';

// The public half of the contact and signup sections: a small form that posts to the landing
// app's LEAD_ENDPOINT. Themes pass their own class names; behaviour is shared.

import { api, getErrorMessage, isApiError } from '@ottabase/api';
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { LEAD_ENDPOINT, type LeadKind } from '../leads';

export type LeadFormClasses = {
    input: string;
    button: string;
    /** Visible labels (contact). The signup form labels its one field for screen readers only. */
    label: string;
    /** The thank-you note. */
    note: string;
    /** Field and form errors. */
    error: string;
};

const BUTTON = { contact: 'Send message', signup: 'Join the waitlist' } as const;
const THANKS = { contact: 'Thanks! We’ll get back to you soon.', signup: 'You’re on the list!' } as const;

type LeadFormProps = {
    kind: LeadKind;
    buttonLabel?: string;
    successMessage?: string;
    classes: LeadFormClasses;
};

export function LeadForm({ kind, buttonLabel, successMessage, classes }: LeadFormProps) {
    const id = useId();
    const startedAt = useRef(0);
    const thanks = useRef<HTMLParagraphElement>(null);
    const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [failure, setFailure] = useState<string>();

    // Time spent on the form is one of the bot checks (see LEAD_MIN_FILL_MS).
    useEffect(() => {
        startedAt.current = Date.now();
    }, []);
    useEffect(() => {
        if (state === 'sent') thanks.current?.focus();
    }, [state]);

    const submit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fields = Object.fromEntries(new FormData(e.currentTarget));
        setState('sending');
        setErrors({});
        setFailure(undefined);
        try {
            await api(LEAD_ENDPOINT, {
                method: 'POST',
                body: { ...fields, kind, pagePath: location.pathname, elapsedMs: Date.now() - startedAt.current },
            });
            setState('sent');
        } catch (error) {
            setState('idle');
            if (isApiError(error) && error.fieldErrors) {
                setErrors(Object.fromEntries(Object.entries(error.fieldErrors).map(([k, v]) => [k, v[0] ?? ''])));
            } else {
                setFailure(getErrorMessage(error));
            }
        }
    };

    if (state === 'sent') {
        return (
            <p ref={thanks} tabIndex={-1} role="status" className={`${classes.note} outline-none`}>
                {successMessage || THANKS[kind]}
            </p>
        );
    }

    const field = (name: 'name' | 'email' | 'message', label: string, control: (props: object) => ReactNode) => {
        const fieldId = `${id}-${name}`;
        const error = errors[name];
        return (
            <div className="grid min-w-0 flex-1 gap-1.5">
                <label htmlFor={fieldId} className={kind === 'signup' ? 'sr-only' : classes.label}>
                    {label}
                </label>
                {control({
                    id: fieldId,
                    name,
                    required: true,
                    className: classes.input,
                    'aria-invalid': error ? true : undefined,
                    'aria-describedby': error ? `${fieldId}-error` : undefined,
                })}
                {error && (
                    <p id={`${fieldId}-error`} className={classes.error}>
                        {error}
                    </p>
                )}
            </div>
        );
    };

    return (
        <form
            onSubmit={submit}
            className={kind === 'signup' ? 'flex flex-col gap-3 sm:flex-row sm:items-start' : 'grid gap-5'}
        >
            {kind === 'contact' &&
                field('name', 'Name', (p) => <input {...p} type="text" autoComplete="name" maxLength={120} />)}
            {field('email', 'Email', (p) => (
                <input {...p} type="email" autoComplete="email" maxLength={254} placeholder="you@example.com" />
            ))}
            {kind === 'contact' && field('message', 'Message', (p) => <textarea {...p} rows={5} maxLength={4000} />)}
            {/* A field people never see; bots fill it in (see LandingLead.submit). */}
            <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
                <label>
                    Website
                    <input type="text" name="website" tabIndex={-1} autoComplete="off" />
                </label>
            </div>
            <button type="submit" disabled={state === 'sending'} className={`${classes.button} shrink-0`}>
                {state === 'sending' ? 'Sending…' : buttonLabel || BUTTON[kind]}
            </button>
            {failure && (
                <p role="alert" className={`${classes.error} sm:basis-full`}>
                    {failure}
                </p>
            )}
        </form>
    );
}
