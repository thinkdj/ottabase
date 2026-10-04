import React, { useState } from 'react';
import { Input } from '@ottabase/ui-shadcn';
import { Check, Eye, EyeOff } from 'lucide-react';
import { checkPassword } from '../password';

export type PasswordInputProps = Omit<React.ComponentProps<typeof Input>, 'type'>;

/** Password field with a show/hide toggle, so people can check what they typed on a phone */
export function PasswordInput({ className = '', disabled, ...props }: PasswordInputProps) {
    const [visible, setVisible] = useState(false);
    return (
        <div className="relative">
            <Input
                {...props}
                type={visible ? 'text' : 'password'}
                disabled={disabled}
                className={`pr-10 ${className}`}
            />
            <button
                type="button"
                onClick={() => setVisible((v) => !v)}
                disabled={disabled}
                aria-label="Show password"
                aria-pressed={visible}
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
            >
                {visible ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                )}
            </button>
        </div>
    );
}

export interface PasswordChecklistProps {
    password: string;
    /** Point the password input's aria-describedby here */
    id?: string;
    className?: string;
}

/** Live list of the password rules, ticked off while typing */
export function PasswordChecklist({ password, id, className = '' }: PasswordChecklistProps) {
    return (
        <ul id={id} aria-label="Password needs" className={`grid grid-cols-2 gap-x-3 gap-y-1 text-xs ${className}`}>
            {checkPassword(password).map(({ rule, met }) => (
                <li
                    key={rule.id}
                    className={`flex items-center gap-1.5 ${met ? 'text-success' : 'text-muted-foreground'}`}
                >
                    <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center" aria-hidden="true">
                        {met ? <Check className="h-3.5 w-3.5" /> : <span className="h-1 w-1 rounded-full bg-current" />}
                    </span>
                    {rule.label}
                    <span className="sr-only">{met ? ' (done)' : ' (missing)'}</span>
                </li>
            ))}
        </ul>
    );
}
