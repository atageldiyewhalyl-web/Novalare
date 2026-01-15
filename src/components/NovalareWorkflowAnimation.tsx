import { motion, AnimatePresence } from "motion/react";
import { useEffect, useState, useRef } from "react";

type Phase = "idle" | "selecting" | "matching" | "reviewing" | "posting" | "done";

// Realistic transaction data
const leftTransactions = [
    { id: "l1", description: "ACH DEPOSIT TXN2", date: "2025-12-20", amount: "$348.87" },
    { id: "l2", description: "ACH DEPOSIT TXN3", date: "2025-12-20", amount: "$53.29" },
];

const rightTransactions = [
    { id: "r1", description: "LYFT BATCH", date: "2025-12-24", amount: "$634.81", hasDropdown: true },
];

export function NovalareWorkflowAnimation() {
    const [phase, setPhase] = useState<Phase>("idle");
    const [selectedLeft, setSelectedLeft] = useState<string[]>([]);
    const [selectedRight, setSelectedRight] = useState<string[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [matchedPairs, setMatchedPairs] = useState<string[]>([]);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [loopKey, setLoopKey] = useState(0);

    useEffect(() => {
        let isMounted = true;
        const timeouts: NodeJS.Timeout[] = [];

        const schedule = (fn: () => void, delay: number) => {
            const t = setTimeout(() => { if (isMounted) fn(); }, delay);
            timeouts.push(t);
            return t;
        };

        // Animation sequence
        schedule(() => setPhase("selecting"), 800);
        schedule(() => setSelectedLeft(["l1"]), 1500);
        schedule(() => setSelectedLeft(["l1", "l2"]), 2200);
        schedule(() => setSelectedRight(["r1"]), 2900);
        schedule(() => setShowDropdown(true), 3600);
        schedule(() => setPhase("matching"), 4300);
        schedule(() => {
            setShowDropdown(false);
            setMatchedPairs(["l1", "l2", "r1"]);
            setPhase("reviewing");
        }, 5000);
        schedule(() => setPhase("posting"), 6500);
        schedule(() => setPhase("done"), 7500);
        schedule(() => {
            // Reset for loop
            setPhase("idle");
            setSelectedLeft([]);
            setSelectedRight([]);
            setShowDropdown(false);
            setMatchedPairs([]);
            setLoopKey(k => k + 1);
        }, 9500);

        return () => {
            isMounted = false;
            timeouts.forEach(clearTimeout);
        };
    }, [loopKey]);

    return (
        <div className="relative w-full overflow-hidden rounded-3xl" style={{ aspectRatio: "16/9", maxHeight: "600px" }}>
            {/* Rich gradient background */}
            <div
                className="absolute inset-0"
                style={{
                    background: "linear-gradient(135deg, #1a3a2a 0%, #0d2018 50%, #0a1a12 100%)",
                }}
            />

            {/* Animated gradient orbs */}
            <motion.div
                className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-40"
                style={{ background: "radial-gradient(circle, rgba(34,197,94,0.3) 0%, transparent 70%)" }}
                animate={{
                    x: [0, 50, 0],
                    y: [0, 30, 0],
                    scale: [1, 1.1, 1],
                }}
                transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
                className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full opacity-30"
                style={{ background: "radial-gradient(circle, rgba(59,130,246,0.3) 0%, transparent 70%)" }}
                animate={{
                    x: [0, -50, 0],
                    y: [0, -30, 0],
                    scale: [1.1, 1, 1.1],
                }}
                transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
            />

            {/* Phase indicator */}
            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20">
                <motion.div
                    className="px-4 py-2 bg-white/10 backdrop-blur-xl rounded-full border border-white/20 flex items-center gap-2"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <motion.div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: phase === "done" ? "#22c55e" : "#3b82f6" }}
                        animate={{ scale: [1, 1.3, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                    />
                    <span className="text-sm text-white/90 font-medium">
                        {phase === "idle" && "Bank Reconciliation"}
                        {phase === "selecting" && "Selecting Transactions"}
                        {phase === "matching" && "Creating Match"}
                        {phase === "reviewing" && "Review & Confirm"}
                        {phase === "posting" && "Posting to QuickBooks..."}
                        {phase === "done" && "Successfully Posted ✓"}
                    </span>
                </motion.div>
            </div>

            {/* Main content - Two column layout */}
            <div className="absolute inset-0 flex items-center justify-center px-8 pt-16 pb-8">
                <div className="flex gap-6 w-full max-w-5xl">

                    {/* Left Panel - Internal Ledger */}
                    <motion.div
                        className="flex-1 bg-white rounded-2xl shadow-2xl overflow-hidden"
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        {/* Header */}
                        <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                </div>
                                <div>
                                    <div className="text-sm font-semibold text-gray-900">Internal Ledger</div>
                                    <div className="text-xs text-gray-500">2 unmatched entries</div>
                                </div>
                            </div>
                        </div>

                        {/* Transaction rows */}
                        <div className="p-4 space-y-3">
                            {leftTransactions.map((txn, i) => {
                                const isSelected = selectedLeft.includes(txn.id);
                                const isMatched = matchedPairs.includes(txn.id);

                                return (
                                    <motion.div
                                        key={txn.id}
                                        className={`relative rounded-xl border-2 transition-all duration-300 ${isMatched
                                                ? "bg-emerald-50 border-emerald-300"
                                                : isSelected
                                                    ? "bg-blue-50 border-blue-400"
                                                    : "bg-white border-gray-200"
                                            }`}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.1 }}
                                    >
                                        {/* Action bar */}
                                        <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100">
                                            <motion.button
                                                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${isMatched
                                                        ? "bg-emerald-500 text-white"
                                                        : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                                    }`}
                                                animate={isSelected && !isMatched ? { scale: [1, 1.05, 1] } : {}}
                                                transition={{ duration: 0.3 }}
                                            >
                                                {isMatched ? "✓ Matched" : "Prepare Journal Entry"}
                                            </motion.button>
                                            <span className="text-xs text-gray-400">|</span>
                                            <button className="px-2 py-1 text-xs text-gray-600 hover:text-gray-900">✏️ Match</button>
                                            <button className="px-2 py-1 text-xs text-gray-600 hover:text-gray-900">Edit / Correct</button>
                                            <button className="px-2 py-1 text-xs text-gray-600 hover:text-gray-900">More Actions</button>
                                        </div>

                                        {/* Transaction content */}
                                        <div className="flex items-center justify-between px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <motion.div
                                                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isMatched
                                                            ? "bg-emerald-500 border-emerald-500"
                                                            : isSelected
                                                                ? "bg-blue-500 border-blue-500"
                                                                : "border-gray-300"
                                                        }`}
                                                    animate={isSelected ? { scale: [0.8, 1.1, 1] } : {}}
                                                >
                                                    {(isSelected || isMatched) && (
                                                        <motion.svg
                                                            className="w-3 h-3 text-white"
                                                            fill="none"
                                                            viewBox="0 0 24 24"
                                                            stroke="currentColor"
                                                            strokeWidth={3}
                                                            initial={{ scale: 0 }}
                                                            animate={{ scale: 1 }}
                                                        >
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                        </motion.svg>
                                                    )}
                                                </motion.div>
                                                <div>
                                                    <div className="font-medium text-gray-900 text-sm">{txn.description}</div>
                                                    <div className="text-xs text-gray-500">{txn.date}</div>
                                                </div>
                                            </div>
                                            <div className="text-base font-semibold text-gray-900">{txn.amount}</div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </motion.div>

                    {/* Right Panel - Bank Statement */}
                    <motion.div
                        className="flex-1 bg-white rounded-2xl shadow-2xl overflow-hidden"
                        initial={{ opacity: 0, x: 30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        {/* Header */}
                        <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                    </svg>
                                </div>
                                <div>
                                    <div className="text-sm font-semibold text-gray-900">Bank Statement</div>
                                    <div className="text-xs text-gray-500">Chase Checking •••4521</div>
                                </div>
                            </div>
                        </div>

                        {/* Transaction rows */}
                        <div className="p-4 space-y-3">
                            {rightTransactions.map((txn, i) => {
                                const isSelected = selectedRight.includes(txn.id);
                                const isMatched = matchedPairs.includes(txn.id);

                                return (
                                    <motion.div
                                        key={txn.id}
                                        className={`relative rounded-xl border-2 transition-all duration-300 ${isMatched
                                                ? "bg-emerald-50 border-emerald-300"
                                                : isSelected
                                                    ? "bg-blue-50 border-blue-400"
                                                    : "bg-white border-gray-200"
                                            }`}
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.1 }}
                                    >
                                        {/* Action bar */}
                                        <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100">
                                            <button className="px-3 py-1 text-xs bg-rose-100 text-rose-700 font-semibold rounded-md">
                                                ↩ Reverse JE
                                            </button>
                                            <span className="text-xs text-gray-400">|</span>
                                            <button className="px-2 py-1 text-xs text-gray-600">✏️ Match</button>
                                            <button className="px-2 py-1 text-xs text-gray-600">Edit / Correct</button>
                                            <button className="px-2 py-1 text-xs text-gray-600">More Actions ▾</button>
                                        </div>

                                        {/* Transaction content */}
                                        <div className="flex items-center justify-between px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <motion.div
                                                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isMatched
                                                            ? "bg-emerald-500 border-emerald-500"
                                                            : isSelected
                                                                ? "bg-blue-500 border-blue-500"
                                                                : "border-gray-300"
                                                        }`}
                                                    animate={isSelected ? { scale: [0.8, 1.1, 1] } : {}}
                                                >
                                                    {(isSelected || isMatched) && (
                                                        <motion.svg
                                                            className="w-3 h-3 text-white"
                                                            fill="none"
                                                            viewBox="0 0 24 24"
                                                            stroke="currentColor"
                                                            strokeWidth={3}
                                                            initial={{ scale: 0 }}
                                                            animate={{ scale: 1 }}
                                                        >
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                        </motion.svg>
                                                    )}
                                                </motion.div>
                                                <div>
                                                    <div className="font-medium text-gray-900 text-sm">{txn.description}</div>
                                                    <div className="text-xs text-gray-500">{txn.date}</div>
                                                </div>
                                            </div>
                                            <div className="text-base font-semibold text-emerald-600">{txn.amount}</div>
                                        </div>

                                        {/* Dropdown menu */}
                                        <AnimatePresence>
                                            {showDropdown && txn.hasDropdown && (
                                                <motion.div
                                                    className="absolute top-full right-4 mt-1 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-10 w-56"
                                                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                                >
                                                    <div className="px-4 py-2 text-xs font-semibold text-gray-500 border-b border-gray-100">Actions</div>
                                                    <button className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                                                        <span>📝</span> Mark as Timing Difference
                                                    </button>
                                                    <button className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                                                        <span>🔕</span> Mark as Non-Issue (Ignore)
                                                    </button>
                                                    <button className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                                                        <span>📨</span> Request Information / Follow-up
                                                    </button>
                                                    <div className="border-t border-gray-100 mt-1 pt-1">
                                                        <button className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                                                            <span>🗑️</span> Delete Transaction
                                                        </button>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </motion.div>
                </div>
            </div>

            {/* Success overlay */}
            <AnimatePresence>
                {phase === "done" && (
                    <motion.div
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-30"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.div
                            className="bg-white rounded-2xl p-8 text-center shadow-2xl"
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                        >
                            <motion.div
                                className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center"
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", delay: 0.1 }}
                            >
                                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                            </motion.div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">Successfully Matched!</h3>
                            <p className="text-gray-600 text-sm mb-4">3 transactions reconciled and posted</p>
                            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                                <div className="w-6 h-6 bg-[#2CA01C] rounded flex items-center justify-center">
                                    <span className="text-white text-[10px] font-bold">QB</span>
                                </div>
                                <span>Synced to QuickBooks</span>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Matching animation line */}
            <AnimatePresence>
                {phase === "matching" && (
                    <svg className="absolute inset-0 w-full h-full pointer-events-none z-20">
                        <motion.line
                            x1="35%"
                            y1="50%"
                            x2="65%"
                            y2="50%"
                            stroke="#3b82f6"
                            strokeWidth="3"
                            strokeLinecap="round"
                            initial={{ pathLength: 0, opacity: 0 }}
                            animate={{ pathLength: 1, opacity: [0, 1, 0.8] }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.7 }}
                        />
                        <motion.circle
                            cx="50%"
                            cy="50%"
                            r="8"
                            fill="#3b82f6"
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: [0, 1.5, 1], opacity: [0, 1, 1] }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.5, delay: 0.3 }}
                        />
                    </svg>
                )}
            </AnimatePresence>
        </div>
    );
}
