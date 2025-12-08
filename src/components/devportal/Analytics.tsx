import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { Activity, FileText, TrendingUp, AlertCircle, CheckCircle2, Clock, Download, BarChart3, Inbox } from 'lucide-react';
import { Button } from '../ui/button';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface AnalyticsEvent {
  id: string;
  timestamp: string;
  demoType: 'invoice' | 'pe' | 'bank-rec' | 'ap-rec' | 'expense';
  fileName: string;
  fileSize: number;
  fileType: string;
  success: boolean;
  errorMessage?: string;
  processingTime?: number;
  metadata?: Record<string, any>;
}

interface DemoStats {
  totalRuns: number;
  successRate: number;
  avgProcessingTime: number;
  totalFiles: number;
}

export function Analytics() {
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DemoStats | null>(null);
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d' | 'all'>('7d');

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/analytics?timeRange=${timeRange}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setEvents(data.events || []);
        setStats(data.stats || null);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportData = () => {
    const dataStr = JSON.stringify(events, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `analytics-${new Date().toISOString()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Process data for charts
  const demoTypeData = events.reduce((acc, event) => {
    const type = event.demoType;
    const existing = acc.find(item => item.name === type);
    if (existing) {
      existing.total += 1;
      if (event.success) existing.successful += 1;
    } else {
      acc.push({
        name: type,
        total: 1,
        successful: event.success ? 1 : 0
      });
    }
    return acc;
  }, [] as Array<{ name: string; total: number; successful: number }>);

  const successData = [
    { name: 'Successful', value: events.filter(e => e.success).length },
    { name: 'Failed', value: events.filter(e => !e.success).length }
  ];

  const timelineData = events
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .reduce((acc, event) => {
      const date = new Date(event.timestamp).toLocaleDateString();
      const existing = acc.find(item => item.date === date);
      if (existing) {
        existing.runs += 1;
      } else {
        acc.push({ date, runs: 1 });
      }
      return acc;
    }, [] as Array<{ date: string; runs: number }>);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const getDemoLabel = (type: string) => {
    const labels: Record<string, string> = {
      'invoice': 'Invoice Processing',
      'pe': 'PE 10-K Analysis',
      'bank-rec': 'Bank Reconciliation',
      'ap-rec': 'AP Reconciliation',
      'expense': 'Expense Categorization'
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  // Empty state when no data
  if (!events || events.length === 0) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl text-gray-900">Analytics Dashboard</h1>
            <p className="text-gray-500 mt-1">Track demo usage and performance metrics</p>
          </div>
          <div className="flex gap-2">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as any)}
              className="bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 text-sm"
            >
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="all">All Time</option>
            </select>
          </div>
        </div>

        {/* Empty State */}
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-6">
            <BarChart3 className="w-10 h-10 text-gray-400" />
          </div>
          <h2 className="text-2xl text-gray-900 mb-2">No Analytics Data Yet</h2>
          <p className="text-gray-500 text-center max-w-md mb-6">
            Start using the demo pages to see analytics data here. Each demo run will be tracked automatically.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 max-w-2xl">
            <h3 className="font-semibold text-gray-900 mb-3">📊 What Gets Tracked:</h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">•</span>
                <span><strong>Demo Type:</strong> Invoice Processing, PE Analysis, Bank Rec, etc.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">•</span>
                <span><strong>File Metadata:</strong> Name, size, type of uploaded files</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">•</span>
                <span><strong>Success/Failure:</strong> Whether processing completed successfully</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">•</span>
                <span><strong>Processing Time:</strong> How long each operation took</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">•</span>
                <span><strong>Timestamps:</strong> When each demo was run</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-500 mt-1">Track demo usage and performance metrics</p>
        </div>
        <div className="flex gap-2">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 text-sm"
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="all">All Time</option>
          </select>
          <Button onClick={exportData} variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export Data
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Runs</CardTitle>
              <Activity className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{stats.totalRuns}</div>
              <p className="text-xs text-gray-500 mt-1">Demo executions</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Success Rate</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{stats.successRate.toFixed(1)}%</div>
              <p className="text-xs text-gray-500 mt-1">Successful processing</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Avg Processing Time</CardTitle>
              <Clock className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{stats.avgProcessingTime.toFixed(2)}s</div>
              <p className="text-xs text-gray-500 mt-1">Per file</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Files Processed</CardTitle>
              <FileText className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{stats.totalFiles}</div>
              <p className="text-xs text-gray-500 mt-1">Total uploads</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts and Tables */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="events">Event Log</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Demo Type Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-gray-900">Demo Usage by Type</CardTitle>
                <CardDescription>Total runs per demo type</CardDescription>
              </CardHeader>
              <CardContent>
                {demoTypeData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={demoTypeData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="name" stroke="#6b7280" tick={{ fill: '#6b7280', fontSize: 12 }} />
                      <YAxis stroke="#6b7280" tick={{ fill: '#6b7280', fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                        labelStyle={{ color: '#111827', fontWeight: 600 }}
                      />
                      <Legend wrapperStyle={{ color: '#6b7280' }} />
                      <Bar dataKey="total" fill="#3b82f6" name="Total Runs" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="successful" fill="#10b981" name="Successful" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-gray-400">
                    <div className="text-center">
                      <Inbox className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No data available</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Success/Failure Pie */}
            <Card>
              <CardHeader>
                <CardTitle className="text-gray-900">Success vs Failure Rate</CardTitle>
                <CardDescription>Overall processing outcomes</CardDescription>
              </CardHeader>
              <CardContent>
                {successData.some(d => d.value > 0) ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={successData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {successData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : '#ef4444'} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-gray-400">
                    <div className="text-center">
                      <Inbox className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No data available</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="events">
          <Card>
            <CardHeader>
              <CardTitle className="text-gray-900">Event Log</CardTitle>
              <CardDescription>Detailed view of all demo executions (showing last 50)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Demo Type</TableHead>
                      <TableHead>File Name</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Processing Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.slice(0, 50).map((event) => (
                      <TableRow key={event.id}>
                        <TableCell className="text-gray-700 text-sm">
                          {new Date(event.timestamp).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {getDemoLabel(event.demoType)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-gray-700 max-w-xs truncate text-sm">
                          {event.fileName}
                        </TableCell>
                        <TableCell className="text-gray-600 text-sm">
                          {formatFileSize(event.fileSize)}
                        </TableCell>
                        <TableCell>
                          {event.success ? (
                            <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Success
                            </Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              Failed
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-gray-600 text-sm">
                          {event.processingTime ? `${event.processingTime.toFixed(2)}s` : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends">
          <Card>
            <CardHeader>
              <CardTitle className="text-gray-900">Usage Over Time</CardTitle>
              <CardDescription>Demo executions timeline</CardDescription>
            </CardHeader>
            <CardContent>
              {timelineData.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={timelineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" stroke="#6b7280" tick={{ fill: '#6b7280', fontSize: 12 }} />
                    <YAxis stroke="#6b7280" tick={{ fill: '#6b7280', fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                      labelStyle={{ color: '#111827', fontWeight: 600 }}
                    />
                    <Legend wrapperStyle={{ color: '#6b7280' }} />
                    <Line type="monotone" dataKey="runs" stroke="#3b82f6" strokeWidth={3} name="Demo Runs" dot={{ fill: '#3b82f6', r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[400px] text-gray-400">
                  <div className="text-center">
                    <Inbox className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No timeline data available</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
