import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Building2, RefreshCw, Trash2, ExternalLink, CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { projectId } from '@/utils/supabase/info';
import { useAuth } from '@/contexts/AuthContext';

interface Connection {
  id: string;
  type: 'quickbooks' | 'xero';
  company_name: string;
  realm_id?: string;
  tenant_id?: string;
  connected_at: string;
  sync_status?: string;
  last_synced_at?: string;
  sync_progress?: {
    company_info: boolean;
    accounts: boolean;
    vendors: boolean;
    customers: boolean;
  };
}

export function AccountingIntegrations() {
  const { session } = useAuth();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);

  useEffect(() => {
    if (session?.access_token) {
      loadConnections();
    } else {
      setLoading(false);
    }
  }, [session]);

  const loadConnections = async () => {
    if (!session?.access_token) {
      console.error('No access token found');
      toast.error('Please log in to view accounting connections');
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      
      console.log('📡 Loading accounting connections...');
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/accounting/connections`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Failed to load connections:', response.status, errorData);
        
        if (response.status === 401) {
          toast.error('Session expired. Please log in again.');
        } else {
          toast.error(errorData.error || 'Failed to load accounting connections');
        }
        throw new Error(errorData.error || 'Failed to load connections');
      }

      const data = await response.json();
      console.log('✅ Connections loaded:', data.connections?.length || 0);
      setConnections(data.connections || []);
    } catch (error) {
      console.error('Error loading connections:', error);
      // Error already toasted above
    } finally {
      setLoading(false);
    }
  };

  const connectQuickBooks = async () => {
    try {
      setConnecting(true);
      const token = session?.access_token;

      // Get OAuth URL
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/accounting/qbo/auth-url`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate auth URL');
      }

      const data = await response.json();
      
      // Store state for callback verification
      sessionStorage.setItem('qbo_oauth_state', data.state);
      
      // Open QuickBooks OAuth in popup
      const width = 600;
      const height = 700;
      const left = (window.screen.width - width) / 2;
      const top = (window.screen.height - height) / 2;
      
      const popup = window.open(
        data.authUrl,
        'QuickBooks OAuth',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      // Add timeout for popup (2 minutes)
      const popupTimeout = setTimeout(() => {
        if (popup && !popup.closed) {
          popup.close();
          toast.error('Connection timeout. Please try again.');
          window.removeEventListener('message', handleMessage);
          setConnecting(false);
        }
      }, 120000); // 2 minutes

      // Listen for OAuth callback
      const handleMessage = async (event: MessageEvent) => {
        // Handle OAuth success
        if (event.data.type === 'qbo-oauth-success') {
          clearTimeout(popupTimeout);
          popup?.close();
          
          const { connection } = event.data;
          console.log('✅ QuickBooks connected:', connection);
          
          toast.success(`Connected to ${connection.company_name}!`);
          sessionStorage.removeItem('qbo_oauth_state');
          
          // Show helpful message for Unknown Company
          if (connection.company_name === 'Unknown Company') {
            toast.info('⏳ QuickBooks authorization takes 30-60 seconds to process. Syncing will start automatically...', {
              duration: 15000
            });

            // Auto-sync company info in 60 seconds (to allow QB authorization to propagate)
            setTimeout(async () => {
              console.log('🔄 [60s] Syncing company info and chart of accounts...');
              toast.loading('Syncing company information from QuickBooks...', { id: 'qb-sync' });
              
              try {
                // 1. Sync company info first
                await syncCompanyInfo(connection.id);
                
                // 2. Then sync chart of accounts
                await syncAccounts(connection.id);
                
                toast.success('✅ Company synced from QuickBooks!', { id: 'qb-sync' });
                
                // Reload connections to show updated name
                await loadConnections();
              } catch (error) {
                console.error('❌ Auto-sync failed:', error);
                toast.error('Sync failed. You can manually sync from the connection settings.', { id: 'qb-sync' });
              }
            }, 60000); // 60 seconds
          }
          
          // reload connections first
          await loadConnections();

          // For companies that already have names, sync immediately
          if (connection.company_name !== 'Unknown Company') {
            setTimeout(() => {
              console.log('🔄 Triggering immediate sync for named company...');
              syncAll(connection.id);
            }, 3000);
          }
          
          window.removeEventListener('message', handleMessage);
          setConnecting(false);
        }
        
        // Handle OAuth error
        if (event.data.type === 'qbo-oauth-error') {
          clearTimeout(popupTimeout);
          popup?.close();
          
          const { error } = event.data;
          console.error('❌ QuickBooks OAuth error:', error);
          
          toast.error(`Failed to connect: ${error}`);
          sessionStorage.removeItem('qbo_oauth_state');
          
          window.removeEventListener('message', handleMessage);
          setConnecting(false);
        }
      };
      
      window.addEventListener('message', handleMessage);
      
      // Check if popup was blocked
      if (!popup || popup.closed) {
        toast.error('Popup was blocked. Please allow popups for this site.');
        window.removeEventListener('message', handleMessage);
      }
    } catch (error) {
      console.error('Error connecting QuickBooks:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to connect QuickBooks');
    } finally {
      setConnecting(false);
    }
  };

  const syncCompanyInfo = async (connectionId: string) => {
    try {
      setSyncing(connectionId);
      const token = session?.access_token;

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/accounting/sync/${connectionId}/company-info`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to sync company info');
      }

      toast.success('Company information synced');
      
      // Sync accounts next
      await syncAccounts(connectionId);
    } catch (error) {
      console.error('Error syncing company info:', error);
      toast.error('Failed to sync company info');
    } finally {
      setSyncing(null);
    }
  };

  const syncAccounts = async (connectionId: string) => {
    try {
      setSyncing(connectionId);
      const token = session?.access_token;

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/accounting/sync/${connectionId}/accounts`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to sync accounts');
      }

      const data = await response.json();
      toast.success(`Synced ${data.accounts_count} accounts`);
      loadConnections();
    } catch (error) {
      console.error('Error syncing accounts:', error);
      toast.error('Failed to sync accounts');
    } finally {
      setSyncing(null);
    }
  };

  const syncVendors = async (connectionId: string) => {
    try {
      setSyncing(connectionId);
      const token = session?.access_token;

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/accounting/sync/${connectionId}/vendors`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to sync vendors');
      }

      const data = await response.json();
      toast.success(`Synced ${data.vendors_count} vendors`);
      loadConnections();
    } catch (error) {
      console.error('Error syncing vendors:', error);
      toast.error('Failed to sync vendors');
    } finally {
      setSyncing(null);
    }
  };

  const syncCustomers = async (connectionId: string) => {
    try {
      setSyncing(connectionId);
      const token = session?.access_token;

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/accounting/sync/${connectionId}/customers`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to sync customers');
      }

      const data = await response.json();
      toast.success(`Synced ${data.customers_count} customers`);
      loadConnections();
    } catch (error) {
      console.error('Error syncing customers:', error);
      toast.error('Failed to sync customers');
    } finally {
      setSyncing(null);
    }
  };

  const syncAll = async (connectionId: string) => {
    try {
      setSyncing(connectionId);
      console.log('🔄 Starting full sync for connection:', connectionId);
      
      // Run sequentially to provide progress feedback
      await syncCompanyInfo(connectionId);
      await syncVendors(connectionId);
      await syncCustomers(connectionId);
      
      toast.success('All QuickBooks data synced successfully');
    } catch (error) {
      console.error('Error during full sync:', error);
      // Individual syncs show their own errors
    } finally {
      setSyncing(null);
      loadConnections();
    }
  };

  const disconnectConnection = async (connectionId: string) => {
    if (!confirm('Are you sure you want to disconnect this accounting system? This will remove all synced data.')) {
      return;
    }

    try {
      const token = session?.access_token;

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/accounting/connections/${connectionId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to disconnect');
      }

      toast.success('Disconnected successfully');
      loadConnections();
    } catch (error) {
      console.error('Error disconnecting:', error);
      toast.error('Failed to disconnect');
    }
  };

  const refreshCompanyName = async (connectionId: string) => {
    try {
      setSyncing(connectionId);
      const token = session?.access_token;

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/accounting/connections/${connectionId}/refresh-company-name`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Handle 403 specifically (authorization still propagating)
        if (response.status === 403) {
          toast.error('⏳ QuickBooks authorization is still processing. Please wait another 30-60 seconds and try again.', {
            duration: 6000
          });
          return;
        }
        
        throw new Error(errorData.error || 'Failed to refresh company name');
      }

      const data = await response.json();
      toast.success(`✅ Company name updated to: ${data.company_name}`);
      loadConnections();
    } catch (error) {
      console.error('Error refreshing company name:', error);
      
      // Always show the error to the user so they know what happened
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error('Failed to refresh company name');
      }
    } finally {
      setSyncing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl text-gray-900 dark:text-white">Accounting Integrations</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Connect your QuickBooks or Xero account to sync chart of accounts and ledger data
        </p>
      </div>

      {/* Connect New Integration */}
      <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-white">Connect Accounting System</CardTitle>
          <CardDescription className="text-gray-500 dark:text-gray-400">
            Choose an accounting system to connect to Novalare
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* QuickBooks */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h3 className="text-gray-900 dark:text-white">QuickBooks Online</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Connect to QBO company</p>
                </div>
              </div>
              <Button
                onClick={connectQuickBooks}
                disabled={connecting}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
              >
                {connecting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  'Connect QuickBooks'
                )}
              </Button>
            </div>

            {/* Xero */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 space-y-4 opacity-50">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="text-gray-900 dark:text-white">Xero</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Coming soon</p>
                </div>
              </div>
              <Button
                disabled
                className="w-full"
                variant="outline"
              >
                Coming Soon
              </Button>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <p className="mb-2">
                  <strong>QuickBooks Setup Required:</strong>
                </p>
                <p className="text-blue-700 dark:text-blue-300">
                  Before connecting, ensure you have created a QuickBooks app in the Intuit Developer Portal and 
                  added the <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">QBO_CLIENT_ID</code>, 
                  <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded ml-1">QBO_CLIENT_SECRET</code>, and 
                  <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded ml-1">QBO_REDIRECT_URI</code> environment 
                  variables to your Supabase Edge Functions.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Connected Systems */}
      {connections.length > 0 && (
        <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white">Connected Systems</CardTitle>
            <CardDescription className="text-gray-500 dark:text-gray-400">
              Manage your connected accounting systems
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {connections.map((connection) => (
                <div
                  key={connection.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                        connection.type === 'quickbooks' 
                          ? 'bg-green-100 dark:bg-green-900/20' 
                          : 'bg-blue-100 dark:bg-blue-900/20'
                      }`}>
                        <Building2 className={`w-6 h-6 ${
                          connection.type === 'quickbooks'
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-blue-600 dark:text-blue-400'
                        }`} />
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-gray-900 dark:text-white">{connection.company_name}</h3>
                          <Badge 
                            variant={connection.sync_status === 'active' ? 'default' : 'destructive'}
                            className="text-xs"
                          >
                            {connection.sync_status === 'active' ? (
                              <><CheckCircle2 className="w-3 h-3 mr-1" /> Active</>
                            ) : (
                              <><XCircle className="w-3 h-3 mr-1" /> Error</>
                            )}
                          </Badge>
                          {connection.company_name === 'Unknown Company' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => refreshCompanyName(connection.id)}
                              disabled={syncing === connection.id}
                              className="text-xs h-6 px-2"
                              title="QuickBooks authorization may still be propagating. Wait 30 seconds and click to refresh."
                            >
                              {syncing === connection.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                'Refresh Name'
                              )}
                            </Button>
                          )}
                        </div>
                        
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                          {connection.type === 'quickbooks' ? 'QuickBooks Online' : 'Xero'}
                          {connection.realm_id && ` • ID: ${connection.realm_id}`}
                        </p>
                        
                        {connection.sync_progress && (
                          <div className="flex flex-wrap gap-2 mb-2">
                            <Badge variant="outline" className={connection.sync_progress.company_info ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : ''}>
                              Company Info {connection.sync_progress.company_info && '✓'}
                            </Badge>
                            <Badge variant="outline" className={connection.sync_progress.accounts ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : ''}>
                              Accounts {connection.sync_progress.accounts && '✓'}
                            </Badge>
                            <Badge variant="outline" className={connection.sync_progress.vendors ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : ''}>
                              Vendors {connection.sync_progress.vendors && '✓'}
                            </Badge>
                            <Badge variant="outline" className={connection.sync_progress.customers ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : ''}>
                              Customers {connection.sync_progress.customers && '✓'}
                            </Badge>
                          </div>
                        )}
                        
                        {connection.last_synced_at && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Last synced: {new Date(connection.last_synced_at).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => syncAll(connection.id)}
                        disabled={syncing === connection.id || connection.company_name === 'Unknown Company'}
                        title={connection.company_name === 'Unknown Company' ? 'Please refresh company name before syncing' : 'Sync all data from QuickBooks'}
                      >
                        {syncing === connection.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => disconnectConnection(connection.id)}
                        className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}