import { motion, AnimatePresence } from 'framer-motion';
import { Landmark, BookOpen, CheckCircle, Sparkles } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';

const LOADING_MESSAGES = [
    "Aligning dates and periods...",
    "Comparing bank transactions...",
    "Scanning general ledger entries...",
    "Hunting for penny discrepancies...",
    "Matching reference numbers...",
    "Validating vendor names...",
    "Finalizing reconciliation report...",
];

interface ReconciliationLoadingProps {
    theme?: 'light' | 'dark' | 'premium-dark';
}

export function ReconciliationLoading({ theme = 'light' }: ReconciliationLoadingProps) {
    const [currentMessageIndex, setCurrentMessageIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
        }, 2500);
        return () => clearInterval(interval);
    }, []);

    const isDark = theme === 'premium-dark';

    return (
        <Card className={`overflow-hidden border-0 ${isDark ? 'bg-white/[0.03]' : 'bg-white'}`}>
            <CardContent className="p-12 relative flex flex-col items-center justify-center min-h-[400px]">

                {/* Ambient Glow */}
                <div className={`absolute inset-0 bg-gradient-to-br ${isDark
                    ? 'from-[#65D3FD]/5 via-transparent to-[#4F5CFE]/5'
                    : 'from-blue-50/50 via-transparent to-purple-50/50'}`}
                />

                {/* Animation Container */}
                <div className="relative z-10 w-full max-w-lg mb-12">
                    <div className="flex items-center justify-between relative">

                        {/* Bank Icon (Left) */}
                        <div className="flex flex-col items-center gap-3 relative z-20">
                            <div className={`size-16 rounded-2xl flex items-center justify-center shadow-lg border backdrop-blur-xl
                ${isDark
                                    ? 'bg-gradient-to-br from-[#65D3FD]/20 to-[#65D3FD]/5 border-[#65D3FD]/20 text-[#65D3FD]'
                                    : 'bg-white border-blue-100 text-blue-500'}`}
                            >
                                <Landmark className="size-8" />
                            </div>
                            <span className={`text-xs font-bold tracking-widest uppercase ${isDark ? 'text-[#65D3FD]/70' : 'text-blue-400'}`}>Bank</span>
                        </div>

                        {/* General Ledger Icon (Right) */}
                        <div className="flex flex-col items-center gap-3 relative z-20">
                            <div className={`size-16 rounded-2xl flex items-center justify-center shadow-lg border backdrop-blur-xl
                ${isDark
                                    ? 'bg-gradient-to-br from-[#4F5CFE]/20 to-[#4F5CFE]/5 border-[#4F5CFE]/20 text-[#4F5CFE]'
                                    : 'bg-white border-purple-100 text-purple-500'}`}
                            >
                                <BookOpen className="size-8" />
                            </div>
                            <span className={`text-xs font-bold tracking-widest uppercase ${isDark ? 'text-[#4F5CFE]/70' : 'text-purple-400'}`}>Ledger</span>
                        </div>

                        {/* Connecting Beam / Particles */}
                        <div className="absolute top-8 left-16 right-16 h-[2px] bg-gradient-to-r from-[#65D3FD]/20 to-[#4F5CFE]/20 overflow-hidden rounded-full">
                            <motion.div
                                className={`absolute inset-0 w-1/3 bg-gradient-to-r ${isDark ? 'from-transparent via-white to-transparent' : 'from-transparent via-blue-400 to-transparent'}`}
                                animate={{ x: ['-100%', '300%'] }}
                                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                            />
                        </div>

                        {/* Floating "Data Packets" moving across */}
                        <div className="absolute top-8 left-16 right-16 h-0">
                            {[0, 1, 2].map((i) => (
                                <motion.div
                                    key={i}
                                    className={`absolute top-[-4px] size-2 rounded-full shadow-[0_0_10px_currentColor] ${isDark ? 'bg-white text-white' : 'bg-blue-500 text-blue-500'}`}
                                    initial={{ left: '0%', opacity: 0, scale: 0.5 }}
                                    animate={{
                                        left: ['0%', '100%'],
                                        opacity: [0, 1, 1, 0],
                                        scale: [0.5, 1, 0.5]
                                    }}
                                    transition={{
                                        duration: 2,
                                        repeat: Infinity,
                                        delay: i * 0.7,
                                        ease: "easeInOut"
                                    }}
                                />
                            ))}
                        </div>

                        {/* Central Pulse (The Brain) */}
                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -mt-4">
                            <motion.div
                                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                                transition={{ duration: 2, repeat: Infinity }}
                                className={`size-24 rounded-full blur-3xl ${isDark ? 'bg-white/10' : 'bg-blue-500/10'}`}
                            />
                        </div>

                    </div>
                </div>

                {/* Dynamic Text */}
                <div className="h-16 flex flex-col items-center justify-center text-center space-y-2 z-20">
                    <AnimatePresence mode="wait">
                        <motion.p
                            key={currentMessageIndex}
                            initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
                            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                            exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
                            transition={{ duration: 0.4 }}
                            className={`text-lg font-medium ${isDark ? 'text-white' : 'text-gray-800'}`}
                        >
                            {LOADING_MESSAGES[currentMessageIndex]}
                        </motion.p>
                    </AnimatePresence>
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        <span className="inline-flex items-center gap-1.5">
                            <Sparkles className="size-3.5" />
                            AI Analysis in Progress
                        </span>
                    </p>
                </div>

            </CardContent>
        </Card>
    );
}
