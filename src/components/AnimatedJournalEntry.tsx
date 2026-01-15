/**
 * AnimatedJournalEntry - Stylized journal entry visualization
 * Shows animated debit/credit entries with real account names
 */

interface AnimatedJournalEntryProps {
    className?: string;
}

export function AnimatedJournalEntry({ className = "" }: AnimatedJournalEntryProps) {
    return (
        <div className={`relative ${className}`}>
            <svg
                viewBox="0 0 280 200"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-full h-full"
                style={{ minHeight: '180px' }}
            >
                <defs>
                    {/* Document gradient */}
                    <linearGradient id="docBg" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="rgba(255,255,255,0.12)" />
                        <stop offset="100%" stopColor="rgba(255,255,255,0.05)" />
                    </linearGradient>

                    <filter id="cardShadow" x="-10%" y="-10%" width="120%" height="130%">
                        <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="#000" floodOpacity="0.3" />
                    </filter>
                </defs>

                {/* Main Document/Ledger Card */}
                <g filter="url(#cardShadow)">
                    {/* Document background */}
                    <rect
                        x="40"
                        y="20"
                        width="200"
                        height="160"
                        rx="8"
                        fill="url(#docBg)"
                        stroke="rgba(255,255,255,0.15)"
                        strokeWidth="1"
                    />

                    {/* Header bar - using #65D3FD as primary */}
                    <rect
                        x="40"
                        y="20"
                        width="200"
                        height="28"
                        rx="8"
                        fill="rgba(101, 211, 253, 0.15)"
                    />
                    <rect
                        x="40"
                        y="40"
                        width="200"
                        height="8"
                        fill="rgba(101, 211, 253, 0.15)"
                    />
                </g>

                {/* Debit/Credit Column Headers */}
                <text x="170" y="58" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="9" fontFamily="system-ui" fontWeight="500">
                    Debit
                </text>
                <text x="218" y="58" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="9" fontFamily="system-ui" fontWeight="500">
                    Credit
                </text>

                {/* Divider line */}
                <line x1="50" y1="65" x2="230" y2="65" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />

                {/* Entry Row 1 - Office Supplies (Debit) - appears at 1s, stays visible */}
                <g opacity="0">
                    <animate
                        attributeName="opacity"
                        values="0;0;1;1"
                        keyTimes="0;0.1;0.15;1"
                        dur="10s"
                        repeatCount="indefinite"
                        fill="freeze"
                    />

                    {/* Account name */}
                    <text x="55" y="82" fill="rgba(255,255,255,0.8)" fontSize="10" fontFamily="system-ui">
                        Office Supplies
                    </text>

                    {/* Debit amount - using #65D3FD */}
                    <text x="170" y="82" textAnchor="middle" fill="#65D3FD" fontSize="10" fontFamily="monospace" fontWeight="600">
                        $2,500
                    </text>

                    {/* Credit empty */}
                    <text x="218" y="82" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="10" fontFamily="monospace">
                        —
                    </text>
                </g>

                {/* Entry Row 2 - Cash (Credit) - appears at 2.5s */}
                <g opacity="0">
                    <animate
                        attributeName="opacity"
                        values="0;0;1;1"
                        keyTimes="0;0.25;0.3;1"
                        dur="10s"
                        repeatCount="indefinite"
                        fill="freeze"
                    />

                    {/* Account name (indented for credit) */}
                    <text x="65" y="102" fill="rgba(255,255,255,0.7)" fontSize="10" fontFamily="system-ui">
                        Cash
                    </text>

                    {/* Debit empty */}
                    <text x="170" y="102" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="10" fontFamily="monospace">
                        —
                    </text>

                    {/* Credit amount - using #65D3FD */}
                    <text x="218" y="102" textAnchor="middle" fill="#65D3FD" fontSize="10" fontFamily="monospace" fontWeight="600">
                        $2,500
                    </text>
                </g>

                {/* Entry Row 3 - Software Expense (Debit) - appears at 4s */}
                <g opacity="0">
                    <animate
                        attributeName="opacity"
                        values="0;0;1;1"
                        keyTimes="0;0.4;0.45;1"
                        dur="10s"
                        repeatCount="indefinite"
                        fill="freeze"
                    />

                    <text x="55" y="124" fill="rgba(255,255,255,0.8)" fontSize="10" fontFamily="system-ui">
                        Software Expense
                    </text>
                    <text x="170" y="124" textAnchor="middle" fill="#65D3FD" fontSize="10" fontFamily="monospace" fontWeight="600">
                        $1,200
                    </text>
                    <text x="218" y="124" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="10" fontFamily="monospace">
                        —
                    </text>
                </g>

                {/* Entry Row 4 - Accounts Payable (Credit) - appears at 5.5s */}
                <g opacity="0">
                    <animate
                        attributeName="opacity"
                        values="0;0;1;1"
                        keyTimes="0;0.55;0.6;1"
                        dur="10s"
                        repeatCount="indefinite"
                        fill="freeze"
                    />

                    <text x="65" y="144" fill="rgba(255,255,255,0.7)" fontSize="10" fontFamily="system-ui">
                        Accounts Payable
                    </text>
                    <text x="170" y="144" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="10" fontFamily="monospace">
                        —
                    </text>
                    <text x="218" y="144" textAnchor="middle" fill="#65D3FD" fontSize="10" fontFamily="monospace" fontWeight="600">
                        $1,200
                    </text>
                </g>

                {/* Totals divider and amounts - appears at 7s */}
                <g opacity="0">
                    <animate
                        attributeName="opacity"
                        values="0;0;1;1"
                        keyTimes="0;0.7;0.75;1"
                        dur="10s"
                        repeatCount="indefinite"
                        fill="freeze"
                    />
                    <line x1="155" y1="155" x2="230" y2="155" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />

                    {/* Totals */}
                    <text x="170" y="170" textAnchor="middle" fill="#65D3FD" fontSize="10" fontFamily="monospace" fontWeight="700">
                        $3,700
                    </text>
                    <text x="218" y="170" textAnchor="middle" fill="#65D3FD" fontSize="10" fontFamily="monospace" fontWeight="700">
                        $3,700
                    </text>
                </g>

                {/* Success checkmark badge - appears at 8.5s, fades at 10s */}
                <g opacity="0">
                    <animate
                        attributeName="opacity"
                        values="0;0;1;1;0"
                        keyTimes="0;0.85;0.88;0.95;1"
                        dur="10s"
                        repeatCount="indefinite"
                    />

                    <circle cx="225" cy="35" r="10" fill="#22c55e" />
                    <path
                        d="M221 35 L224 38 L230 32"
                        stroke="white"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                    />
                </g>
            </svg>
        </div>
    );
}
