'use client';

import { useEffect, useState } from 'react';
import { fetchWithAuth } from '@/lib/auth-client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { FileText } from 'lucide-react';

interface AuditLog {
  auditId: string;
  tableName: string;
  action: string;
  changedBy: string;
  changedDate: string;
  changeReason?: string;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    try {
      const response = await fetchWithAuth('/api/audit-logs');
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
      }
    } catch (error) {
      console.error('Error loading audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-lg font-semibold text-foreground">System Audit Logs</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Track all system changes and user actions</p>
      </div>

      <Card>
        <CardContent className="p-3">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Timestamp</TableHead>
                  <TableHead className="text-xs">User</TableHead>
                  <TableHead className="text-xs">Action</TableHead>
                  <TableHead className="text-xs">Table</TableHead>
                  <TableHead className="text-xs">Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.auditId}>
                    <TableCell className="py-2.5 text-xs text-muted-foreground">
                      {new Date(log.changedDate).toLocaleString()}
                    </TableCell>
                    <TableCell className="py-2.5 text-xs font-medium">{log.changedBy}</TableCell>
                    <TableCell className="py-2.5">
                      <Badge
                        variant={
                          log.action === 'CREATE'
                            ? 'default'
                            : log.action === 'UPDATE'
                            ? 'secondary'
                            : 'destructive'
                        }
                        className="text-xs"
                      >
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2.5 text-xs text-muted-foreground">{log.tableName}</TableCell>
                    <TableCell className="py-2.5 text-xs text-muted-foreground">
                      {log.changeReason || 'N/A'}
                    </TableCell>
                  </TableRow>
                ))}
                {logs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <FileText className="h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-xs font-medium text-foreground mb-0.5">No audit logs found</p>
                        <p className="text-xs text-muted-foreground">System activity will appear here</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
