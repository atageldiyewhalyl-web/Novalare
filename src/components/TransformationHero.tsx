import React, { useMemo } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

// Assets
import circuitBg from '../assets/hero/circuit_bg.png';
import chaosReceipt from '../assets/hero/chaos_receipt.png';
import chaosInvoice from '../assets/hero/chaos_invoice.png';
import clarityCard1 from '../assets/hero/clarity_card_1.png';
import clarityCard2 from '../assets/hero/clarity_card_2.png';

const ChaosElement = ({ src, delay, initialX, initialY }: { src: string; delay: number; initialX: number; initialY: number }) => (
    <motion.img
        src={src}
        className="absolute w-24 md:w-32 lg:w-40 pointer-events-none z-10"
        initial={{
            x: initialX,
            y: initialY,
            opacity: 0,
            rotate: Math.random() * 360,
            scale: 0.8,
            filter: 'blur(4px)'
        }}
        animate={{
            x: [initialX, initialX + 300, 500], // Heading towards center
            y: [initialY, initialY + 50, 400],
            opacity: [0, 1, 1, 0],
            rotate: [0, 45, 180],
            scale: [0.8, 1, 0.2],
            filter: ['blur(4px)', 'blur(0px)', 'blur(12px)'],
        }}
        transition={{
            duration: 6,
            repeat: Infinity,
            delay,
            ease: "easeInOut"
        }}
        style={{ transformOrigin: 'center' }}
    />
);

const ClarityElement = ({ src, delay, finalX, finalY }: { src: string; delay: number; finalX: number; finalY: number }) => (
    <motion.img
        src={src}
        className="absolute w-40 md:w-56 lg:w-72 pointer-events-none z-20 shadow-2xl shadow-cyan-500/20"
        initial={{
            x: 512, // From portal center
            y: 400,
            opacity: 0,
            scale: 0,
            filter: 'blur(20px)'
        }}
        animate={{
            x: [512, finalX],
            y: [400, finalY],
            opacity: [0, 1, 1],
            scale: [0, 1.1, 1],
            filter: ['blur(20px)', 'blur(0px)', 'blur(0px)'],
        }}
        transition={{
            duration: 5,
            repeat: Infinity,
            delay: delay + 2, // Slight offset from portal entry
            ease: "easeOut"
        }}
    />
);

const SpiralPortal = () => (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full max-w-4xl pointer-events-none z-15 flex items-center justify-center">
        <svg viewBox="0 0 800 800" className="w-[150%] h-[150%] md:w-[120%] md:h-[120%] opacity-80">
            <defs>
                <radialGradient id="portalGradient" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#fff" />
                    <stop offset="30%" stopColor="#65D3FD" />
                    <stop offset="70%" stopColor="#1e1b4b" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#000" stopOpacity="0" />
                </radialGradient>
                <filter id="glow">
                    <feGaussianBlur stdDeviation="10" result="coloredBlur" />
                    <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>

            {/* Central Void */}
            <motion.circle
                cx="400" cy="400" r="80"
                fill="url(#portalGradient)"
                animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.8, 1, 0.8]
                }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            />

            {/* Spiraling Paths */}
            {[...Array(6)].map((_, i) => (
                <motion.ellipse
                    key={i}
                    cx="400" cy="400"
                    rx={100 + i * 40}
                    ry={80 + i * 30}
                    fill="none"
                    stroke={i % 2 === 0 ? "#65D3FD" : "#a855f7"}
                    strokeWidth="2"
                    strokeDasharray="10 200"
                    filter="url(#glow)"
                    initial={{ rotate: i * 60 }}
                    animate={{
                        rotate: i * 60 + 360,
                        strokeDashoffset: [0, -420]
                    }}
                    transition={{
                        duration: 8 - i,
                        repeat: Infinity,
                        ease: "linear"
                    }}
                />
            ))}

            {/* Intense Core Glow */}
            <circle cx="400" cy="400" r="40" fill="white" className="blur-2xl" />
            <circle cx="400" cy="400" r="100" fill="#65D3FD" className="blur-[60px] opacity-40" />
        </svg>
    </div>
);

