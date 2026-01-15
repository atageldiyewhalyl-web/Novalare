import { useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save } from 'lucide-react';
import { companiesApi } from '@/utils/api-client';
import { toast } from 'sonner@2.0.3';
import { useQueryClient } from '@tanstack/react-query';

interface CompanyProfileProps {
    companyId: string;
    initialName: string;
    onUpdate?: () => void;
}

export function CompanyProfile({ companyId, initialName, onUpdate }: CompanyProfileProps) {
    const { theme } = useTheme();
    const [name, setName] = useState(initialName);
    const [isSaving, setIsSaving] = useState(false);
    const queryClient = useQueryClient();

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!name.trim()) {
            toast.error('Company name cannot be empty');
            return;
        }

        if (name === initialName) {
            return;
        }

        try {
            setIsSaving(true);
            await companiesApi.update(companyId, { name });

            // Invalidate queries to refresh data
            await queryClient.invalidateQueries({ queryKey: ['companies'] });
            await queryClient.invalidateQueries({ queryKey: ['company', companyId] });

            toast.success('Company updated successfully');

            if (onUpdate) {
                onUpdate();
            }
        } catch (error) {
            console.error('Error updating company:', error);
            toast.error('Failed to update company name');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className={`
      rounded-xl border p-6
      ${theme === 'dark' ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-gray-100'}
    `}>
            <h3 className={`text-lg font-semibold mb-6 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                General Information
            </h3>

            <form onSubmit={handleSave} className="space-y-6 max-w-xl">
                <div className="space-y-2">
                    <Label htmlFor="companyName" className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                        Company Name
                    </Label>
                    <Input
                        id="companyName"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Enter company name"
                        className={theme === 'dark' ? 'bg-zinc-800 border-zinc-700 text-white' : ''}
                    />
                    <p className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                        This name will appear on your dashboard and in reports.
                    </p>
                </div>

                <div className="pt-2">
                    <Button
                        type="submit"
                        disabled={isSaving || name === initialName}
                        className="w-full sm:w-auto"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4 mr-2" />
                                Save Changes
                            </>
                        )}
                    </Button>
                </div>
            </form>
        </div>
    );
}
