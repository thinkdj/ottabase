/**
 * "Language and region" settings: the locale that drives language plus number and date formats,
 * and the IANA timezone. Options come from Intl (no hand-written zone list), labels are shown in
 * the language itself, and a live preview shows what the choice does.
 */
import { LOCALE_REGIONS, SUPPORTED_LANGUAGES } from '../../../ottabase/locale';
import { OttaSelect, type OttaSelectItem } from '@ottabase/ottaselect';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Label } from '@ottabase/ui';
import { Globe2, MonitorSmartphone } from 'lucide-react';
import { useMemo } from 'react';

export interface LanguageRegionCardProps {
    locale: string;
    timezone: string;
    onChange: (field: 'locale' | 'timezone', value: string) => void;
    disabled?: boolean;
}

interface TimezoneItem extends OttaSelectItem {
    group: string;
}

/** "English (United Kingdom)" spelled in that language. */
function localeLabel(tag: string): string {
    try {
        const [language, region] = tag.split('-');
        const names = new Intl.DisplayNames([tag], { type: 'language' });
        const regions = new Intl.DisplayNames([tag], { type: 'region' });
        const lang = names.of(language) ?? language;
        const reg = region ? (regions.of(region) ?? region) : null;
        const text = reg ? `${lang} (${reg})` : lang;
        return text.charAt(0).toUpperCase() + text.slice(1);
    } catch {
        return tag;
    }
}

function offsetLabel(zone: string, now: Date): { offset: string; time: string } {
    try {
        const parts = new Intl.DateTimeFormat('en', { timeZone: zone, timeZoneName: 'longOffset' }).formatToParts(now);
        const raw = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
        const offset = raw === 'GMT' ? 'UTC+00:00' : raw.replace('GMT', 'UTC');
        const time = new Intl.DateTimeFormat('en', { timeZone: zone, hour: '2-digit', minute: '2-digit' }).format(now);
        return { offset, time };
    } catch {
        return { offset: '', time: '' };
    }
}

/** Every zone Intl knows, grouped by its region prefix, with the current offset and local time. */
export function buildTimezoneItems(now = new Date()): TimezoneItem[] {
    const zones: string[] = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : ['UTC'];
    if (!zones.includes('UTC')) zones.push('UTC');
    return zones.map((zone) => {
        const [region, ...rest] = zone.split('/');
        const city = rest.join(' / ').replace(/_/g, ' ') || zone;
        const { offset, time } = offsetLabel(zone, now);
        return { id: zone, name: `${city} (${offset}) ${time}`.trim(), group: rest.length ? region : 'Other' };
    });
}

export function buildLocaleItems(): OttaSelectItem[] {
    return SUPPORTED_LANGUAGES.flatMap((language) =>
        LOCALE_REGIONS[language].map((region) => {
            const tag = `${language}-${region}`;
            return { id: tag, name: localeLabel(tag) };
        }),
    );
}

export function LanguageRegionCard({ locale, timezone, onChange, disabled }: LanguageRegionCardProps) {
    const deviceZone = useMemo(() => {
        try {
            return Intl.DateTimeFormat().resolvedOptions().timeZone;
        } catch {
            return 'UTC';
        }
    }, []);
    const localeItems = useMemo(buildLocaleItems, []);
    const timezoneItems = useMemo(() => buildTimezoneItems(), []);

    const localeValue = useMemo<OttaSelectItem | null>(
        () => (locale ? (localeItems.find((i) => i.id === locale) ?? { id: locale, name: localeLabel(locale) }) : null),
        [locale, localeItems],
    );
    const timezoneValue = useMemo<OttaSelectItem | null>(
        () => (timezone ? (timezoneItems.find((i) => i.id === timezone) ?? { id: timezone, name: timezone }) : null),
        [timezone, timezoneItems],
    );

    const preview = useMemo(() => {
        const now = new Date();
        try {
            const tag = locale || undefined;
            const zone = timezone || undefined;
            return [
                new Intl.DateTimeFormat(tag, { dateStyle: 'full', timeZone: zone }).format(now),
                new Intl.DateTimeFormat(tag, { timeStyle: 'short', timeZone: zone }).format(now),
                new Intl.NumberFormat(tag).format(1234567.89),
            ].join(' · ');
        } catch {
            return '';
        }
    }, [locale, timezone]);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[0.9375rem] font-semibold">
                    <Globe2 className="h-4 w-4 text-muted-foreground" />
                    Language and region
                </CardTitle>
                <CardDescription>How dates, times and numbers are shown to you, and in which language.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <Label htmlFor="locale">Language and formats</Label>
                    <OttaSelect
                        mode="single"
                        items={localeItems}
                        value={localeValue}
                        onChange={(v) => onChange('locale', (v as OttaSelectItem | null)?.id ?? '')}
                        placeholder="Select language and region"
                        searchable
                        searchPlaceholder="Search languages..."
                        disabled={disabled}
                        clearable={false}
                        className="w-full"
                    />
                    {preview && <p className="text-sm text-muted-foreground">Preview: {preview}</p>}
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                        <Label htmlFor="timezone">Timezone</Label>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={disabled || timezone === deviceZone}
                            onClick={() => onChange('timezone', deviceZone)}
                        >
                            <MonitorSmartphone className="mr-1.5 h-3.5 w-3.5" />
                            Use this device&apos;s timezone
                        </Button>
                    </div>
                    <OttaSelect
                        mode="single"
                        items={timezoneItems}
                        value={timezoneValue}
                        onChange={(v) => onChange('timezone', (v as OttaSelectItem | null)?.id ?? '')}
                        placeholder="Select timezone"
                        searchable
                        searchPlaceholder="Search timezones..."
                        disabled={disabled}
                        clearable={false}
                        className="w-full"
                    />
                    <p className="text-sm text-muted-foreground">
                        {timezone && timezone !== deviceZone
                            ? `Your device is on ${deviceZone}.`
                            : 'Used for displaying dates and times in your local timezone.'}
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}
