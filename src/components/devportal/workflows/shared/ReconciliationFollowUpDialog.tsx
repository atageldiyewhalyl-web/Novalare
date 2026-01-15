import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquare, Loader2 } from 'lucide-react';

interface ReconciliationFollowUpDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    note: string;
    onNoteChange: (note: string) => void;
    onConfirm: () => void;
    isLoading?: boolean;
}

export function ReconciliationFollowUpDialog({
    open,
    onOpenChange,
    note,
    onNoteChange,
    onConfirm,
    isLoading = false
}: ReconciliationFollowUpDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Request Information / Mark for Follow-Up</DialogTitle>
                    <DialogDescription>
                        Add a note about what information is needed for this transaction. This will move it to the Follow-Up tab.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <div className="flex items-start gap-3 bg-blue-50 p-3 rounded-lg border border-blue-100 mb-4">
                        <MessageSquare className="size-5 text-blue-600 mt-0.5" />
                        <div className="text-sm text-blue-700">
                            <p>Your team will be notified about this request. You can continue with other transactions while waiting.</p>
                        </div>
                    </div>
                    <Textarea
                        placeholder="E.g., Missing receipt, unclear description, need confirmation from vendor..."
                        value={note}
                        onChange={(e) => onNoteChange(e.target.value)}
                        className="min-h-[100px]"
                    />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={onConfirm} className="gap-2" disabled={isLoading}>
                        {isLoading && <Loader2 className="size-4 animate-spin" />}
                        Save Follow-Up Item
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
