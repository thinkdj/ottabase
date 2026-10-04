// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LoginForm } from '../components/LoginForm';
import { PasswordChecklist } from '../components/PasswordFields';
import { RegisterForm } from '../components/RegisterForm';

const noop = async () => {};

// Radix Checkbox measures itself; jsdom has no ResizeObserver
globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
} as unknown as typeof ResizeObserver;

describe('LoginForm', () => {
    it('keeps the typed email when switching between password and email link', () => {
        render(<LoginForm showMagicLink onCredentialsLogin={noop} onMagicLinkSend={noop} />);
        fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ada@example.com' } });

        fireEvent.mouseDown(screen.getByRole('tab', { name: 'Email link' }));

        expect(screen.getByRole('tab', { name: 'Email link' })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByLabelText('Email')).toHaveValue('ada@example.com');
    });

    it('hands the typed email to forgot password', () => {
        const onForgotPassword = vi.fn();
        render(<LoginForm onCredentialsLogin={noop} onForgotPassword={onForgotPassword} />);
        fireEvent.change(screen.getByLabelText('Email'), { target: { value: ' ada@example.com ' } });

        fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }));

        expect(onForgotPassword).toHaveBeenCalledWith('ada@example.com');
    });

    it('shows where the link went and resets without a reload', () => {
        const onMagicLinkReset = vi.fn();
        const { rerender } = render(
            <LoginForm
                showCredentials={false}
                showMagicLink
                onMagicLinkSend={noop}
                onMagicLinkReset={onMagicLinkReset}
            />,
        );
        fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ada@example.com' } });
        rerender(
            <LoginForm
                showCredentials={false}
                showMagicLink
                onMagicLinkSend={noop}
                onMagicLinkReset={onMagicLinkReset}
                magicLinkSuccess
            />,
        );

        expect(screen.getByRole('status')).toHaveTextContent('ada@example.com');
        fireEvent.click(screen.getByRole('button', { name: 'try again' }));
        expect(onMagicLinkReset).toHaveBeenCalled();
    });

    it('shows errors even when only social sign-in is offered', () => {
        render(
            <LoginForm
                showCredentials={false}
                socialProviders={[{ id: 'github', name: 'GitHub' }]}
                onSocialLogin={() => {}}
                error="Provider unavailable"
            />,
        );
        expect(screen.getByRole('alert')).toHaveTextContent('Provider unavailable');
    });
});

describe('PasswordChecklist', () => {
    it('ticks off the rules the password meets', () => {
        render(<PasswordChecklist password="abc" />);
        expect(screen.getByText('A lowercase letter')).toHaveTextContent('(done)');
        expect(screen.getByText('A symbol')).toHaveTextContent('(missing)');
    });
});

describe('RegisterForm', () => {
    it('links each error to its field and focuses the first one', () => {
        const onSubmit = vi.fn();
        render(<RegisterForm onSubmit={onSubmit} />);
        fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Ada Lovelace' } });
        fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ada@example.com' } });
        fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'weak' } });

        fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

        const password = screen.getByLabelText('Password');
        expect(onSubmit).not.toHaveBeenCalled();
        expect(password).toHaveAttribute('aria-invalid', 'true');
        expect(password).toHaveFocus();
        const described = password
            .getAttribute('aria-describedby')!
            .split(' ')
            .map((id) => document.getElementById(id)?.textContent ?? '')
            .join(' ');
        expect(described).toMatch(/Tick off every item above/);
        expect(described).toMatch(/8\+ characters/);
    });

    it('submits trimmed values once everything is valid', async () => {
        const onSubmit = vi.fn(async () => {});
        render(<RegisterForm onSubmit={onSubmit} />);
        fireEvent.change(screen.getByLabelText('Full name'), { target: { value: ' Ada ' } });
        fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ada@example.com ' } });
        fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Abcdef1!' } });
        fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'Abcdef1!' } });

        fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

        expect(onSubmit).toHaveBeenCalledWith({
            name: 'Ada',
            email: 'ada@example.com',
            password: 'Abcdef1!',
            confirmPassword: 'Abcdef1!',
        });
    });
});
