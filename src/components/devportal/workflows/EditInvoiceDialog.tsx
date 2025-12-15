import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { invoicesApi, Invoice } from '@/utils/api-client';
import { Pencil } from 'lucide-react';
import { toast } from 'sonner';

interface EditInvoiceDialogProps {
  invoice: Invoice;
  onSuccess: () => void;
}

export function EditInvoiceDialog({ invoice, onSuccess }: EditInvoiceDialogProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    vendor: invoice.vendor,
    invoiceNumber: invoice.invoiceNumber || '',
    date: invoice.date,
    dueDate: invoice.dueDate || '',
    net: invoice.net?.toString() || '',
    vat: invoice.vat?.toString() || '',
    gross: invoice.gross?.toString() || '',
    currency: invoice.currency || 'EUR',
    category: invoice.category || 'General Expense',
    status: invoice.status,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      
      await invoicesApi.update(invoice.companyId, invoice.id, {
        vendor: formData.vendor,
        invoiceNumber: formData.invoiceNumber,
        date: formData.date,
        dueDate: formData.dueDate,
        net: formData.net ? parseFloat(formData.net) : undefined,
        vat: formData.vat ? parseFloat(formData.vat) : undefined,
        gross: parseFloat(formData.gross),
        currency: formData.currency,
        category: formData.category,
        status: formData.status as 'Pending' | 'Reviewed' | 'Approved',
      });
      
      toast.success('Invoice updated successfully!');
      setOpen(false);
      onSuccess();
    } catch (error) {
      console.error('Failed to update invoice:', error);
      toast.error('Failed to update invoice');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-1">
          <Pencil className="size-3" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Invoice</DialogTitle>
          <DialogDescription>
            Update invoice details and change the status as it moves through your workflow.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Vendor */}
            <div className="space-y-2">
              <Label htmlFor="vendor">Vendor Name *</Label>
              <Input
                id="vendor"
                value={formData.vendor}
                onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                required
              />
            </div>

            {/* Invoice Number */}
            <div className="space-y-2">
              <Label htmlFor="invoiceNumber">Invoice Number</Label>
              <Input
                id="invoiceNumber"
                value={formData.invoiceNumber}
                onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
              />
            </div>

            {/* Date */}
            <div className="space-y-2">
              <Label htmlFor="date">Invoice Date *</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>

            {/* Due Date */}
            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date</Label>
              <Input
                id="dueDate"
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              />
            </div>

            {/* Net Amount */}
            <div className="space-y-2">
              <Label htmlFor="net">Net Amount</Label>
              <Input
                id="net"
                type="number"
                step="0.01"
                value={formData.net}
                onChange={(e) => setFormData({ ...formData, net: e.target.value })}
                placeholder="0.00"
              />
            </div>

            {/* VAT Amount */}
            <div className="space-y-2">
              <Label htmlFor="vat">VAT Amount</Label>
              <Input
                id="vat"
                type="number"
                step="0.01"
                value={formData.vat}
                onChange={(e) => setFormData({ ...formData, vat: e.target.value })}
                placeholder="0.00"
              />
            </div>

            {/* Gross Amount */}
            <div className="space-y-2">
              <Label htmlFor="gross">Total Amount *</Label>
              <Input
                id="gross"
                type="number"
                step="0.01"
                value={formData.gross}
                onChange={(e) => setFormData({ ...formData, gross: e.target.value })}
                required
                placeholder="0.00"
              />
            </div>

            {/* Currency */}
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select value={formData.currency} onValueChange={(value) => setFormData({ ...formData, currency: value })}>
                <SelectTrigger id="currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                  <SelectItem value="CHF">CHF</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="General Expense">General Expense</SelectItem>
                  <SelectItem value="Office Supplies">Office Supplies</SelectItem>
                  <SelectItem value="Professional Services">Professional Services</SelectItem>
                  <SelectItem value="Software & Subscriptions">Software & Subscriptions</SelectItem>
                  <SelectItem value="Travel & Entertainment">Travel & Entertainment</SelectItem>
                  <SelectItem value="Marketing">Marketing</SelectItem>
                  <SelectItem value="Utilities">Utilities</SelectItem>
                  <SelectItem value="Rent">Rent</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pending">📋 To Review - Needs verification</SelectItem>
                  <SelectItem value="Reviewed">✅ Verified - Ready for payment</SelectItem>
                  <SelectItem value="Approved">💰 Paid - Payment complete</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