export const TransformationHero = () => {
    const { scrollY } = useScroll();
    const yBg = useTransform(scrollY, [0, 500], [0, 150]);
    const opacity = useTransform(scrollY, [0, 300], [1, 0]);

    const chaosItems = useMemo(() => [
        { src: chaosReceipt, delay: 0, x: -600, y: 100 },
        { src: chaosInvoice, delay: 1.5, x: -700, y: 300 },
        { src: chaosReceipt, delay: 3, x: -650, y: 500 },
        { src: chaosInvoice, delay: 4.5, x: -800, y: 200 },
        { src: chaosReceipt, delay: 0.8, x: -750, y: 600 },
    ], []);

    const clarityItems = useMemo(() => [
        { src: clarityCard1, delay: 1, x: 700, y: 200 },
        { src: clarityCard2, delay: 2.5, x: 750, y: 450 },
    ], []);

    return (
        <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-slate-950">
            {/* Circuit Background */}
            <motion.div
                style={{ y: yBg }}
                className="absolute inset-0 z-0"
            >
                <div className="absolute inset-0 bg-gradient-to-b from-slate-950/40 via-slate-950/20 to-slate-950 z-10" />
                <img
                    src={circuitBg}
                    alt="Technical Background"
                    className="w-full h-[120%] object-cover opacity-60 mix-blend-screen"
                />
            </motion.div>

            {/* Background Glows */}
            <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[120px] pointer-events-none" />

            {/* The Giant Checkmark (Mockup Parity) */}
            <div className="absolute top-1/2 right-[-5%] -translate-y-1/2 opacity-20 pointer-events-none select-none z-0">
                <svg width="800" height="800" viewBox="0 0 100 100" fill="none">
                    <motion.path
                        d="M20 50L45 75L80 25"
                        stroke="#10b981"
                        strokeWidth="12"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 2, ease: "easeInOut" }}
                        style={{ filter: 'drop-shadow(0 0 20px #10b981)' }}
                    />
                </svg>
            </div>

            {/* Portal & Elements Container */}
            <div className="absolute inset-0 z-10 overflow-hidden">
                <SpiralPortal />

                {/* Chaos Elements (Input) */}
                <div className="absolute inset-0">
                    {chaosItems.map((item, idx) => (
                        <ChaosElement key={`chaos-${idx}`} {...item} />
                    ))}
                </div>

                {/* Clarity Elements (Output) */}
                <div className="absolute inset-0">
                    {clarityItems.map((item, idx) => (
                        <ClarityElement key={`clatity-${idx}`} {...item} />
                    ))}
                </div>
            </div>

            {/* Hero Content (Centered) */}
            <div className="relative z-30 max-w-5xl px-6 text-center">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                >
                    <h1 className="text-white text-6xl md:text-8xl lg:text-9xl font-black tracking-tighter leading-[0.8] mb-8">
                        AUTOMATE <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#65D3FD] to-purple-400">
                            THE CHAOS.
                        </span>
                    </h1>

                    <p className="text-slate-400 text-lg md:text-2xl max-w-2xl mx-auto mb-12 font-medium">
                        Transform messy bookkeeping into crystal clear intelligence.
                        Powered by the next generation of accounting AI.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="px-10 py-5 bg-[#65D3FD] text-slate-950 font-bold rounded-xl text-lg shadow-[0_0_40px_-10px_#65D3FD] hover:shadow-[0_0_60px_-5px_#65D3FD] transition-all"
                        >
                            Start Your Transformation
                        </motion.button>

                        <button className="px-10 py-5 text-white font-semibold border border-slate-800 rounded-xl hover:bg-white/5 transition-all text-lg">
                            Watch the Demo
                        </button>
                    </div>
                </motion.div>
            </div>

            {/* Bottom Gradient Fade */}
            <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-slate-950 to-transparent z-40" />
        </section>
    );
};
