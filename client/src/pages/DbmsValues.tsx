import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Database, RefreshCw, Table as TableIcon, Users, BookOpen, Calendar, AlertCircle, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL } from "@/lib/constants";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface TableStructure {
  name: string;
  type: string;
  notNull: boolean;
  defaultValue: string | null;
  primaryKey: boolean;
}

interface TableData {
  structure: TableStructure[];
  data: any[];
  rowCount: number;
  error?: string;
}

interface DbmsData {
  success: boolean;
  summary: {
    totalTables: number;
    totalRows: number;
    timestamp: string;
    user: string;
  };
  tables: Record<string, TableData>;
}

export default function DbmsValues() {
  const [dbmsData, setDbmsData] = useState<DbmsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [deleteRowId, setDeleteRowId] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  const fetchDbmsData = async () => {
    setLoading(true);
    setError("");
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Please login first to access DBMS values');
      }

      const response = await fetch(`${API_BASE_URL}/dbms-values`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 401) {
        // Token expired or invalid
        localStorage.removeItem('token');
        throw new Error('Session expired. Please login again');
      }

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setDbmsData(data);
        
        // Set first table as selected by default
        const tableNames = Object.keys(data.tables);
        if (tableNames.length > 0 && !selectedTable) {
          setSelectedTable(tableNames[0]);
        }
        
        toast({
          title: "Database Values Loaded",
          description: `Found ${data.summary.totalTables} tables with ${data.summary.totalRows} total rows`,
        });
      } else {
        throw new Error(data.message || 'Failed to fetch database values');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      
      // If authentication error, show login suggestion
      if (errorMessage.includes('login') || errorMessage.includes('Session expired')) {
        toast({
          title: "Authentication Required",
          description: "Please login first to access DBMS values",
          variant: "destructive",
          action: (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => window.location.href = '/'}
            >
              Go to Login
            </Button>
          )
        });
      } else {
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive"
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDbmsData();
  }, []);

  const getTableIcon = (tableName: string) => {
    if (tableName.includes('user')) return <Users className="h-4 w-4" />;
    if (tableName.includes('student')) return <BookOpen className="h-4 w-4" />;
    if (tableName.includes('teacher')) return <Users className="h-4 w-4" />;
    if (tableName.includes('attendance')) return <Calendar className="h-4 w-4" />;
    if (tableName.includes('session')) return <Calendar className="h-4 w-4" />;
    return <TableIcon className="h-4 w-4" />;
  };

  const formatValue = (value: any): string => {
    if (value === null) return 'NULL';
    if (value === undefined) return 'UNDEFINED';
    if (typeof value === 'string') {
      // Handle very long strings (like embedding data)
      if (value.length > 100) {
        return value.substring(0, 100) + '...';
      }
      // Handle JSON arrays
      if (value.startsWith('[') && value.endsWith(']')) {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed) && parsed.length > 3) {
            return `[${parsed.slice(0, 3).join(', ')}...] (${parsed.length} items)`;
          }
        } catch (e) {
          // Not valid JSON, treat as regular string
        }
      }
    }
    return String(value);
  };

  const getTypeColor = (type: string): string => {
    if (type.includes('INTEGER')) return 'bg-blue-100 text-blue-800';
    if (type.includes('TEXT') || type.includes('VARCHAR')) return 'bg-green-100 text-green-800';
    if (type.includes('DATETIME')) return 'bg-purple-100 text-purple-800';
    if (type.includes('BOOLEAN')) return 'bg-orange-100 text-orange-800';
    return 'bg-gray-100 text-gray-800';
  };

  const handleDeleteRow = async (tableName: string, rowData: any) => {
    setDeleting(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token found');

      // Find the primary key column
      const table = dbmsData?.tables[tableName];
      if (!table) throw new Error('Table not found');

      const pkColumn = table.structure.find(col => col.primaryKey);
      if (!pkColumn) throw new Error('No primary key found for this table');

      const pkValue = rowData[pkColumn.name];

      // Delete the row
      const response = await fetch(`${API_BASE_URL}/dbms-values/delete`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tableName,
          primaryKeyColumn: pkColumn.name,
          primaryKeyValue: pkValue
        })
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: `Row deleted successfully from ${tableName}`
        });
        // Refresh the data
        fetchDbmsData();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete row');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete row';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setDeleting(false);
      setDeleteRowId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading database values...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-4">
          <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
          <p className="text-destructive">{error}</p>
          <Button onClick={fetchDbmsData} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!dbmsData) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">No data available</p>
      </div>
    );
  }

  const tableNames = Object.keys(dbmsData.tables).sort();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Database className="h-6 w-6" />
            DBMS Values
          </h1>
          <p className="text-muted-foreground">
            Complete database tables and values for debugging
          </p>
        </div>
        <Button onClick={fetchDbmsData} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Summary Card */}
      <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{dbmsData.summary.totalTables}</div>
              <div className="text-sm text-muted-foreground">Total Tables</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{dbmsData.summary.totalRows}</div>
              <div className="text-sm text-muted-foreground">Total Rows</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{dbmsData.summary.user}</div>
              <div className="text-sm text-muted-foreground">Current User</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {new Date(dbmsData.summary.timestamp).toLocaleTimeString()}
              </div>
              <div className="text-sm text-muted-foreground">Last Updated</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tables Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Tables Overview</CardTitle>
          <CardDescription>Click on a table to view its detailed structure and data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {tableNames.map((tableName) => {
              const table = dbmsData.tables[tableName];
              return (
                <Button
                  key={tableName}
                  variant={selectedTable === tableName ? "default" : "outline"}
                  className="h-auto p-4 flex flex-col items-start gap-2"
                  onClick={() => setSelectedTable(tableName)}
                >
                  <div className="flex items-center gap-2 w-full">
                    {getTableIcon(tableName)}
                    <span className="font-medium truncate">{tableName}</span>
                  </div>
                  <div className="flex items-center gap-2 w-full text-xs">
                    <Badge variant="secondary" className="text-xs">
                      {table.rowCount} rows
                    </Badge>
                    {table.error && (
                      <Badge variant="destructive" className="text-xs">
                        Error
                      </Badge>
                    )}
                  </div>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Selected Table Details */}
      {selectedTable && dbmsData.tables[selectedTable] && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getTableIcon(selectedTable)}
              {selectedTable}
            </CardTitle>
            <CardDescription>
              {dbmsData.tables[selectedTable].error 
                ? `Error: ${dbmsData.tables[selectedTable].error}`
                : `${dbmsData.tables[selectedTable].rowCount} rows, ${dbmsData.tables[selectedTable].structure.length} columns`
              }
              {!dbmsData.tables[selectedTable].error && (
                <div className="mt-1 text-xs text-muted-foreground">
                  Columns: {dbmsData.tables[selectedTable].structure.map(col => col.name).join(', ')}
                </div>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {dbmsData.tables[selectedTable].error ? (
              <div className="text-center py-8">
                <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
                <p className="text-destructive">{dbmsData.tables[selectedTable].error}</p>
              </div>
            ) : (
              <Tabs defaultValue="data" className="w-full">
                <TabsList>
                  <TabsTrigger value="data">Data ({dbmsData.tables[selectedTable].rowCount})</TabsTrigger>
                  <TabsTrigger value="structure">Structure ({dbmsData.tables[selectedTable].structure.length})</TabsTrigger>
                </TabsList>
                
                <TabsContent value="data" className="mt-4">
                  <div className="border rounded-md overflow-hidden flex flex-col bg-background">
                    <div className="overflow-auto max-h-[600px] w-full border-b">
                      <table className="w-full border-collapse">
                        <thead className="sticky top-0 z-10 bg-muted/50">
                          <tr>
                            {dbmsData.tables[selectedTable].structure.map((col) => (
                              <th 
                                key={col.name} 
                                className="font-semibold whitespace-nowrap min-w-[150px] px-3 py-2 text-left border-r border-border/50 bg-muted/50 text-sm"
                              >
                                <div className="flex items-center gap-1">
                                  {col.name}
                                  {col.primaryKey && <Badge className="text-xs">PK</Badge>}
                                </div>
                              </th>
                            ))}
                            <th className="font-semibold whitespace-nowrap min-w-[100px] px-3 py-2 text-left border-r border-border/50 bg-muted/50 text-sm">
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {dbmsData.tables[selectedTable].data.length === 0 ? (
                            <tr>
                              <td 
                                colSpan={dbmsData.tables[selectedTable].structure.length}
                                className="text-center py-8 text-muted-foreground"
                              >
                                No data in this table
                              </td>
                            </tr>
                          ) : (
                            dbmsData.tables[selectedTable].data.map((row, index) => (
                              <tr key={index} className="hover:bg-muted/50 border-b border-border/30">
                                {dbmsData.tables[selectedTable].structure.map((col) => (
                                  <td 
                                    key={col.name} 
                                    className="font-mono text-xs whitespace-nowrap min-w-[150px] px-3 py-2 border-r border-border/50"
                                  >
                                    <div className="max-w-[250px] overflow-hidden">
                                      <span 
                                        className="block truncate cursor-help" 
                                        title={`${col.name}: ${formatValue(row[col.name])}`}
                                      >
                                        {formatValue(row[col.name])}
                                      </span>
                                    </div>
                                  </td>
                                ))}
                                <td className="px-3 py-2 border-r border-border/50">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setDeleteRowId(row)}
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                    <div className="p-2 text-xs text-muted-foreground border-t bg-muted/20">
                      📊 {dbmsData.tables[selectedTable].rowCount} rows × {dbmsData.tables[selectedTable].structure.length} columns | 💡 Scroll horizontally and vertically to see all data. Hover over text to see full values.
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="structure" className="mt-4">
                  <div className="border rounded-md overflow-hidden flex flex-col bg-background">
                    <div className="overflow-auto max-h-[400px] w-full border-b">
                      <table className="w-full border-collapse">
                        <thead className="sticky top-0 z-10 bg-muted/50">
                          <tr>
                            <th className="font-semibold min-w-[150px] px-3 py-2 text-left border-r border-border/50 bg-muted/50 text-sm">Column Name</th>
                            <th className="font-semibold min-w-[150px] px-3 py-2 text-left border-r border-border/50 bg-muted/50 text-sm">Data Type</th>
                            <th className="font-semibold min-w-[150px] px-3 py-2 text-left border-r border-border/50 bg-muted/50 text-sm">Constraints</th>
                            <th className="font-semibold min-w-[150px] px-3 py-2 text-left bg-muted/50 text-sm">Default Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dbmsData.tables[selectedTable].structure.map((col) => (
                            <tr key={col.name} className="hover:bg-muted/50 border-b border-border/30">
                              <td className="font-semibold min-w-[150px] px-3 py-2 border-r border-border/50">
                                <div className="flex items-center gap-2">
                                  {col.name}
                                  {col.primaryKey && <Badge className="text-xs">PRIMARY KEY</Badge>}
                                </div>
                              </td>
                              <td className="min-w-[150px] px-3 py-2 border-r border-border/50">
                                <Badge className={getTypeColor(col.type)}>
                                  {col.type}
                                </Badge>
                              </td>
                              <td className="min-w-[150px] px-3 py-2 border-r border-border/50">
                                {col.notNull && <Badge variant="outline" className="text-xs">NOT NULL</Badge>}
                              </td>
                              <td className="font-mono text-sm min-w-[150px] px-3 py-2">
                                {col.defaultValue || 'NULL'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="p-2 text-xs text-muted-foreground border-t bg-muted/20">
                      📋 {dbmsData.tables[selectedTable].structure.length} columns | 💡 Scroll to see all column details
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteRowId !== null} onOpenChange={(open) => !open && setDeleteRowId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Row</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this row from {selectedTable}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteRowId && handleDeleteRow(selectedTable, deleteRowId)}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}