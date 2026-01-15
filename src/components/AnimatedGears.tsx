/**
 * AnimatedGears - Premium meshing gear animation
 * Uses CSS classes for reliable GPU-accelerated animations
 */

import { useEffect, useRef } from 'react';

interface AnimatedGearsProps {
    className?: string;
}

export function AnimatedGears({ className = "" }: AnimatedGearsProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Inject keyframes into document head for reliable animation
        const styleId = 'animated-gears-styles';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
        @keyframes gearSpinCW {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes gearSpinCCW {
          from { transform: rotate(0deg); }
          to { transform: rotate(-360deg); }
        }
        .gear-spin-cw {
          animation: gearSpinCW 10s linear infinite;
          transform-origin: center center;
          will-change: transform;
        }
        .gear-spin-ccw {
          animation: gearSpinCCW 8s linear infinite;
          transform-origin: center center;
          will-change: transform;
        }
        .gear-spin-cw-fast {
          animation: gearSpinCW 5s linear infinite;
          transform-origin: center center;
          will-change: transform;
        }
        .gear-spin-ccw-slow {
          animation: gearSpinCCW 12s linear infinite;
          transform-origin: center center;
          will-change: transform;
        }
      `;
            document.head.appendChild(style);
        }
    }, []);

    // Helper to create gear teeth path
    const createGearPath = (cx: number, cy: number, innerR: number, outerR: number, teeth: number) => {
        const points: string[] = [];
        const toothDepth = (outerR - innerR) * 0.6;
        const toothWidth = (2 * Math.PI) / teeth / 4;

        for (let i = 0; i < teeth; i++) {
            const angle = (i / teeth) * 2 * Math.PI - Math.PI / 2;

            // Inner point before tooth
            const innerX1 = cx + innerR * Math.cos(angle - toothWidth * 1.5);
            const innerY1 = cy + innerR * Math.sin(angle - toothWidth * 1.5);

            // Outer tooth left
            const outerX1 = cx + (innerR + toothDepth) * Math.cos(angle - toothWidth * 0.8);
            const outerY1 = cy + (innerR + toothDepth) * Math.sin(angle - toothWidth * 0.8);

            // Outer tooth tip left
            const tipX1 = cx + outerR * Math.cos(angle - toothWidth * 0.4);
            const tipY1 = cy + outerR * Math.sin(angle - toothWidth * 0.4);

            // Outer tooth tip right
            const tipX2 = cx + outerR * Math.cos(angle + toothWidth * 0.4);
            const tipY2 = cy + outerR * Math.sin(angle + toothWidth * 0.4);

            // Outer tooth right
            const outerX2 = cx + (innerR + toothDepth) * Math.cos(angle + toothWidth * 0.8);
            const outerY2 = cy + (innerR + toothDepth) * Math.sin(angle + toothWidth * 0.8);

            // Inner point after tooth
            const innerX2 = cx + innerR * Math.cos(angle + toothWidth * 1.5);
            const innerY2 = cy + innerR * Math.sin(angle + toothWidth * 1.5);

            if (i === 0) {
                points.push(`M ${innerX1} ${innerY1}`);
            }
            points.push(`L ${outerX1} ${outerY1}`);
            points.push(`L ${tipX1} ${tipY1}`);
            points.push(`L ${tipX2} ${tipY2}`);
            points.push(`L ${outerX2} ${outerY2}`);
            points.push(`L ${innerX2} ${innerY2}`);
        }
        points.push('Z');
        return points.join(' ');
    };

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            <svg
                viewBox="0 0 240 180"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-full h-full"
                style={{ minHeight: '160px' }}
            >
                <defs>
                    {/* Metallic gradient */}
                    <linearGradient id="metalGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#f8f8f8" />
                        <stop offset="25%" stopColor="#e8e8e8" />
                        <stop offset="50%" stopColor="#d0d0d0" />
                        <stop offset="75%" stopColor="#c0c0c0" />
                        <stop offset="100%" stopColor="#a8a8a8" />
                    </linearGradient>

                    {/* Drop shadow */}
                    <filter id="gearDropShadow" x="-15%" y="-15%" width="130%" height="130%">
                        <feDropShadow dx="1" dy="2" stdDeviation="2" floodColor="#000" floodOpacity="0.25" />
                    </filter>
                </defs>

                {/* LARGE GEAR - Main gear on right */}
                <g className="gear-spin-cw" style={{ transformBox: 'fill-box' }} filter="url(#gearDropShadow)">
                    <g transform="translate(165, 95)">
                        <path
                            d={createGearPath(0, 0, 28, 42, 12)}
                            fill="url(#metalGradient)"
                            stroke="rgba(255,255,255,0.5)"
                            strokeWidth="0.5"
                        />
                        {/* Inner rings */}
                        <circle cx="0" cy="0" r="22" fill="none" stroke="rgba(180,180,180,0.8)" strokeWidth="3" />
                        <circle cx="0" cy="0" r="16" fill="rgba(240,240,240,0.3)" stroke="rgba(200,200,200,0.6)" strokeWidth="1" />
                        {/* Center hub */}
                        <circle cx="0" cy="0" r="9" fill="rgba(30,30,35,0.9)" stroke="rgba(150,150,150,0.5)" strokeWidth="1" />
                        {/* Checkmark */}
                        <path
                            d="M-4 0 L-1 3 L5 -3"
                            stroke="#65D3FD"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            fill="none"
                        />
                    </g>
                </g>

                {/* MEDIUM GEAR - Top left, meshes with large gear */}
                <g className="gear-spin-ccw" style={{ transformBox: 'fill-box' }} filter="url(#gearDropShadow)">
                    <g transform="translate(100, 55)">
                        <path
                            d={createGearPath(0, 0, 20, 32, 10)}
                            fill="url(#metalGradient)"
                            stroke="rgba(255,255,255,0.4)"
                            strokeWidth="0.5"
                        />
                        {/* Inner rings */}
                        <circle cx="0" cy="0" r="15" fill="none" stroke="rgba(180,180,180,0.7)" strokeWidth="2" />
                        <circle cx="0" cy="0" r="10" fill="rgba(240,240,240,0.25)" stroke="rgba(200,200,200,0.5)" strokeWidth="1" />
                        {/* Center hub */}
                        <circle cx="0" cy="0" r="6" fill="rgba(30,30,35,0.85)" stroke="rgba(150,150,150,0.4)" strokeWidth="0.75" />
                    </g>
                </g>

                {/* SMALL GEAR - Connector between medium and large */}
                <g className="gear-spin-cw-fast" style={{ transformBox: 'fill-box' }} filter="url(#gearDropShadow)">
                    <g transform="translate(130, 80)">
                        <path
                            d={createGearPath(0, 0, 10, 18, 8)}
                            fill="url(#metalGradient)"
                            stroke="rgba(255,255,255,0.35)"
                            strokeWidth="0.5"
                        />
                        {/* Inner ring */}
                        <circle cx="0" cy="0" r="7" fill="rgba(240,240,240,0.2)" stroke="rgba(200,200,200,0.4)" strokeWidth="0.75" />
                        {/* Center hub */}
                        <circle cx="0" cy="0" r="3.5" fill="rgba(30,30,35,0.8)" stroke="rgba(150,150,150,0.3)" strokeWidth="0.5" />
                    </g>
                </g>

                {/* TINY GEAR - Bottom left accent */}
                <g className="gear-spin-ccw-slow" style={{ transformBox: 'fill-box' }} filter="url(#gearDropShadow)">
                    <g transform="translate(75, 130)">
                        <path
                            d={createGearPath(0, 0, 8, 14, 6)}
                            fill="url(#metalGradient)"
                            stroke="rgba(255,255,255,0.3)"
                            strokeWidth="0.4"
                            opacity="0.75"
                        />
                        <circle cx="0" cy="0" r="5" fill="rgba(240,240,240,0.15)" stroke="rgba(200,200,200,0.3)" strokeWidth="0.5" />
                        <circle cx="0" cy="0" r="2.5" fill="rgba(30,30,35,0.7)" />
                    </g>
                </g>

                {/* Animated energy particles between gears */}
                <g opacity="0.6">
                    <circle r="2" fill="#65D3FD">
                        <animate attributeName="cx" values="115;140;115" dur="2s" repeatCount="indefinite" />
                        <animate attributeName="cy" values="65;75;65" dur="2s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.8;0.3;0.8" dur="2s" repeatCount="indefinite" />
                    </circle>
                    <circle r="1.5" fill="#a855f7">
                        <animate attributeName="cx" values="140;160;140" dur="2.5s" repeatCount="indefinite" />
                        <animate attributeName="cy" values="85;92;85" dur="2.5s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.6;0.2;0.6" dur="2.5s" repeatCount="indefinite" />
                    </circle>
                </g>
            </svg>
        </div>
    );
}
