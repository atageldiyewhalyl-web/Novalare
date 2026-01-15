import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Combobox } from '@/components/ui/combobox';
import { Button } from '@/components/ui/button';
import { ArrowRight, AlertTriangle, Calculator } from 'lucide-react';

interface FxAdjustmentDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (adjustmentAccount: any, variance: number, description: string) => Promise<void>;
    bankAmount: number;
    ledgerAmount: number;
    currency: string;
    bankAccountName: string;
    chartOfAccounts: any[];
    isProcessing: boolean;
}

export const FxAdjustmentDialog: React.FC<FxAdjustmentDialogProps> = ({
    isOpen,
    onClose,
    onConfirm,
    bankAmount,
    ledgerAmount,
    currency,
    bankAccountName,
    chartOfAccounts,
    isProcessing
}) => {
    const [selectedAccount, setSelectedAccount] = useState<any>(null);

    // Calculate variance: What we need to add/subtract to Ledger to match Bank
    // Variance = Bank - Ledger
    // e.g. Bank = -339.66, Ledger = -342.87. Diff = +3.21 (Gain)
    const variance = bankAmount - ledgerAmount;
    const isGain = variance > 0;

    // Format for display
    const absVariance = Math.abs(variance);
    const formattedVariance = new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(absVariance);

    const handleSubmit = () => {
        if (!selectedAccount) return;
        onConfirm(
            selectedAccount,
            variance,
            `FX Adjustment: ${isGain ? 'Gain' : 'Loss'} of ${formattedVariance}`
        );
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-xl bg-white dark:bg-gray-900 border-gray-200 dark:border-white/10 text-gray-900 dark:text-white">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
                        <Calculator className="size-5 text-purple-500" />
                        Create FX Adjustment Entry
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Summary Card */}
                    <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4 border border-gray-100 dark:border-white/5">
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                                <p className="text-xs text-gray-500 mb-1">Bank Transaction</p>
                                <p className="font-mono font-medium">{bankAmount.toFixed(2)}</p>
                            </div>
                            <div className="flex flex-col items-center justify-center">
                                <span className="text-xs text-gray-400 mb-1">Difference</span>
                                <div className={`px-2 py-1 rounded text-xs font-bold ${isGain ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {isGain ? '+' : '-'}{formattedVariance}
                                </div>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 mb-1">Ledger Entry</p>
                                <p className="font-mono font-medium">{ledgerAmount.toFixed(2)}</p>
                            </div>
                        </div>

                        <div className="mt-4 flex items-center gap-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400 p-2 rounded-lg border border-amber-100 dark:border-amber-900/40">
                            <AlertTriangle className="size-3 shrink-0" />
                            <span>
                                To match these records, we need to record a <b>{formattedVariance} {isGain ? 'Gain' : 'Loss'}</b>.
                            </span>
                        </div>
                    </div>

                    {/* Account Selector */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Select Adjustment Account</label>
                        <Combobox
                            items={chartOfAccounts || []}
                            value={selectedAccount}
                            onChange={setSelectedAccount}
                            placeholder="Select account (e.g. Foreign Exchange Gain/Loss)..."
                            label="Account"
                            className="w-full"
                        />
                        {/* Suggestion Hint */}
                        <p className="text-xs text-gray-400">
                            💡 Suggestion: Search for 'Exchange', 'Conversion', or 'Gain/Loss'
                        </p>
                    </div>

                    {/* Journal Entry Preview */}
                    {selectedAccount && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                            <label className="text-sm font-medium text-gray-500">Draft Journal Entry Preview</label>
                            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden font-mono text-xs">
                                {/* Header */}
                                <div className="grid grid-cols-12 gap-2 p-2 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 font-semibold text-gray-700 dark:text-gray-300">
                                    <div className="col-span-6">Account</div>
                                    <div className="col-span-3 text-right">Debit</div>
                                    <div className="col-span-3 text-right">Credit</div>
                                </div>

                                {/* Line 1: Bank Side */}
                                {/* If Gain: Bank increases (Debit) */}
                                {/* If Loss: Bank decreases (Credit) */}
                                <div className="grid grid-cols-12 gap-2 p-2 border-b border-slate-100 dark:border-slate-800/50">
                                    <div className="col-span-6 truncate text-gray-900 dark:text-gray-200">{bankAccountName}</div>
                                    <div className="col-span-3 text-right text-gray-600 dark:text-gray-400">
                                        {isGain ? formattedVariance : '-'}
                                    </div>
                                    <div className="col-span-3 text-right text-gray-600 dark:text-gray-400">
                                        {!isGain ? formattedVariance : '-'}
                                    </div>
                                </div>

                                {/* Line 2: Adjustment Side */}
                                {/* If Gain: Income increases (Credit) */}
                                {/* If Loss: Expense increases (Debit) */}
                                <div className="grid grid-cols-12 gap-2 p-2 bg-purple-50/50 dark:bg-purple-900/10">
                                    <div className="col-span-6 truncate font-medium text-purple-700 dark:text-purple-300">
                                        {selectedAccount.code} - {selectedAccount.name}
                                    </div>
                                    <div className="col-span-3 text-right text-purple-600 dark:text-purple-400">
                                        {!isGain ? formattedVariance : '-'}
                                    </div>
                                    <div className="col-span-3 text-right text-purple-600 dark:text-purple-400">
                                        {isGain ? formattedVariance : '-'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={!selectedAccount || isProcessing}
                        className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                        {isProcessing ? 'Creating...' : 'Adjust & Match'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
