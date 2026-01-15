/**
 * Animated Step Icons for Journal Entry workflow
 * Three distinct animated SVG icons representing the 3-step process
 */

interface IconProps {
    className?: string;
    size?: number;
}

/**
 * Animated Pie Chart Icon - segments fill in sequentially
 * Represents: Transactions being converted/categorized
 */
export function AnimatedPieChartIcon({ className = "", size = 80 }: IconProps) {
    return (
        <div className={`relative ${className}`} style={{ width: size, height: size }}>
            <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                <defs>
                    <linearGradient id="pieSegment1" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#f97316" />
                        <stop offset="100%" stopColor="#ea580c" />
                    </linearGradient>
                    <linearGradient id="pieSegment2" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#22c55e" />
                        <stop offset="100%" stopColor="#16a34a" />
                    </linearGradient>
                    <linearGradient id="pieSegment3" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#65D3FD" />
                        <stop offset="100%" stopColor="#4BA0FE" />
                    </linearGradient>
                </defs>

                {/* Background circle */}
                <circle cx="40" cy="42" r="26" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />

                {/* Pie segments with sequential fill animation */}
                <g transform="translate(40, 42)">
                    {/* Orange segment (largest ~45%) */}
                    <path
                        d="M 0 0 L 0 -24 A 24 24 0 0 1 22 10 Z"
                        fill="url(#pieSegment1)"
                    >
                        <animate
                            attributeName="opacity"
                            values="0.3;1;1;0.3"
                            dur="3s"
                            repeatCount="indefinite"
                            keyTimes="0;0.2;0.8;1"
                        />
                    </path>

                    {/* Green segment (~30%) */}
                    <path
                        d="M 0 0 L 22 10 A 24 24 0 0 1 -12 21 Z"
                        fill="url(#pieSegment2)"
                    >
                        <animate
                            attributeName="opacity"
                            values="0.3;0.3;1;1;0.3"
                            dur="3s"
                            repeatCount="indefinite"
                            keyTimes="0;0.2;0.4;0.8;1"
                        />
                    </path>

                    {/* Blue segment (~25%) */}
                    <path
                        d="M 0 0 L -12 21 A 24 24 0 0 1 0 -24 Z"
                        fill="url(#pieSegment3)"
                    >
                        <animate
                            attributeName="opacity"
                            values="0.3;0.3;0.3;1;1"
                            dur="3s"
                            repeatCount="indefinite"
                            keyTimes="0;0.2;0.4;0.6;1"
                        />
                    </path>
                </g>

                {/* Center circle */}
                <circle cx="40" cy="42" r="10" fill="rgba(10,10,15,0.9)" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />

                {/* Animated ring pulse */}
                <circle cx="40" cy="42" r="28" fill="none" stroke="#f97316" strokeWidth="2" opacity="0.3">
                    <animate attributeName="r" values="26;32;26" dur="2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.3;0;0.3" dur="2s" repeatCount="indefinite" />
                </circle>
            </svg>
        </div>
    );
}

/**
 * Animated AI Document Icon - document with scanning sparkle effect
 * Represents: AI analyzing and suggesting journal entries
 */
export function AnimatedAIDocumentIcon({ className = "", size = 80 }: IconProps) {
    return (
        <div className={`relative ${className}`} style={{ width: size, height: size }}>
            <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                <defs>
                    <linearGradient id="sparkleGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#65D3FD" />
                        <stop offset="100%" stopColor="#a855f7" />
                    </linearGradient>
                </defs>

                {/* Document body */}
                <rect
                    x="20"
                    y="12"
                    width="40"
                    height="52"
                    rx="4"
                    fill="rgba(255,255,255,0.08)"
                    stroke="rgba(255,255,255,0.25)"
                    strokeWidth="1.5"
                />

                {/* Document lines (text representation) */}
                <g opacity="0.5">
                    <rect x="26" y="22" width="24" height="3" rx="1.5" fill="rgba(255,255,255,0.4)" />
                    <rect x="26" y="30" width="28" height="3" rx="1.5" fill="rgba(255,255,255,0.3)" />
                    <rect x="26" y="38" width="20" height="3" rx="1.5" fill="rgba(255,255,255,0.3)" />
                    <rect x="26" y="46" width="26" height="3" rx="1.5" fill="rgba(255,255,255,0.3)" />
                    <rect x="26" y="54" width="18" height="3" rx="1.5" fill="rgba(255,255,255,0.3)" />
                </g>

                {/* Scanning line effect */}
                <rect x="20" y="20" width="40" height="4" fill="url(#sparkleGradient)" opacity="0.6" rx="2">
                    <animate attributeName="y" values="12;56;12" dur="2.5s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.6;0.3;0.6" dur="2.5s" repeatCount="indefinite" />
                </rect>

                {/* AI Sparkle/Star */}
                <g>
                    <path
                        d="M58 20 L60 26 L66 28 L60 30 L58 36 L56 30 L50 28 L56 26 Z"
                        fill="url(#sparkleGradient)"
                    >
                        <animate attributeName="opacity" values="1;0.4;1" dur="1.5s" repeatCount="indefinite" />
                    </path>
                </g>

                {/* Secondary smaller sparkle */}
                <path
                    d="M52 48 L53 51 L56 52 L53 53 L52 56 L51 53 L48 52 L51 51 Z"
                    fill="#65D3FD"
                    opacity="0.7"
                >
                    <animate attributeName="opacity" values="0.7;0.2;0.7" dur="2s" repeatCount="indefinite" />
                </path>

                {/* Checkmark appearing */}
                <g opacity="0">
                    <circle cx="52" cy="52" r="8" fill="#22c55e" />
                    <path d="M48 52 L51 55 L56 49" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    <animate attributeName="opacity" values="0;0;0;1;1;0" dur="3s" repeatCount="indefinite" keyTimes="0;0.5;0.6;0.7;0.9;1" />
                </g>
            </svg>
        </div>
    );
}

