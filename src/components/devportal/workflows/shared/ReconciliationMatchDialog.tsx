import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { formatCurrency } from '@/utils/currency';
import { useState } from 'react';

// Using a generic Item interface to handle both Bank/CC transactions and Ledger entries
export interface MatchItem {
    id: string;
    date: string;
    description: string;
    amount: number;
    originalItem: any; // Keep reference to original object
}

interface ReconciliationMatchDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;

    // Left side items (e.g. Bank Transactions)
    leftItems: MatchItem[];
    leftTitle: string;
    onSelectLeft: (item: MatchItem) => void;
    selectedLeftItems: MatchItem[];

    // Right side items (e.g. Ledger Entries)
    rightItems: MatchItem[];
    rightTitle: string;
    onSelectRight: (item: MatchItem) => void;
    selectedRightItems: MatchItem[];

    // Actions
    onMatch: () => void;
    isMatching: boolean;
    currency?: string;
}

export function ReconciliationMatchDialog({
    open,
    onOpenChange,
    title,
    leftItems,
    leftTitle,
    onSelectLeft,
    selectedLeftItems,
    rightItems,
    rightTitle,
    onSelectRight,
    selectedRightItems,
    onMatch,
    isMatching,
    currency
}: ReconciliationMatchDialogProps) {
    const [filterText, setFilterText] = useState('');

    const leftTotal = selectedLeftItems.reduce((sum, item) => sum + item.amount, 0);
    const rightTotal = selectedRightItems.reduce((sum, item) => sum + item.amount, 0);
    const difference = Math.abs(leftTotal) - Math.abs(rightTotal);
    const isMatchable = Math.abs(difference) < 0.01 && (selectedLeftItems.length > 0 || selectedRightItems.length > 0);

    // Filter logic could be added here if needed, simple pass-through for now
    const filteredLeft = leftItems;
    const filteredRight = rightItems;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>
                        Select items from both sides to match. Amounts must equal 0 difference.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-hidden grid grid-cols-2 gap-4 py-4 min-h-[400px]">
                    {/* Left Column */}
                    <div className="flex flex-col border rounded-lg overflow-hidden">
                        <div className="bg-gray-50 p-3 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="font-medium text-sm text-gray-700">{leftTitle}</h3>
                            <Badge variant="secondary">{filteredLeft.length}</Badge>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-2">
                            {filteredLeft.length === 0 ? (
                                <div className="text-center py-8 text-gray-400 text-sm">No items found</div>
                            ) : (
                                filteredLeft.map(item => {
                                    const isSelected = selectedLeftItems.some(i => i.id === item.id);
                                    return (
                                        <div
                                            key={item.id}
                                            onClick={() => onSelectLeft(item)}
                                            className={`
                        p-3 rounded-md border cursor-pointer transition-colors
                        ${isSelected ? 'bg-purple-50 border-purple-200' : 'bg-white border-gray-100 hover:border-gray-300'}
                      `}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div className="flex-1 mr-2">
                                                    <div className="text-sm font-medium text-gray-900 line-clamp-1">{item.description}</div>
                                                    <div className="text-xs text-gray-500 mt-1">{item.date}</div>
                                                </div>
                                                <div className={`text-sm font-medium ${item.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                    {item.amount >= 0 ? '+' : ''}{formatCurrency(item.amount, currency)}
                                                </div>
                                            </div>
                                            {isSelected && (
                                                <div className="mt-2 flex justify-end">
                                                    <CheckCircle2 className="size-4 text-purple-600" />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Right Column */}
                    <div className="flex flex-col border rounded-lg overflow-hidden">
                        <div className="bg-gray-50 p-3 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="font-medium text-sm text-gray-700">{rightTitle}</h3>
                            <Badge variant="secondary">{filteredRight.length}</Badge>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-2">
                            {filteredRight.length === 0 ? (
                                <div className="text-center py-8 text-gray-400 text-sm">No items found</div>
                            ) : (
                                filteredRight.map(item => {
                                    const isSelected = selectedRightItems.some(i => i.id === item.id);
                                    return (
                                        <div
                                            key={item.id}
                                            onClick={() => onSelectRight(item)}
                                            className={`
                        p-3 rounded-md border cursor-pointer transition-colors
                        ${isSelected ? 'bg-purple-50 border-purple-200' : 'bg-white border-gray-100 hover:border-gray-300'}
                      `}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div className="flex-1 mr-2">
                                                    <div className="text-sm font-medium text-gray-900 line-clamp-1">{item.description}</div>
                                                    <div className="text-xs text-gray-500 mt-1">{item.date}</div>
                                                </div>
                                                <div className={`text-sm font-medium ${item.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                    {item.amount >= 0 ? '+' : ''}{formatCurrency(item.amount, currency)}
                                                </div>
                                            </div>
                                            {isSelected && (
                                                <div className="mt-2 flex justify-end">
                                                    <CheckCircle2 className="size-4 text-purple-600" />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer with Calculation */}
                <div className="bg-gray-50 -mx-6 -mb-6 p-4 border-t border-gray-200 flex items-center justify-between">
                    <div className="flex gap-6">
                        <div>
                            <div className="text-xs text-gray-500 uppercase font-medium">Selected Left</div>
                            <div className="text-lg font-semibold text-gray-900">{formatCurrency(Math.abs(leftTotal), currency)}</div>
                        </div>
                        <div>
                            <div className="text-xs text-gray-500 uppercase font-medium">Selected Right</div>
                            <div className="text-lg font-semibold text-gray-900">{formatCurrency(Math.abs(rightTotal), currency)}</div>
                        </div>
                        <div>
                            <div className="text-xs text-gray-500 uppercase font-medium">Difference</div>
                            <div className={`text-lg font-semibold ${Math.abs(difference) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatCurrency(difference, currency)}
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="!m-0">
                        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button
                            onClick={onMatch}
                            disabled={!isMatchable || isMatching}
                            className="gap-2"
                        >
                            {isMatching && <RefreshCw className="size-4 animate-spin" />}
                            Confirm Match
                        </Button>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    );
}
