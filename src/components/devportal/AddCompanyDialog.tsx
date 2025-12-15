import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { companiesApi } from '@/utils/api-client';
import { toast } from 'sonner@2.0.3';

interface AddCompanyDialogProps {
  onSuccess?: () => void;
  trigger?: React.ReactNode;
}

export function AddCompanyDialog({ onSuccess, trigger }: AddCompanyDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    country: 'DE',
    chartOfAccounts: 'SKR03',
    status: 'Active' as 'Active' | 'Inactive' | 'Archived',
    tags: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError('Company name is required');
      return;
    }

    if (!formData.chartOfAccounts) {
      setError('Chart of Accounts is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const tagsArray = formData.tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);

      await companiesApi.create({
        name: formData.name.trim(),
        country: formData.country,
        chartOfAccounts: formData.chartOfAccounts,
        status: formData.status,
        tags: tagsArray.length > 0 ? tagsArray : undefined,
        docsThisMonth: 0,
        lastActivity: 'Just now',
      });

      toast.success(`${formData.name.trim()} created successfully!`);

      // Reset form
      setFormData({
        name: '',
        country: 'DE',
        chartOfAccounts: 'SKR03',
        status: 'Active',
        tags: '',
      });
      
      setOpen(false);
      
      // Notify parent to refresh data
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error('Failed to create company:', err);
      setError(err instanceof Error ? err.message : 'Failed to create company');
      toast.error(err instanceof Error ? err.message : 'Failed to create company');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="gap-2 h-10 bg-gray-900 hover:bg-gray-800">
            <Plus className="size-4" />
            <span className="text-sm">Add Company</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Company</DialogTitle>
          <DialogDescription>Enter the company details below to add a new company to the system.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Company Name *</Label>
            <Input
              id="name"
              placeholder="e.g., ACME Corporation GmbH"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="country">Country</Label>
            <Select
              value={formData.country}
              onValueChange={(value) => setFormData({ ...formData, country: value })}
              disabled={loading}
            >
              <SelectTrigger id="country">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DE">Germany (DE)</SelectItem>
                <SelectItem value="US">United States (US)</SelectItem>
                <SelectItem value="UK">United Kingdom (UK)</SelectItem>
                <SelectItem value="FR">France (FR)</SelectItem>
                <SelectItem value="ES">Spain (ES)</SelectItem>
                <SelectItem value="IT">Italy (IT)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="chartOfAccounts">Chart of Accounts *</Label>
            <Select
              value={formData.chartOfAccounts}
              onValueChange={(value) => setFormData({ ...formData, chartOfAccounts: value })}
              disabled={loading}
            >
              <SelectTrigger id="chartOfAccounts">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SKR03">SKR03 - Standard Chart of Accounts (Process Industry)</SelectItem>
                <SelectItem value="SKR04">SKR04 - Standard Chart of Accounts (Cost Accounting)</SelectItem>
                <SelectItem value="IKR">IKR - Industrial Chart of Accounts</SelectItem>
                <SelectItem value="IFRS">IFRS - International Financial Reporting Standards</SelectItem>
                <SelectItem value="GAAP">GAAP - Generally Accepted Accounting Principles</SelectItem>
                <SelectItem value="Custom">Custom - User-defined Chart of Accounts</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">Select the accounting standard used by this company. You can change this later in company settings.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value: any) => setFormData({ ...formData, status: value })}
              disabled={loading}
            >
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
                <SelectItem value="Archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tags">Tags (comma-separated)</Label>
            <Input
              id="tags"
              placeholder="e.g., Tech, Startup, VAT"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              disabled={loading}
            />
            <p className="text-xs text-gray-500">Optional: Add tags to categorize the company</p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="bg-gray-900 hover:bg-gray-800">
              {loading ? 'Creating...' : 'Create Company'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}