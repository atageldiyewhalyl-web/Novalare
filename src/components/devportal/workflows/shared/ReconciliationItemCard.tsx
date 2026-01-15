import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Loader2, ThumbsUp, Link, Edit2 } from 'lucide-react';
import { formatCurrency } from '@/utils/currency';

interface SuggestedJE {
    debit_account: string;
    credit_account: string;
    amount: number;
}

interface ItemData {
    id: string;
    date: string;
    description: string;
    amount: number;
    currency?: string;
    // Optional fields found in different item types
    balance?: number;
    statementId?: string;
    statementName?: string;
    details?: any; // For flexible extra data display
}

interface UnmatchedItemCardProps {
    item: {
        data: ItemData;
        suggested_je?: SuggestedJE;
    };
    type: string;
    currency?: string;
    loadingActions: Record<string, boolean>;
    isMonthLocked?: boolean;
    onApproveJE: () => void;
    onMatch: () => void;
    onEdit: () => void;
    onIgnore: () => void;
    onTimingDifference: () => void;
    onRequestInfo: () => void;
    onDelete?: () => void;
    // Customization
    primaryActionLabel?: string;
    primaryActionIcon?: React.ReactNode;
    primaryActionClassName?: string;
    matchActionLabel?: string;
}

export function UnmatchedItemCard({
    item,
    type,
    currency,
    loadingActions,
    isMonthLocked,
    onApproveJE,
    onMatch,
    onEdit,
    onIgnore,
    onTimingDifference,
    onRequestInfo,
    onDelete,
    primaryActionLabel = "Prepare Journal Entry",
    primaryActionIcon = <ThumbsUp className="size-3" />,
    primaryActionClassName = "gap-2 bg-green-600 hover:bg-green-700",
    matchActionLabel = "Match to Ledger Entry"
}: UnmatchedItemCardProps) {
    const isLoading = loadingActions[`approve-${type}-${item.data.id}`] || loadingActions[`reverse-ledger-${item.data.id}`];
    const isPositive = item.data.amount >= 0;

    // determine styling based on type
    const isLedgerType = ['ledger', 'ap', 'invoice'].includes(type);
    const containerClasses = isLedgerType
        ? "p-4 bg-amber-50 border border-amber-200 rounded-lg"
        : "p-4 bg-red-50 border border-red-200 rounded-lg";

    const borderClasses = isLedgerType
        ? "flex gap-2 pt-2 border-t border-amber-200"
        : "flex gap-2 pt-2 border-t border-red-200";

    const aiSuggestionClasses = isLedgerType
        ? "text-xs bg-white border border-amber-200 rounded p-3 mt-2"
        : "text-xs bg-white border border-red-200 rounded p-3 mt-2";

    return (
        <div className={containerClasses}>
            <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-gray-900">{item.data.description}</span>
                        <Badge variant="outline" className="text-xs">
                            {item.data.date}
                        </Badge>
                    </div>
                    {item.suggested_je && (
                        <div className={aiSuggestionClasses}>
                            <div className="font-medium text-gray-900 mb-1">AI Suggested Journal Entry:</div>
                            <div className="space-y-1 text-gray-600">
                                <div>• Debit: {item.suggested_je.debit_account}</div>
                                <div>• Credit: {item.suggested_je.credit_account}</div>
                                <div>• Amount: {formatCurrency(item.suggested_je.amount, currency)}</div>
                            </div>
                        </div>
                    )}
                </div>
                <div className="ml-4">
                    <div className={`text-lg font-medium mb-2 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(Math.abs(item.data.amount), currency)}
                    </div>
                    {item.data.details && (
                        <div className="mt-1">
                            {item.data.details}
                        </div>
                    )}
                </div>
            </div>
            <div className={borderClasses}>
                <Button
                    type="button"
                    size="sm"
                    className={primaryActionClassName}
                    onClick={onApproveJE}
                    disabled={isLoading || isMonthLocked}
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="size-3 animate-spin" />
                            Processing...
                        </>
                    ) : (
                        <>
                            {primaryActionIcon}
                            {primaryActionLabel}
                        </>
                    )}
                </Button>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button type="button" size="sm" variant="outline" className="gap-2" disabled={isMonthLocked}>
                            <Link className="size-3" />
                            Match
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56">
                        <DropdownMenuItem className="cursor-pointer" onClick={onMatch}>
                            <Link className="size-4 mr-2" />
                            {matchActionLabel}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    onClick={onEdit}
                    disabled={isMonthLocked}
                >
                    <Edit2 className="size-3" />
                    Edit / Correct
                </Button>

                <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                        <Button type="button" size="sm" variant="outline" className="gap-2" disabled={isMonthLocked}>
                            More Actions
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" side="bottom" sideOffset={8} className="w-64">
                        <DropdownMenuItem className="cursor-pointer" onClick={onTimingDifference}>
                            Mark as Timing Difference
                        </DropdownMenuItem>
                        <DropdownMenuItem className="cursor-pointer" onClick={onIgnore}>
                            Mark as Non-Issue (Ignore)
                        </DropdownMenuItem>
                        <DropdownMenuItem className="cursor-pointer" onClick={onRequestInfo}>
                            Request Information / Follow-up
                        </DropdownMenuItem>
                        {onDelete && (
                            <>
                                <div className="h-px bg-gray-100 my-1" />
                                <DropdownMenuItem className="cursor-pointer text-red-600 focus:text-red-700 focus:bg-red-50" onClick={onDelete}>
                                    Delete Transaction
                                </DropdownMenuItem>
                            </>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
}