/**
 * Animated Sync Arrow Icon - upward trending arrow with pulse
 * Represents: Data syncing to accounting software
 */
export function AnimatedSyncArrowIcon({ className = "", size = 80 }: IconProps) {
    return (
        <div className={`relative ${className}`} style={{ width: size, height: size }}>
            <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                <defs>
                    <linearGradient id="arrowGradient" x1="0%" y1="100%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#22c55e" />
                        <stop offset="100%" stopColor="#4ade80" />
                    </linearGradient>
                </defs>

                {/* Background grid/chart lines */}
                <g opacity="0.15">
                    <line x1="15" y1="60" x2="65" y2="60" stroke="white" strokeWidth="1" />
                    <line x1="15" y1="48" x2="65" y2="48" stroke="white" strokeWidth="1" strokeDasharray="2 2" />
                    <line x1="15" y1="36" x2="65" y2="36" stroke="white" strokeWidth="1" strokeDasharray="2 2" />
                    <line x1="15" y1="24" x2="65" y2="24" stroke="white" strokeWidth="1" strokeDasharray="2 2" />
                </g>

                {/* Trending line path */}
                <path
                    d="M 18 55 Q 28 50, 35 42 T 50 28 T 62 18"
                    stroke="url(#arrowGradient)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    fill="none"
                >
                    <animate
                        attributeName="stroke-dasharray"
                        values="0 100;100 0"
                        dur="2s"
                        repeatCount="indefinite"
                    />
                </path>

                {/* Arrow head */}
                <g>
                    <path
                        d="M 56 24 L 64 16 L 58 28 Z"
                        fill="url(#arrowGradient)"
                    >
                        <animate attributeName="opacity" values="0;1;1;0" dur="2s" repeatCount="indefinite" keyTimes="0;0.3;0.8;1" />
                    </path>
                </g>

                {/* Pulse rings at end point */}
                <circle cx="62" cy="18" r="4" fill="none" stroke="#4ade80" strokeWidth="1.5">
                    <animate attributeName="r" values="4;12;4" dur="1.5s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.6;0;0.6" dur="1.5s" repeatCount="indefinite" />
                </circle>
                <circle cx="62" cy="18" r="4" fill="none" stroke="#4ade80" strokeWidth="1">
                    <animate attributeName="r" values="4;16;4" dur="1.5s" repeatCount="indefinite" begin="0.3s" />
                    <animate attributeName="opacity" values="0.4;0;0.4" dur="1.5s" repeatCount="indefinite" begin="0.3s" />
                </circle>

                {/* Small data dots moving up */}
                <circle cx="25" cy="52" r="3" fill="#65D3FD">
                    <animate attributeName="cy" values="55;30;55" dur="2.5s" repeatCount="indefinite" />
                    <animate attributeName="cx" values="20;45;20" dur="2.5s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.8;0.4;0.8" dur="2.5s" repeatCount="indefinite" />
                </circle>
                <circle cx="35" cy="45" r="2" fill="#a855f7">
                    <animate attributeName="cy" values="50;25;50" dur="3s" repeatCount="indefinite" begin="0.5s" />
                    <animate attributeName="cx" values="28;55;28" dur="3s" repeatCount="indefinite" begin="0.5s" />
                    <animate attributeName="opacity" values="0.6;0.3;0.6" dur="3s" repeatCount="indefinite" begin="0.5s" />
                </circle>
            </svg>
        </div>
    );
}
