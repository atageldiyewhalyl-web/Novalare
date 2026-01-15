import { useState, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useDebounce } from '@/hooks/useDebounce';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Search, Upload, Download, Eye, FileText, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { projectId, publicAnonKey } from '@/utils/supabase/info';
import { toast } from 'sonner@2.0.3';

interface CompanyDocumentsProps {
  companyId: string;
}

export function CompanyDocuments({ companyId }: CompanyDocumentsProps) {
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300); // Debounce search by 300ms
  const [selectedType, setSelectedType] = useState<string>('all');
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  const documentTypes = [
    { id: 'all', label: 'All Documents' },
    { id: 'bank', label: 'Bank Statements' },
    { id: 'vendor', label: 'Vendor Statements' },
    { id: 'receipt', label: 'Receipts' },
    { id: 'invoice', label: 'Invoices' },
    { id: 'other', label: 'Other' }
  ];

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        setLoading(true);
        console.log('🔍 Fetching documents for company:', companyId);
        console.log('🌐 API URL:', `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/documents/${companyId}`);
        
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/documents/${companyId}`,
          {
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
              'Content-Type': 'application/json'
            }
          }
        );

        console.log('📡 Response status:', response.status);
        console.log('📡 Response ok:', response.ok);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ Error response:', errorText);
          throw new Error(`Failed to fetch documents: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        console.log('✅ Fetched documents:', data);
        console.log('📄 Document count:', data.documents?.length || 0);
        
        setDocuments(data.documents || []);
      } catch (error: any) {
        console.error('❌ Error loading documents:', error);
        console.error('Error message:', error.message);
        toast.error('Failed to load documents: ' + error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDocuments();
  }, [companyId]);

  // Filter documents based on search and type
  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
                          doc.type.toLowerCase().includes(debouncedSearchQuery.toLowerCase());
    const matchesType = selectedType === 'all' || doc.documentType === selectedType;
    return matchesSearch && matchesType;
  });

  // Handle document download
  const handleDownload = async (doc: any) => {
    try {
      setDownloading(doc.id);
      
      // If we have a direct fileUrl, use it
      if (doc.fileUrl) {
        window.open(doc.fileUrl, '_blank');
      } else {
        // Otherwise, request a fresh signed URL
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/documents/${companyId}/download/${doc.id}`,
          {
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`
            }
          }
        );

        if (!response.ok) {
          throw new Error('Failed to generate download URL');
        }

        const data = await response.json();
        window.open(data.url, '_blank');
      }
      
      toast.success('Document opened in new tab');
    } catch (error) {
      console.error('Error downloading document:', error);
      toast.error('Failed to download document');
    } finally {
      setDownloading(null);
    }
  };

  // Handle document preview
  const handlePreview = (doc: any) => {
    if (doc.fileUrl) {
      window.open(doc.fileUrl, '_blank');
    } else {
      toast.error('Preview not available');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-2xl mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Documents
          </h1>
          <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
            All uploaded documents for this company
          </p>
        </div>
        
        <Button className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700">
          <Upload className="w-4 h-4 mr-2" />
          Upload Document
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        {/* Document Type Filter */}
        <div className="flex items-center gap-2">
          {documentTypes.map(type => (
            <button
              key={type.id}
              onClick={() => setSelectedType(type.id)}
              className={`
                px-3 py-1.5 rounded-lg text-sm transition-all
                ${selectedType === type.id
                  ? 'bg-indigo-600 text-white'
                  : theme === 'dark'
                    ? 'bg-zinc-800 text-gray-400 hover:text-white'
                    : 'bg-gray-100 text-gray-600 hover:text-gray-900'
                }
              `}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className={`
          absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5
          ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}
        `} />
        <Input
          type="text"
          placeholder="Search documents..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={`
            pl-10
            ${theme === 'dark' 
              ? 'bg-zinc-900 border-zinc-800 text-white placeholder:text-gray-500' 
              : 'bg-white border-gray-200 placeholder:text-gray-400'
            }
          `}
        />
      </div>

      {/* Documents Table */}
      {loading ? (
        <div className={`
          p-12 text-center rounded-lg border
          ${theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-200'}
        `}>
          <div className={`
            w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center
            ${theme === 'dark' ? 'bg-indigo-500/10' : 'bg-indigo-50'}
          `}>
            <Loader2 className={`w-8 h-8 animate-spin ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'}`} />
          </div>
          <h3 className={`text-xl mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Loading documents...
          </h3>
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className={`
          p-12 text-center rounded-lg border
          ${theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-200'}
        `}>
          <div className={`
            w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center
            ${theme === 'dark' ? 'bg-indigo-500/10' : 'bg-indigo-50'}
          `}>
            <FileText className={`w-8 h-8 ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'}`} />
          </div>
          <h3 className={`text-xl mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            No documents uploaded yet
          </h3>
          <p className={`mb-6 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
            Upload your first document to get started
          </p>
          <Button className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700">
            <Upload className="w-4 h-4 mr-2" />
            Upload Document
          </Button>
        </div>
      ) : (
        <div className={`
          rounded-lg border overflow-hidden
          ${theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-200'}
        `}>
          <Table>
            <TableHeader>
              <TableRow className={theme === 'dark' ? 'border-zinc-800' : 'border-gray-200'}>
                <TableHead className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>Name</TableHead>
                <TableHead className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>Type</TableHead>
                <TableHead className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>Date</TableHead>
                <TableHead className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>Status</TableHead>
                <TableHead className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDocuments.map((doc) => (
                <TableRow key={doc.id} className={theme === 'dark' ? 'border-zinc-800' : 'border-gray-200'}>
                  <TableCell className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                    {doc.name}
                  </TableCell>
                  <TableCell className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                    {doc.type}
                  </TableCell>
                  <TableCell className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                    {doc.date}
                  </TableCell>
                  <TableCell>
                    <Badge className="bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400">
                      Processed
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handlePreview(doc)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleDownload(doc)}
                        disabled={downloading === doc.id}
                      >
                        {downloading === doc.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

export default CompanyDocuments;