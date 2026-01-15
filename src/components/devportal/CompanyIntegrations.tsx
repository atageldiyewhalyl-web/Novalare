import { useEffect, useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, RefreshCw, ExternalLink, Unplug } from 'lucide-react';
import { companiesApi } from '@/utils/api-client';

interface CompanyIntegrationsProps {
  companyId: string;
  companyName: string;
}

export function CompanyIntegrations({ companyId, companyName }: CompanyIntegrationsProps) {
  const { theme } = useTheme();
  const [qboConnected, setQboConnected] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadIntegrationStatus();
  }, [companyId]);

  const loadIntegrationStatus = async () => {
    try {
      setLoading(true);
      const company = await companiesApi.getById(companyId);
      setQboConnected(!!company.qbo_connection_id);
      setLastSynced(company.last_synced || null);
    } catch (err) {
      console.error('Failed to load integration status:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatLastSynced = (timestamp: string | null) => {
    if (!timestamp) return 'Never';
    
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffInMs = now.getTime() - date.getTime();
      const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
      
      if (diffInHours < 1) {
        const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
        return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`;
      } else if (diffInHours < 24) {
        return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`;
      } else {
        return date.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        });
      }
    } catch {
      return timestamp;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-[#65D3FD] rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading integrations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className={`text-2xl mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          Integrations
        </h1>
        <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
          Manage connections to accounting software and other services
        </p>
      </div>

      {/* QuickBooks Online Integration */}
      <Card className={`
        p-6
        ${theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-200'}
      `}>
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            {/* QuickBooks Logo */}
            <div className={`
              w-16 h-16 rounded-lg flex items-center justify-center
              ${qboConnected 
                ? 'bg-green-500/10' 
                : theme === 'dark' ? 'bg-zinc-800' : 'bg-gray-100'
              }
            `}>
              <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" fill={qboConnected ? '#2CA01C' : '#ccc'} />
                <text x="12" y="16" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">QB</text>
              </svg>
            </div>
            
            <div>
              <h3 className={`text-xl mb-1 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                QuickBooks Online
              </h3>
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                {qboConnected ? `Company: ${companyName}` : 'Not connected'}
              </p>
            </div>
          </div>
          
          {/* Connection Status Badge */}
          {qboConnected ? (
            <Badge className="bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400 border-green-500/20">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Connected
            </Badge>
          ) : (
            <Badge className="bg-gray-500/10 text-gray-600 dark:bg-gray-500/20 dark:text-gray-400 border-gray-500/20">
              <XCircle className="w-3 h-3 mr-1" />
              Not Connected
            </Badge>
          )}
        </div>

        {qboConnected ? (
          <>
            {/* Last Synced */}
            <div className="mb-4 pb-4 border-b border-zinc-800">
              <p className={`text-sm mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                Last synced:
              </p>
              <p className={`text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {formatLastSynced(lastSynced)}
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <Button 
                variant="outline"
                className={`flex-1 ${theme === 'dark' ? 'border-zinc-700 hover:bg-zinc-800' : ''}`}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Sync Now
              </Button>
              <Button 
                variant="outline"
                className={`flex-1 ${theme === 'dark' ? 'border-zinc-700 hover:bg-zinc-800' : ''}`}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                View History
              </Button>
              <Button 
                variant="outline"
                className={`
                  ${theme === 'dark' 
                    ? 'border-red-500/20 text-red-400 hover:bg-red-500/10' 
                    : 'border-red-500/20 text-red-600 hover:bg-red-50'
                  }
                `}
              >
                <Unplug className="w-4 h-4 mr-2" />
                Disconnect
              </Button>
            </div>

            {/* Sync History */}
            <div className="mt-6">
              <h4 className={`text-sm mb-3 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                Recent Sync History
              </h4>
              <div className="space-y-2">
                <div className={`
                  flex items-center justify-between p-3 rounded-lg
                  ${theme === 'dark' ? 'bg-zinc-800/50' : 'bg-gray-50'}
                `}>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <div>
                      <p className={`text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        Sync completed successfully
                      </p>
                      <p className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                        {formatLastSynced(lastSynced)}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className={theme === 'dark' ? 'border-zinc-700' : ''}>
                    1,234 transactions
                  </Badge>
                </div>
                
                <p className={`text-xs text-center py-2 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                  More sync history coming soon
                </p>
              </div>
            </div>

            {/* Account Mappings */}
            <div className="mt-6">
              <h4 className={`text-sm mb-3 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                Account Mappings
              </h4>
              <div className="space-y-2">
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                  Account mapping configuration coming soon
                </p>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-6">
            <p className={`mb-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              Connect QuickBooks Online to sync your company data
            </p>
            <Button className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800">
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Connect QuickBooks
            </Button>
          </div>
        )}
      </Card>

      {/* Other Integrations (Coming Soon) */}
      <Card className={`
        p-6
        ${theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-200'}
      `}>
        <h3 className={`text-lg mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          Other Integrations
        </h3>
        <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
          More integrations coming soon:
        </p>
        <ul className={`mt-3 space-y-2 text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
          <li className="flex items-center gap-2">
            <span>•</span> Xero
          </li>
          <li className="flex items-center gap-2">
            <span>•</span> Bank feeds
          </li>
          <li className="flex items-center gap-2">
            <span>•</span> Bill.com / Divvy
          </li>
        </ul>
      </Card>
    </div>
  );
}