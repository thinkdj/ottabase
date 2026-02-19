/**
 * Currency information interface
 */
interface CurrencyInfo {
    cur: string;
    symbol: string;
    description: string;
    locale: string;
}

/**
 * Parse a currency string and extract the numeric value.
 * @example parseCurrencyValue("₹1,112.78") // 1112.78
 */
export function parseCurrencyValue(input: string | number): number | null {
    if (input === null || input === undefined) return null;

    const inputStr = String(input);
    // Remove all non-numeric characters except the decimal point
    const numericString = inputStr.replace(/[^\d.]/g, '');
    const result = parseFloat(numericString);

    if (isNaN(result)) {
        return null;
    }
    return result;
}

/**
 * Format a numeric value as currency with proper locale formatting.
 */
export function formatCurrencyValue(value: number, currencyCode: string, decimalPlaces: number = 2): string {
    if (typeof value !== 'number' || isNaN(value)) return '';

    const currencyInfo = CURRENCY_MAP.find((currency) => currency.cur === currencyCode);
    if (!currencyInfo) {
        return '';
    }

    const formattedValue = value.toLocaleString(currencyInfo.locale, {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces,
    });

    return formattedValue;
}

/**
 * Get the currency symbol for a given currency code.
 */
export function getCurrencySymbol(currencyCode: string): string {
    if (!currencyCode) return '';

    const currObj = CURRENCY_MAP.find((c) => c.cur === currencyCode);
    return currObj?.symbol ?? '';
}

/**
 * Get currency information for a given currency code.
 */
export function getCurrencyInfo(currencyCode: string): CurrencyInfo | null {
    if (!currencyCode) return null;
    return CURRENCY_MAP.find((c) => c.cur === currencyCode) ?? null;
}

/**
 * Get all supported currencies.
 */
export function getSupportedCurrencies(): CurrencyInfo[] {
    return [...CURRENCY_MAP];
}

const CURRENCY_MAP = [
    { cur: 'INR', symbol: '₹', description: 'Indian Rupee', locale: 'en-IN' },
    { cur: 'USD', symbol: '$', description: 'US Dollar', locale: 'en-US' },
    { cur: 'EUR', symbol: '€', description: 'Euro', locale: 'de-DE' },
    { cur: 'GBP', symbol: '£', description: 'British Pound', locale: 'en-GB' },
    { cur: 'JPY', symbol: '¥', description: 'Japanese Yen', locale: 'ja-JP' },
    {
        cur: 'AUD',
        symbol: 'A$',
        description: 'Australian Dollar',
        locale: 'en-AU',
    },
    { cur: 'CAD', symbol: 'C$', description: 'Canadian Dollar', locale: 'en-CA' },
    { cur: 'CHF', symbol: 'CHF', description: 'Swiss Franc', locale: 'de-CH' },
    { cur: 'CNY', symbol: '¥', description: 'Chinese Yuan', locale: 'zh-CN' },
    { cur: 'SEK', symbol: 'kr', description: 'Swedish Krona', locale: 'sv-SE' },
    {
        cur: 'NZD',
        symbol: 'NZ$',
        description: 'New Zealand Dollar',
        locale: 'en-NZ',
    },
    { cur: 'BRL', symbol: 'R$', description: 'Brazilian Real', locale: 'pt-BR' },
    { cur: 'RUB', symbol: '₽', description: 'Russian Ruble', locale: 'ru-RU' },
    { cur: 'MXN', symbol: '$', description: 'Mexican Peso', locale: 'es-MX' },
    { cur: 'KRW', symbol: '₩', description: 'South Korean Won', locale: 'ko-KR' },
    { cur: 'SAR', symbol: '﷼', description: 'Saudi Riyal', locale: 'ar-SA' },
    { cur: 'TRY', symbol: '₺', description: 'Turkish Lira', locale: 'tr-TR' },
    {
        cur: 'SGD',
        symbol: 'S$',
        description: 'Singapore Dollar',
        locale: 'en-SG',
    },
    {
        cur: 'HKD',
        symbol: 'HK$',
        description: 'Hong Kong Dollar',
        locale: 'zh-HK',
    },
];
