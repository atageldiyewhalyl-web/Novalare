import { useState, useEffect } from 'react';
import { Building, Settings, Archive, FileText, TrendingUp, Landmark, Users, Calendar, Upload, CheckCircle2, Circle, Download, ExternalLink, Trash2, Mail, BookOpen } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { companiesApi, documentsApi, activitiesApi, metricsApi, emailsApi, Company, Document, Activity, CompanyMetrics, Email } from '@/utils/api-client';
import { toast } from 'sonner';
import { EmailInbox } from './EmailInbox';

interface CompanyWorkspaceProps {
  companyId: string;
  onNavigate: (view: string, params?: any) => void;
}

export function CompanyWorkspace({ companyId, onNavigate }: CompanyWorkspaceProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [company, setCompany] = useState<Company | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [metrics, setMetrics] = useState<CompanyMetrics | null>(null);
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [companyId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [companyData, documentsData, activitiesData, metricsData, emailsData] = await Promise.all([
        companiesApi.getById(companyId),
        documentsApi.getByCompany(companyId),
        activitiesApi.getByCompany(companyId),
        metricsApi.getCompany(companyId),
        emailsApi.getByCompany(companyId),
      ]);
      setCompany(companyData);
      setDocuments(documentsData);
      setActivities(activitiesData);
      setMetrics(metricsData);
      setEmails(emailsData);
    } catch (err) {
      console.error('Failed to load company data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDocument = async (doc: Document) => {
    if (!confirm(`Are you sure you want to delete "${doc.name}"?\n\nThis action cannot be undone.`)) {
      return;
    }

    try {
      await documentsApi.delete(doc.companyId, doc.id);
      toast.success('Document deleted successfully');
      loadData(); // Reload all data to refresh the documents list
    } catch (error) {
      console.error('Failed to delete document:', error);
      toast.error('Failed to delete document');
    }
  };

  const handleSendEmail = async (emailData: {
    from: string;
    subject: string;
    body: string;
    attachments: File[];
  }) => {
    try {
      const result = await emailsApi.parseEmail(companyId, emailData);
      
      if (result.invoices.length > 0) {
        toast.success(
          `✅ Email processed successfully!\n\n` +
          `${result.invoices.length} invoice${result.invoices.length !== 1 ? 's' : ''} extracted with metadata.\n` +
          `Files stored securely. View in Workflows → Invoice Extraction.`,
          { duration: 6000 }
        );
      } else {
        toast.warning(
          'Email received but no invoices were extracted.\n\n' +
          'This might happen if attachments are not in a supported format (PDF, JPG, PNG).',
          { duration: 5000 }
        );
      }
      
      loadData(); // Reload all data to refresh emails and invoices
    } catch (error) {
      console.error('Failed to process email:', error);
      throw error;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading company...</p>
        </div>
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-600">Error: {error || 'Company not found'}</p>
        <Button onClick={loadData} variant="outline" className="mt-4">Retry</Button>
      </div>
    );
  }

  const workflows = [
    { 
      id: 'invoice-extraction',
      icon: FileText, 
      title: 'Invoice Extraction', 
      description: 'Extract and process invoice data', 
      count: `${metrics?.invoicesExtracted || 0} invoices this month`,
      color: 'blue'
    },
    { 
      id: 'bank-reconciliation',
      icon: Landmark, 
      title: 'Bank Reconciliation', 
      description: 'Match transactions with ledger entries', 
      count: `${metrics?.bankStatements || 0} statements processed`,
      color: 'green'
    },
    { 
      id: 'ap-reconciliation',
      icon: Users, 
      title: 'AP Reconciliation', 
      description: 'Reconcile vendor statements', 
      count: '1 reconciliation this month',
      color: 'purple'
    },
    { 
      id: 'journal-entries',
      icon: FileText, 
      title: 'Journal Entries', 
      description: 'Create journal entries with AI assistance', 
      count: '12 entries generated',
      color: 'orange'
    },
    { 
      id: 'month-end-close',
      icon: Calendar, 
      title: 'Month-End Close', 
      description: 'Complete month-end procedures', 
      count: metrics?.monthEndClose || 'Not started',
      color: 'red'
    },
  ];

  const checklistItems = [
    { step: 'Bank reconciliations', status: 'completed' },
    { step: 'AP reconciliations', status: 'completed' },
    { step: 'Invoice extraction completed', status: 'completed' },
    { step: 'Recurring JEs generated', status: 'completed' },
    { step: 'Variance analysis', status: 'in-progress' },
    { step: 'Final reports exported', status: 'pending' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="size-16 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
            <Building className="size-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl text-gray-900">{company.name}</h1>
            <div className="flex gap-3 mt-2 items-center">
              {company.tags?.map((tag: string, idx: number) => (
                <Badge key={idx} variant="secondary" className="text-xs">{tag}</Badge>
              ))}
              <div className="flex items-center gap-2 text-sm text-gray-600 bg-purple-50 px-3 py-1 rounded-md border border-purple-200">
                <Mail className="size-4 text-purple-600" />
                <span className="text-purple-900">invoices+{companyId}@novalare.app</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            className="gap-2 h-10"
            onClick={() => onNavigate('chart-of-accounts', { companyId, companyName: company.name })}
          >
            <BookOpen className="size-4" />
            <span className="text-sm">Chart of Accounts</span>
          </Button>
          <Button variant="outline" className="gap-2 h-10">
            <Archive className="size-4" />
            <span className="text-sm">Archive</span>
          </Button>
          <Button variant="outline" className="gap-2 h-10">
            <Settings className="size-4" />
            <span className="text-sm">Settings</span>
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="emails">
            <Mail className="size-4 mr-2" />
            Email Inbox
          </TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="workflows">Workflows</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="checklist">Close Checklist</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm text-gray-600">Documents Processed</CardTitle>
                <FileText className="size-4 text-gray-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl text-gray-900">{metrics?.documentsProcessed || 0}</div>
                <p className="text-xs text-gray-500 mt-1">This month</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm text-gray-600">Bank Statements</CardTitle>
                <Landmark className="size-4 text-gray-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl text-gray-900">{metrics?.bankStatements || 0}</div>
                <p className="text-xs text-gray-500 mt-1">Processed</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm text-gray-600">Invoices Extracted</CardTitle>
                <TrendingUp className="size-4 text-gray-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl text-gray-900">{metrics?.invoicesExtracted || 0}</div>
                <p className="text-xs text-gray-500 mt-1">This month</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm text-gray-600">Month-End Close</CardTitle>
                <Calendar className="size-4 text-gray-400" />
              </CardHeader>
              <CardContent>
                <div className="text-xl text-gray-900">{metrics?.monthEndClose || 'Not started'}</div>
                <p className="text-xs text-gray-500 mt-1">March 2024</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Recent Activity</CardTitle></CardHeader>
            <CardContent>
              {activities.length === 0 ? (
                <p className="text-center py-8 text-gray-500">No recent activity</p>
              ) : (
                <div className="space-y-4">
                  {activities.slice(0, 5).map((activity) => (
                    <div key={activity.id} className="flex items-start gap-4">
                      <div className="size-2 rounded-full bg-blue-600 mt-2" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-gray-900">{activity.action}</p>
                          <span className="text-sm text-gray-500">{activity.time}</span>
                        </div>
                        <p className="text-xs text-gray-500">{activity.date}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Documents</CardTitle>
                <Button className="gap-2 h-10 bg-gray-900 hover:bg-gray-800">
                  <Upload className="size-4" />
                  <span className="text-sm">Upload</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center mb-6 hover:border-blue-400 hover:bg-blue-50/50 transition-colors cursor-pointer">
                <Upload className="size-12 text-gray-400 mx-auto mb-4" />
                <p className="text-sm text-gray-900 mb-1">Drop invoices, statements, receipts here</p>
                <p className="text-xs text-gray-500">or click to browse</p>
              </div>
              {documents.length === 0 ? (
                <p className="text-center py-8 text-gray-500">No documents uploaded yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 text-gray-600 text-sm">File Name</th>
                        <th className="text-left py-3 px-4 text-gray-600 text-sm">Type</th>
                        <th className="text-left py-3 px-4 text-gray-600 text-sm">Date Uploaded</th>
                        <th className="text-left py-3 px-4 text-gray-600 text-sm">Status</th>
                        <th className="text-left py-3 px-4 text-gray-600 text-sm">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {documents.map((doc) => (
                        <tr key={doc.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-4 px-4 text-sm text-gray-900">{doc.name}</td>
                          <td className="py-4 px-4">
                            <Badge variant="outline" className="text-xs">{doc.type}</Badge>
                          </td>
                          <td className="py-4 px-4 text-sm text-gray-600">
                            {new Date(doc.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-4 px-4">
                            <Badge 
                              variant="secondary" 
                              className={`text-xs ${doc.status === 'Processed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}
                            >
                              {doc.status}
                            </Badge>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex gap-1">
                              {doc.fileUrl ? (
                                <>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-8 text-xs gap-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                    onClick={() => window.open(doc.fileUrl, '_blank')}
                                  >
                                    <ExternalLink className="size-3" />
                                    View
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-8 text-xs gap-1 text-green-600 hover:text-green-700 hover:bg-green-50"
                                    onClick={() => {
                                      const link = document.createElement('a');
                                      link.href = doc.fileUrl!;
                                      link.download = doc.name;
                                      link.click();
                                    }}
                                  >
                                    <Download className="size-3" />
                                    Download
                                  </Button>
                                </>
                              ) : (
                                <span className="text-xs text-gray-400">No file</span>
                              )}
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 text-xs gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => handleDeleteDocument(doc)}
                              >
                                <Trash2 className="size-3" />
                                Delete
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email Inbox Tab */}
        <TabsContent value="emails" className="mt-6">
          <EmailInbox
            emails={emails}
            companyId={companyId}
            companyEmail={company?.email}
            onSendEmail={handleSendEmail}
          />
        </TabsContent>

        {/* Workflows Tab */}
        <TabsContent value="workflows" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {workflows.map((workflow) => {
              const Icon = workflow.icon;
              return (
                <Card 
                  key={workflow.id} 
                  className="hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => onNavigate(workflow.id, { companyId, companyName: company.name })}
                >
                  <CardHeader>
                    <div className="flex items-start gap-4">
                      <div className={`size-12 rounded-lg bg-${workflow.color}-100 flex items-center justify-center`}>
                        <Icon className={`size-6 text-${workflow.color}-600`} />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-lg">{workflow.title}</CardTitle>
                        <p className="text-sm text-gray-600 mt-1">{workflow.description}</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-500">{workflow.count}</p>
                    <Button variant="outline" className="w-full mt-4 h-9">Open Workflow</Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-6 mt-6">
          <Card>
            <CardHeader><CardTitle>Reports</CardTitle></CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <FileText className="size-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No reports generated yet</p>
                <Button variant="outline" className="mt-4">Generate Report</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Close Checklist Tab */}
        <TabsContent value="checklist" className="space-y-6 mt-6">
          <Card>
            <CardHeader><CardTitle>Month-End Close Checklist - March 2024</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                {checklistItems.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      {item.status === 'completed' ? (
                        <CheckCircle2 className="size-6 text-green-600" />
                      ) : item.status === 'in-progress' ? (
                        <Circle className="size-6 text-yellow-600 fill-yellow-100" />
                      ) : (
                        <Circle className="size-6 text-gray-400" />
                      )}
                      <span className="text-sm text-gray-900">{item.step}</span>
                    </div>
                    {item.status !== 'completed' && (
                      <Button 
                        size="sm" 
                        variant={item.status === 'in-progress' ? 'default' : 'outline'}
                        className="h-8"
                      >
                        {item.status === 'in-progress' ? 'Continue' : 'Run'}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}