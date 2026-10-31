import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CredentialsForm, LoginForm, MagicLinkForm, RegisterForm } from '../components';

// The `botCheck` slot (a Turnstile widget) renders inside the form, above its submit button.
const bot = <div data-testid="bot-check" />;
const noop = async () => undefined;

function botBeforeSubmit(html: string): boolean {
    const at = html.indexOf('data-testid="bot-check"');
    return at !== -1 && at < html.indexOf('type="submit"') && html.lastIndexOf('<form', at) !== -1;
}

describe('botCheck slot', () => {
    it.each([
        ['CredentialsForm', <CredentialsForm onSubmit={noop} botCheck={bot} />],
        ['MagicLinkForm', <MagicLinkForm onSubmit={noop} botCheck={bot} />],
        ['RegisterForm', <RegisterForm onSubmit={noop} botCheck={bot} />],
    ])('%s renders it above the submit button', (_name, element) => {
        expect(botBeforeSubmit(renderToStaticMarkup(element))).toBe(true);
    });

    it('LoginForm hands its one widget to the method that is showing', () => {
        const both = renderToStaticMarkup(
            <LoginForm showCredentials showMagicLink onCredentialsLogin={noop} onMagicLinkSend={noop} botCheck={bot} />,
        );
        const magicOnly = renderToStaticMarkup(
            <LoginForm showCredentials={false} showMagicLink onMagicLinkSend={noop} botCheck={bot} />,
        );

        expect(both.split('data-testid="bot-check"').length - 1).toBe(1);
        expect(botBeforeSubmit(both)).toBe(true);
        expect(botBeforeSubmit(magicOnly)).toBe(true);
    });

    it('renders nothing extra without one', () => {
        expect(renderToStaticMarkup(<CredentialsForm onSubmit={noop} />)).not.toContain('bot-check');
    });
});
