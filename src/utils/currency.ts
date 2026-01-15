
export const getCurrencySymbol = (currency?: string): string => {
    if (!currency) return '$'; // Default to USD

    const symbols: Record<string, string> = {
        'USD': '$',
        'EUR': '€',
        'GBP': '£',
        'JPY': '¥',
        'CNY': '¥',
        'CAD': 'C$',
        'AUD': 'A$',
        'NZD': 'NZ$',
        'HKD': 'HK$',
        'SGD': 'S$',
        'CHF': 'CHF ',
        'INR': '₹',
        'MXN': 'MX$',
        'BRL': 'R$',
        'KRW': '₩',
        'SEK': 'kr ',
        'NOK': 'kr ',
        'DKK': 'kr ',
        'PLN': 'zł',
        'ZAR': 'R',
        'THB': '฿',
        'IDR': 'Rp',
        'MYR': 'RM',
        'PHP': '₱',
        'TRY': '₺',
        'RUB': '₽',
    };

    return symbols[currency.toUpperCase()] || currency.toUpperCase() + ' ';
};

export const formatCurrency = (amount: number, currency?: string): string => {
    const symbol = getCurrencySymbol(currency);
    // Separate symbol from number to allow easier styling if needed, keeping it simple for now
    return `${symbol}${Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
