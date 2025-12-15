import { Building, Plus, ExternalLink, Clock, MoreHorizontal, Archive, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useEffect, useState } from 'react';
import { companiesApi, settingsApi, Company, Settings } from '@/utils/api-client';
import { AddCompanyDialog } from './AddCompanyDialog';
import { useTheme } from '@/contexts/ThemeContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

interface CompaniesListProps {
  onNavigate: (view: string, params?: any) => void;
}

export function CompaniesList({ onNavigate }: CompaniesListProps) {
  const { theme } = useTheme();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [companiesData, settingsData] = await Promise.all([
        companiesApi.getAll(),
        settingsApi.get(),
      ]);
      setCompanies(companiesData);
      setSettings(settingsData);
    } catch (err) {
      console.error('Failed to load companies:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async (company: Company) => {
    try {
      await companiesApi.update(company.id, { status: 'Archived' });
      toast.success(`${company.name} has been archived`);
      loadData();
    } catch (err) {
      console.error('Failed to archive company:', err);
      toast.error('Failed to archive company');
    }
  };

  const handleDelete = async () => {
    if (!companyToDelete) return;
    
    setIsDeleting(true);
    try {
      await companiesApi.delete(companyToDelete.id);
      toast.success(`${companyToDelete.name} has been deleted`);
      loadData();
    } catch (err) {
      console.error('Failed to delete company:', err);
      toast.error('Failed to delete company');
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setCompanyToDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className={theme === 'premium-dark' 
            ? 'w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-4' 
            : 'w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4'
          }></div>
          <p className={theme === 'premium-dark' ? 'text-purple-200' : 'text-gray-600'}>Loading companies...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={theme === 'premium-dark' 
        ? 'p-6 bg-red-900/20 border border-red-500/30 rounded-lg' 
        : 'p-6 bg-red-50 border border-red-200 rounded-lg'
      }>
        <p className={theme === 'premium-dark' ? 'text-red-400' : 'text-red-600'}>Error: {error}</p>
        <Button onClick={loadData} variant="outline" className="mt-4">Retry</Button>
      </div>
    );
  }

  const activeCompanies = companies.filter(c => c.status === 'Active');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={theme === 'premium-dark' ? 'text-3xl text-white' : 'text-3xl text-gray-900'}>Companies</h1>
          <p className={theme === 'premium-dark' ? 'text-purple-200 mt-1' : 'text-gray-500 mt-1'}>Manage your client companies</p>
        </div>
        <AddCompanyDialog onSuccess={loadData} />
      </div>

      <Card className={theme === 'premium-dark' 
        ? 'bg-gray-900/50 border-purple-500/20' 
        : ''
      }>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={theme === 'premium-dark' 
                  ? 'border-b border-purple-500/20 bg-gray-900/80' 
                  : 'border-b border-gray-200 bg-gray-50'
                }>
                  <th className={theme === 'premium-dark' ? 'text-left py-4 px-6 text-purple-200 text-sm' : 'text-left py-4 px-6 text-gray-600 text-sm'}>Company Name</th>
                  <th className={theme === 'premium-dark' ? 'text-left py-4 px-6 text-purple-200 text-sm' : 'text-left py-4 px-6 text-gray-600 text-sm'}>Country</th>
                  <th className={theme === 'premium-dark' ? 'text-left py-4 px-6 text-purple-200 text-sm' : 'text-left py-4 px-6 text-gray-600 text-sm'}>Status</th>
                  <th className={theme === 'premium-dark' ? 'text-left py-4 px-6 text-purple-200 text-sm' : 'text-left py-4 px-6 text-gray-600 text-sm'}>Documents This Month</th>
                  <th className={theme === 'premium-dark' ? 'text-left py-4 px-6 text-purple-200 text-sm' : 'text-left py-4 px-6 text-gray-600 text-sm'}>Last Activity</th>
                  <th className={theme === 'premium-dark' ? 'text-left py-4 px-6 text-purple-200 text-sm' : 'text-left py-4 px-6 text-gray-600 text-sm'}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((company) => (
                  <tr 
                    key={company.id} 
                    className={theme === 'premium-dark' 
                      ? 'border-b border-purple-500/10 hover:bg-purple-500/5 transition-colors' 
                      : 'border-b border-gray-100 hover:bg-gray-50'
                    }
                  >
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className={theme === 'premium-dark'
                          ? 'size-10 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center'
                          : 'size-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center'
                        }>
                          <Building className="size-5 text-white" />
                        </div>
                        <span className={theme === 'premium-dark' ? 'text-sm text-white' : 'text-sm text-gray-900'}>{company.name}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <Badge 
                        variant="outline" 
                        className={theme === 'premium-dark' 
                          ? 'text-xs border-purple-500/30 text-purple-200' 
                          : 'text-xs'
                        }
                      >
                        {company.country}
                      </Badge>
                    </td>
                    <td className="py-4 px-6">
                      <Badge 
                        variant="secondary" 
                        className={theme === 'premium-dark' 
                          ? 'bg-green-500/20 text-green-400 text-xs border border-green-500/30' 
                          : 'bg-green-100 text-green-700 text-xs'
                        }
                      >
                        {company.status}
                      </Badge>
                    </td>
                    <td className={theme === 'premium-dark' ? 'py-4 px-6 text-sm text-white' : 'py-4 px-6 text-sm text-gray-900'}>{company.docsThisMonth?.toLocaleString() || 0}</td>
                    <td className="py-4 px-6">
                      <div className={theme === 'premium-dark' ? 'flex items-center gap-2 text-purple-300' : 'flex items-center gap-2 text-gray-600'}>
                        <Clock className="size-4" />
                        <span className="text-sm">{company.lastActivity}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={theme === 'premium-dark' 
                              ? 'h-8 w-8 p-0 text-purple-200 hover:text-white hover:bg-purple-500/10' 
                              : 'h-8 w-8 p-0'
                            }
                          >
                            <MoreHorizontal className="size-4" />
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent 
                          align="end" 
                          className={theme === 'premium-dark' 
                            ? 'w-48 bg-gray-900 border-purple-500/20' 
                            : 'w-48'
                          }
                        >
                          <DropdownMenuItem
                            onClick={() => onNavigate('company', { companyId: company.id })}
                            className={theme === 'premium-dark' 
                              ? 'text-purple-200 hover:bg-purple-500/10 hover:text-white focus:bg-purple-500/10 focus:text-white' 
                              : ''
                            }
                          >
                            <ExternalLink className="size-4 mr-2" />
                            Open
                          </DropdownMenuItem>
                          {company.status !== 'Archived' && (
                            <DropdownMenuItem
                              onClick={() => handleArchive(company)}
                              className={theme === 'premium-dark' 
                                ? 'text-purple-200 hover:bg-purple-500/10 hover:text-white focus:bg-purple-500/10 focus:text-white' 
                                : ''
                              }
                            >
                              <Archive className="size-4 mr-2" />
                              Archive
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator className={theme === 'premium-dark' ? 'bg-purple-500/20' : ''} />
                          <DropdownMenuItem
                            onClick={() => {
                              setCompanyToDelete(company);
                              setDeleteDialogOpen(true);
                            }}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="size-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className={theme === 'premium-dark' 
        ? 'flex items-center justify-between p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg' 
        : 'flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg'
      }>
        <div className="flex items-center gap-3">
          <div className={theme === 'premium-dark'
            ? 'size-10 rounded-full bg-purple-500/20 flex items-center justify-center'
            : 'size-10 rounded-full bg-blue-100 flex items-center justify-center'
          }>
            <Building className={theme === 'premium-dark' ? 'size-5 text-purple-400' : 'size-5 text-blue-600'} />
          </div>
          <div>
            <p className={theme === 'premium-dark' ? 'text-sm text-white' : 'text-sm text-gray-900'}>You're using {activeCompanies.length} of {settings?.companyLimit || 20} company slots</p>
            <p className={theme === 'premium-dark' ? 'text-xs text-purple-300' : 'text-xs text-gray-600'}>on your {settings?.plan || 'Pro'} plan</p>
          </div>
        </div>
        <Button 
          variant="outline" 
          size="sm"
          className={theme === 'premium-dark' 
            ? 'border-purple-500/30 text-purple-200 hover:bg-purple-500/10 hover:text-white' 
            : ''
          }
        >
          Upgrade Plan
        </Button>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {companyToDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete <strong>{companyToDelete?.name}</strong> and all associated data from your account.
              {companyToDelete?.docsThisMonth && companyToDelete.docsThisMonth > 0 && (
                <span className="block mt-2 text-amber-600">
                  ⚠️ This company has {companyToDelete.docsThisMonth} documents this month.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? 'Deleting...' : 'Delete Company'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}