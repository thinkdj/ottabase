/**
 * FuzzyDateField: React mount for the @ottabase/ottadate fuzzy picker.
 *
 * Controlled: `value` in, `onChange` out. The vanilla picker is created once;
 * later `value` changes (e.g. loading a different post) are pushed in with
 * setValue, and the picker's own emissions round-trip without a reset because
 * they come back as the same object.
 */

import {
    DEFAULT_RESOLUTIONS,
    OttaDate,
    type FuzzyDateTime,
    type FuzzyDateTimePickerInstance,
} from '@ottabase/ottadate';
import '@ottabase/ottadate/styles.css';
import { useEffect, useRef } from 'react';

/** Decades on top of the defaults: "Sometime in the 1990s" is a valid memory */
const RESOLUTIONS = ['decade' as const, ...DEFAULT_RESOLUTIONS];

export interface FuzzyDateFieldProps {
    value: FuzzyDateTime | null;
    onChange: (value: FuzzyDateTime | null) => void;
    placeholder?: string;
    id?: string;
}

export function FuzzyDateField({ value, onChange, placeholder, id }: FuzzyDateFieldProps) {
    const hostRef = useRef<HTMLDivElement>(null);
    const pickerRef = useRef<FuzzyDateTimePickerInstance | null>(null);
    const onChangeRef = useRef(onChange);
    // Mount-time props; later changes are pushed in by the effects below
    const initialRef = useRef({ value, placeholder, id });

    useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);

    useEffect(() => {
        const initial = initialRef.current;
        const picker = OttaDate.createFuzzyDateTimePicker(hostRef.current!, {
            value: initial.value,
            placeholder: initial.placeholder,
            resolutions: RESOLUTIONS,
            onChange: (next) => onChangeRef.current(next),
        });
        if (initial.id) picker.element.querySelector('.ottadate-trigger-main')?.setAttribute('id', initial.id);
        pickerRef.current = picker;
        return () => {
            picker.destroy();
            pickerRef.current = null;
        };
    }, []);

    useEffect(() => {
        const picker = pickerRef.current;
        if (picker && picker.getValue() !== value) picker.setValue(value);
    }, [value]);

    useEffect(() => {
        if (placeholder !== undefined) pickerRef.current?.setOptions({ placeholder });
    }, [placeholder]);

    return <div ref={hostRef} />;
}
