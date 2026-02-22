import { useState, useEffect } from "react";
import { useStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { SEMESTERS, DEPARTMENTS, SECTIONS, API_BASE_URL } from "@/lib/constants";
import { 
  Search, 
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Loader2,
  BarChart,
  Eye,
  CheckCircle2,
  XCircle,
  Activity,
  HelpCircle
} from "lucide-react";
import { 
  Bar, 
  BarChart as RechartsBarChart, 
  Line, 
  LineChart, 
  CartesianGrid, 
  XAxis, 
  YAxis, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";
import { cn } from "@/lib/utils";

// Helper functions for ML display
const getMLTrendIcon = (trend: string | null) => {
  if (!trend) return <span className="text-xs text-muted-foreground">N/A</span>;
  switch (trend) {
    case 'improving': 
      return (
        <div className="flex items-center gap-1 text-green-600">
          <TrendingUp className="h-4 w-4" />
          <span className="text-xs font-medium">Improving</span>
        </div>
      );
    case 'stable': 
      return (
        <div className="flex items-center gap-1 text-blue-600">
          <Minus className="h-4 w-4" />
          <span className="text-xs font-medium">Stable</span>
        </div>
      );
    case 'declining': 
      return (
        <div className="flex items-center gap-1 text-red-600">
          <TrendingDown className="h-4 w-4" />
          <span className="text-xs font-medium">Declining</span>
        </div>
      );
    default: return <span className="text-xs text-muted-foreground">N/A</span>;
  }
};

const getMLRiskIcon = (risk: string | null) => {
  if (!risk) return <span className="text-2xl text-muted-foreground">-</span>;
  switch (risk) {
    case 'low': return <span className="text-4xl" style={{ filter: 'grayscale(0%) contrast(100%)' }}>😊</span>;
    case 'moderate': return <span className="text-4xl" style={{ filter: 'grayscale(0%) contrast(100%)' }}>😐</span>;
    case 'high': return <span className="text-4xl" style={{ filter: 'grayscale(0%) contrast(100%)' }}>😟</span>;
    default: return <span className="text-2xl text-muted-foreground">-</span>;
  }
};

const getMLConsistencyIcon = (consistency: string | null) => {
  if (!consistency) return <span className="text-muted-foreground">-</span>;
  switch (consistency) {
    case 'regular': return <span className="text-green-600">●●●</span>;
    case 'moderately_irregular': return <span className="text-yellow-600">●●○</span>;
    case 'highly_irregular': return <span className="text-red-600">●○○</span>;
    default: return <span className="text-muted-foreground">-</span>;
  }
};

const getMLAttentivenessIcon = (attentiveness: string | null) => {
  if (!attentiveness) return <span className="text-muted-foreground text-xs">-</span>;
  switch (attentiveness) {
    case 'actively_attentive': 
      return (
        <div className="flex items-center gap-1.5">
          <span className="text-lg">⚡</span>
          <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border border-green-300 text-xs font-semibold">
            Full Energy
          </Badge>
        </div>
      );
    case 'moderately_attentive': 
      return (
        <div className="flex items-center gap-1.5">
          <span className="text-lg">🔋</span>
          <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100 border border-yellow-300 text-xs font-semibold">
            Half Energy
          </Badge>
        </div>
      );
    case 'passively_attentive': 
      return (
        <div className="flex items-center gap-1.5">
          <span className="text-lg">🪫</span>
          <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border border-red-300 text-xs font-semibold">
            Low Energy
          </Badge>
        </div>
      );
    default: return <span className="text-muted-foreground text-xs">-</span>;
  }
};

const getMLLabel = (value: string | null, defaultLabel: string = "Not Available") => {
  if (!value) return defaultLabel;
  return value.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

export default function AttendanceAnalysis() {
  const { currentUser } = useStore();
  const { toast } = useToast();
  
  const isTeacher = currentUser?.role === 'teacher';
  const isStudent = currentUser?.role === 'student';

  // Render student view or teacher view based on role
  if (isStudent) {
    return <StudentAnalysisView />;
  }

  if (isTeacher) {
    return <TeacherAnalysisView />;
  }

  // Default fallback
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Card className="shadow-md border border-border/50">
        <CardContent className="p-12 text-center">
          <div className="space-y-4">
            <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
              <BarChart className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-muted-foreground">Access Denied</h3>
              <p className="text-sm text-muted-foreground mt-2">
                You don't have permission to view this page.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Teacher Analysis View Component
function TeacherAnalysisView() {
  const { currentUser } = useStore();
  const { toast } = useToast();
  
  const [filterSemester, setFilterSemester] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterSection, setFilterSection] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [thresholdFilter, setThresholdFilter] = useState<'all' | 'above' | 'below'>('all');
  
  // API data state
  const [apiData, setApiData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasValidFilters, setHasValidFilters] = useState(false);
  
  // Available subjects based on selected filters
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(false);

  // Teacher's all subjects overview
  const [overviewData, setOverviewData] = useState<any>(null);
  const [isLoadingOverview, setIsLoadingOverview] = useState(false);

  const isTeacher = currentUser?.role === 'teacher';

  // Fetch teacher's all subjects overview on mount
  useEffect(() => {
    const fetchOverview = async () => {
      setIsLoadingOverview(true);
      try {
        const token = localStorage.getItem('token');
        if (!token) return;

        const response = await fetch(`${API_BASE_URL}/analytics/teacher-subjects-overview`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        const data = await response.json();
        if (response.ok) {
          setOverviewData(data);
        }
      } catch (error) {
        console.error('Error fetching overview:', error);
      } finally {
        setIsLoadingOverview(false);
      }
    };

    if (isTeacher) {
      fetchOverview();
    }
  }, [isTeacher]);

  // Fetch available subjects when semester, department, and section are selected
  useEffect(() => {
    const fetchSubjects = async () => {
      if (!filterSemester || !filterDept || !filterSection) {
        setAvailableSubjects([]);
        setFilterSubject("");
        return;
      }

      setIsLoadingSubjects(true);
      console.log('Fetching subjects for:', { filterSemester, filterDept, filterSection });
      
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          throw new Error('Authentication required');
        }

        const params = new URLSearchParams({
          semester: filterSemester,
          department: filterDept,
          section: filterSection
        });

        const url = `${API_BASE_URL}/timetable/subjects-by-department?${params}`;
        console.log('Fetching from URL:', url);

        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        const data = await response.json();
        console.log('Subjects API response:', data);

        if (response.ok) {
          const subjects = data.subjects || [];
          setAvailableSubjects(subjects);
          console.log('Available subjects set to:', subjects);
          console.log('Number of subjects:', subjects.length);
          // Reset subject selection when filters change
          setFilterSubject("");
          
          if (subjects.length === 0) {
            console.warn('No subjects found for selected filters');
          }
        } else {
          console.error('Failed to fetch subjects:', data.message);
          setAvailableSubjects([]);
          setFilterSubject("");
        }
      } catch (error: any) {
        console.error('Error fetching subjects:', error);
        setAvailableSubjects([]);
        setFilterSubject("");
      } finally {
        setIsLoadingSubjects(false);
      }
    };

    fetchSubjects();
  }, [filterSemester, filterDept, filterSection]);

  // Check if required filters are selected
  useEffect(() => {
    const valid = filterSemester && filterDept && filterSection;
    setHasValidFilters(!!valid);
    
    if (!valid) {
      setError("Please select Semester, Department, and Section");
      setApiData(null);
    } else {
      setError("");
    }
  }, [filterSemester, filterDept, filterSection]);

  // Check teacher authorization for selected filters
  const checkTeacherAuthorization = (): { authorized: boolean; message?: string } => {
    if (!currentUser || !hasValidFilters || !filterSubject) return { authorized: true };

    const teacher = currentUser;
    
    // Check if teacher is registered for the selected semester
    const teacherSemesters = teacher.semesters || [];
    if (!teacherSemesters.includes(filterSemester)) {
      return { authorized: false, message: "You are not registered to teach Semester " + filterSemester };
    }

    // Check if teacher is registered for the selected department
    const teacherDepartments = teacher.departments || [];
    if (!teacherDepartments.includes(filterDept)) {
      return { authorized: false, message: "You are not registered to teach in " + filterDept + " department" };
    }

    // Check if teacher is registered for the selected section
    const teacherSections = teacher.sections || [];
    if (!teacherSections.includes(filterSection)) {
      return { authorized: false, message: "You are not registered to teach Section " + filterSection };
    }

    // Check if teacher is registered for the selected subject
    const teacherSubjects = teacher.subjects || [];
    if (!teacherSubjects.includes(filterSubject)) {
      return { authorized: false, message: "You are not registered to teach " + filterSubject };
    }

    return { authorized: true };
  };

  // API call function
  const fetchAnalyticsData = async () => {
    if (!hasValidFilters) {
      toast({
        title: "Missing Filters",
        description: "Please select Semester, Department, and Section",
        variant: "destructive"
      });
      return;
    }

    if (!filterSubject) {
      toast({
        title: "Subject Required",
        description: "Please select a subject to view analytics",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required');
      }

      // Construct the correct API endpoint
      const params = new URLSearchParams({
        classId: filterDept,
        sectionId: filterSection,
        semester: filterSemester,
        subject: filterSubject
      });

      const endpoint = `/analytics/class-stats?${params}`;

      console.log('Fetching analytics data from:', endpoint);

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      console.log('Analytics API response:', data);

      if (response.ok) {
        if (!data.students || data.students.length === 0) {
          setError("No students found for the selected filters. Students may not be registered for this subject.");
          setApiData(null);
        } else {
          setApiData(data);
          setError("");
          toast({
            title: "Data Loaded",
            description: `Found ${data.students.length} students for ${filterSubject}`,
          });
        }
      } else {
        if (data.message === "No students available for the selected filters") {
          setError("No students are registered for this subject in the selected class and section.");
          setApiData(null);
        } else {
          throw new Error(data.message || 'Failed to fetch analytics data');
        }
      }
    } catch (error: any) {
      console.error('Analytics fetch error:', error);
      setError(error.message || 'Failed to fetch analytics data');
      setApiData(null);
      toast({
        title: "Error",
        description: error.message || "Failed to fetch analytics data",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-fetch when subject is selected (and other filters are valid)
  useEffect(() => {
    if (hasValidFilters && filterSubject) {
      // First check teacher authorization
      const authCheck = checkTeacherAuthorization();
      if (!authCheck.authorized) {
        setError(authCheck.message || "Not authorized");
        setApiData(null);
        return;
      }
      
      // If authorized, fetch data
      fetchAnalyticsData();
    } else {
      // Clear data when filters are incomplete
      setApiData(null);
      if (hasValidFilters && !filterSubject) {
        setError("Please select a Subject to view analytics");
      }
    }
  }, [filterSubject, hasValidFilters, filterSemester, filterDept, filterSection]);

  // Handle filter changes
  const handleFilterChange = (filterType: string, value: string) => {
    switch (filterType) {
      case 'semester':
        setFilterSemester(value);
        break;
      case 'department':
        setFilterDept(value);
        break;
      case 'section':
        setFilterSection(value);
        break;
      case 'subject':
        setFilterSubject(value);
        break;
    }
  };

  // Dynamic tooltip styles for dark mode
  const getTooltipStyle = (borderColor: string) => {
    if (typeof window !== 'undefined' && document.documentElement.classList.contains('dark')) {
      return {
        backgroundColor: 'hsl(142 25% 10%)',
        border: `2px solid hsl(142 30% 20%)`,
        borderRadius: '12px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5), 0 4px 16px rgba(0, 0, 0, 0.3)',
        color: 'hsl(0 0% 100%)'
      };
    }
    return {
      backgroundColor: '#fff',
      border: `2px solid ${borderColor}`,
      borderRadius: '12px',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15), 0 4px 16px rgba(0, 0, 0, 0.1)',
      color: '#374151'
    };
  };

  const getAxisColor = () => {
    if (typeof window !== 'undefined' && document.documentElement.classList.contains('dark')) {
      return 'hsl(0 0% 100%)';
    }
    return '#6b7280';
  };

  const getGridColor = () => {
    if (typeof window !== 'undefined' && document.documentElement.classList.contains('dark')) {
      return 'hsl(142 30% 20%)';
    }
    return '#e5e7eb';
  };

  const getStrokeColor = () => {
    if (typeof window !== 'undefined' && document.documentElement.classList.contains('dark')) {
      return 'hsl(142 30% 20%)';
    }
    return '#fff';
  };

  const getActiveDotFill = () => {
    if (typeof window !== 'undefined' && document.documentElement.classList.contains('dark')) {
      return 'hsl(142 25% 10%)';
    }
    return '#fff';
  };

  // Student Login Page Only (As per request)
  if (!isTeacher) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="mb-8">
          <h1 className="text-3xl font-serif font-bold text-primary mb-2">Student Analytics</h1>
          <p className="text-sm text-muted-foreground uppercase tracking-wider">Your personal attendance insights</p>
        </div>
        
        <Card className="shadow-md border border-border/50">
          <CardContent className="p-12 text-center">
            <div className="space-y-4">
              <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
                <BarChart className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-muted-foreground">Student Analytics</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Student analytics view is available. Please check your attendance records.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Teacher View
  return (
    <div className="space-y-8">
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-bold text-primary mb-2">Attendance Analysis</h1>
        <p className="text-sm text-muted-foreground uppercase tracking-wider">Comprehensive attendance insights and analytics</p>
      </div>

      {/* OVERVIEW GRAPH - All Subjects Attendance Variance */}
      {overviewData && overviewData.subjects && overviewData.subjects.length > 0 && (
        <Card className="border-0 shadow-2xl bg-gradient-to-br from-background via-background to-primary/5">
          <CardHeader className="pb-4 border-b border-border/50">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl font-serif font-bold text-primary mb-1">Teaching Overview</CardTitle>
                <CardDescription className="text-sm font-medium">Attendance performance across all your assigned subjects</CardDescription>
              </div>
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <BarChart className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-8 pb-6">
            <div style={{ height: '400px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart 
                  data={overviewData.subjects}
                  margin={{ top: 30, right: 40, left: 50, bottom: 120 }}
                  barGap={8}
                  barCategoryGap="20%"
                >
                  <defs>
                    <linearGradient id="colorGreen" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.9}/>
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0.6}/>
                    </linearGradient>
                    <linearGradient id="colorYellow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.9}/>
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.6}/>
                    </linearGradient>
                    <linearGradient id="colorRed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity={0.9}/>
                      <stop offset="100%" stopColor="#ef4444" stopOpacity={0.6}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    stroke={getGridColor()} 
                    vertical={false}
                    strokeOpacity={0.3}
                  />
                  <XAxis 
                    dataKey="label" 
                    angle={-35}
                    textAnchor="end"
                    height={110}
                    interval={0}
                    tick={{ 
                      fill: getAxisColor(), 
                      fontSize: 12,
                      fontWeight: 500,
                      fontFamily: 'system-ui, -apple-system, sans-serif'
                    }}
                    tickLine={{ stroke: getAxisColor(), strokeWidth: 1 }}
                    axisLine={{ stroke: getAxisColor(), strokeWidth: 2 }}
                  />
                  <YAxis 
                    label={{ 
                      value: 'Attendance Percentage (%)', 
                      angle: -90, 
                      position: 'insideLeft',
                      offset: 10,
                      style: { 
                        fill: getAxisColor(),
                        fontSize: 13,
                        fontWeight: 600,
                        fontFamily: 'system-ui, -apple-system, sans-serif'
                      }
                    }}
                    tick={{ 
                      fill: getAxisColor(),
                      fontSize: 12,
                      fontWeight: 500
                    }}
                    tickLine={{ stroke: getAxisColor(), strokeWidth: 1 }}
                    axisLine={{ stroke: getAxisColor(), strokeWidth: 2 }}
                    domain={[0, 100]}
                    ticks={[0, 25, 50, 75, 100]}
                  />
                  <RechartsTooltip 
                    contentStyle={{
                      ...getTooltipStyle('#10b981'),
                      padding: '12px 16px',
                      fontSize: '14px',
                      fontWeight: 500
                    }}
                    formatter={(value: any) => [`${value}%`, 'Attendance']}
                    labelStyle={{ fontWeight: 600, marginBottom: '4px' }}
                    cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }}
                  />
                  <Bar 
                    dataKey="averageAttendance" 
                    radius={[10, 10, 0, 0]}
                    maxBarSize={60}
                  >
                    {overviewData.subjects.map((entry: any, index: number) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={
                          entry.averageAttendance >= 75 
                            ? 'url(#colorGreen)' 
                            : entry.averageAttendance >= 60 
                            ? 'url(#colorYellow)' 
                            : 'url(#colorRed)'
                        }
                        stroke={
                          entry.averageAttendance >= 75 
                            ? '#10b981' 
                            : entry.averageAttendance >= 60 
                            ? '#f59e0b' 
                            : '#ef4444'
                        }
                        strokeWidth={2}
                      />
                    ))}
                  </Bar>
                </RechartsBarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-6 pt-4 border-t border-border/50">
              <div className="flex items-center justify-center gap-8 text-sm">
                <div className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-md bg-gradient-to-br from-green-500 to-green-600 shadow-sm border-2 border-green-500"></div>
                  <span className="font-medium text-foreground">Excellent (≥75%)</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-md bg-gradient-to-br from-yellow-500 to-yellow-600 shadow-sm border-2 border-yellow-500"></div>
                  <span className="font-medium text-foreground">Moderate (60-74%)</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-md bg-gradient-to-br from-red-500 to-red-600 shadow-sm border-2 border-red-500"></div>
                  <span className="font-medium text-foreground">At Risk (&lt;60%)</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* FILTER SECTION - Always show this first */}
      <Card className="shadow-md border border-border/50">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent pb-4">
          <CardTitle className="text-base font-bold uppercase text-muted-foreground">Filters & Controls</CardTitle>
        </CardHeader>
        <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Semester</label>
            <Select value={filterSemester} onValueChange={(value) => handleFilterChange('semester', value)}>
              <SelectTrigger className="h-10 border-primary/20 hover:border-primary/50 transition-colors">
                <SelectValue placeholder="Select Semester" />
              </SelectTrigger>
              <SelectContent>
                {SEMESTERS.map(s => (
                  <SelectItem key={s} value={s}>Sem {s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Dept</label>
            <Select value={filterDept} onValueChange={(value) => handleFilterChange('department', value)}>
              <SelectTrigger className="h-10 border-primary/20 hover:border-primary/50 transition-colors">
                <SelectValue placeholder="Select Dept"/>
              </SelectTrigger>
              <SelectContent>
                {DEPARTMENTS.map(cls => (
                  <SelectItem key={cls} value={cls}>{cls}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Section</label>
            <Select value={filterSection} onValueChange={(value) => handleFilterChange('section', value)}>
              <SelectTrigger className="h-10 border-primary/20 hover:border-primary/50 transition-colors">
                <SelectValue placeholder="Select Section"/>
              </SelectTrigger>
              <SelectContent>
                {SECTIONS.map(sec => (
                  <SelectItem key={sec} value={sec}>Section {sec}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Subject</label>
            <Select 
              value={filterSubject} 
              onValueChange={(value) => handleFilterChange('subject', value)}
              disabled={!hasValidFilters || isLoadingSubjects}
            >
              <SelectTrigger className={cn(
                "h-10 border-primary/20 hover:border-primary/50 transition-colors",
                (!hasValidFilters || isLoadingSubjects) && "opacity-50 cursor-not-allowed"
              )}>
                <SelectValue placeholder={
                  isLoadingSubjects 
                    ? "Loading subjects..." 
                    : availableSubjects.length === 0 && hasValidFilters
                    ? "No subjects available"
                    : "Select Subject"
                } />
              </SelectTrigger>
              <SelectContent>
                {(() => {
                  console.log('Rendering subject dropdown with availableSubjects:', availableSubjects);
                  console.log('availableSubjects length:', availableSubjects.length);
                  console.log('hasValidFilters:', hasValidFilters);
                  
                  if (availableSubjects.length === 0) {
                    return (
                      <SelectItem value="no-subjects" disabled>
                        {hasValidFilters ? "No subjects found for this class" : "Select filters first"}
                      </SelectItem>
                    );
                  }
                  
                  return availableSubjects.map((subject: string, index: number) => (
                    <SelectItem key={`${subject}-${index}`} value={subject}>{subject}</SelectItem>
                  ));
                })()}
              </SelectContent>
            </Select>
            {hasValidFilters && availableSubjects.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {availableSubjects.length} subject{availableSubjects.length !== 1 ? 's' : ''} available
              </p>
            )}
          </div>
          
          {/* Validation Message */}
          {error && (
            <div className="col-span-full">
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md border border-destructive/20">
                <AlertTriangle className="h-4 w-4" />
                {error}
              </div>
            </div>
          )}
          
          {/* Loading Indicator */}
          {isLoading && (
            <div className="col-span-full">
              <div className="flex items-center gap-2 text-sm text-primary bg-primary/10 p-3 rounded-md border border-primary/20">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading analytics data...
              </div>
            </div>
          )}

          {/* Manual Refresh Button */}
          {hasValidFilters && filterSubject && !isLoading && (
            <div className="col-span-full">
              <Button 
                onClick={fetchAnalyticsData}
                variant="outline"
                className="w-full"
              >
                <BarChart className="h-4 w-4 mr-2" />
                Refresh Analytics Data
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Only show analytics content when we have valid data */}
      {apiData && !error && !isLoading ? (
        <AnalyticsContent apiData={apiData} />
      ) : (
        /* Show placeholder when no data */
        <Card className="shadow-md border border-border/50">
          <CardContent className="p-12 text-center">
            <div className="space-y-4">
              <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
                <BarChart className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-muted-foreground">No Analytics Data</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  {!hasValidFilters 
                    ? "Please select Semester, Department, and Section to continue"
                    : !filterSubject 
                    ? "Please select a Subject to view analytics"
                    : "No data available for the selected filters"
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  // Analytics Content Component (to be rendered when data is available)
  function AnalyticsContent({ apiData }: { apiData: any }) {
    // Filter students based on search and threshold
    const filteredStudents = (apiData.students || []).filter((student: any) => {
      const matchesSearch = searchQuery === "" || 
        student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.usn.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesThreshold = thresholdFilter === 'all' ||
        (thresholdFilter === 'above' && student.percentage >= 75) ||
        (thresholdFilter === 'below' && student.percentage < 75);
      
      return matchesSearch && matchesThreshold;
    });

    return (
      <>
        {/* Two graphs side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Graph 1: Attendance Trend */}
          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-bold">Attendance Trend</CardTitle>
              <CardDescription className="text-sm">Weekly attendance pattern analysis</CardDescription>
            </CardHeader>
            <CardContent className="pt-6" style={{ height: '320px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart 
                  data={apiData.trendData || []} 
                  margin={{ top: 25, right: 35, left: 25, bottom: 25 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={getGridColor()} />
                  <XAxis dataKey="name" stroke={getAxisColor()} fontSize={12} fontWeight="500" />
                  <YAxis stroke={getAxisColor()} fontSize={12} fontWeight="500" />
                  <RechartsTooltip 
                    contentStyle={{
                      ...getTooltipStyle('#3b82f6'),
                      boxShadow: '0 10px 25px rgba(59, 130, 246, 0.2)'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="avg" 
                    stroke="#3b82f6" 
                    strokeWidth={3}
                    dot={{ fill: getActiveDotFill(), stroke: '#3b82f6', strokeWidth: 2, r: 5 }}
                    activeDot={{ r: 7, stroke: '#3b82f6', strokeWidth: 3, fill: getActiveDotFill() }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Graph 2: Attendance Risk Distribution */}
          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-bold">Attendance Risk Distribution</CardTitle>
              <CardDescription className="text-sm">Student count by risk category</CardDescription>
            </CardHeader>
            <CardContent className="pt-6" style={{ height: '320px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={apiData.riskDistribution || []}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="count"
                    label={({ name, value }: any) => `${name}: ${value}`}
                  >
                    {(apiData.riskDistribution || []).map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={['#10b981', '#f59e0b', '#ef4444'][index % 3]} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* ML Model Legend */}
        <Card className="shadow-md border border-border/50 bg-muted/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold uppercase">ML Model Legend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="font-semibold mb-2">Trend:</p>
                <div className="space-y-1">
                  <div className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-green-600" /> Improving</div>
                  <div className="flex items-center gap-2"><Minus className="h-4 w-4 text-blue-600" /> Stable</div>
                  <div className="flex items-center gap-2"><TrendingDown className="h-4 w-4 text-red-600" /> Declining</div>
                </div>
              </div>
              <div>
                <p className="font-semibold mb-2">Risk:</p>
                <div className="space-y-1">
                  <div className="flex items-center gap-2"><span className="text-2xl" style={{ filter: 'grayscale(0%) contrast(100%)' }}>😊</span> Low Risk (Above 75%)</div>
                  <div className="flex items-center gap-2"><span className="text-2xl" style={{ filter: 'grayscale(0%) contrast(100%)' }}>😐</span> Moderate Risk (Around 75%)</div>
                  <div className="flex items-center gap-2"><span className="text-2xl" style={{ filter: 'grayscale(0%) contrast(100%)' }}>😟</span> High Risk (Below 75%)</div>
                </div>
              </div>
              <div>
                <p className="font-semibold mb-2">Consistency:</p>
                <div className="space-y-1">
                  <div className="flex items-center gap-2"><span className="text-green-600">●●●</span> Regular</div>
                  <div className="flex items-center gap-2"><span className="text-yellow-600">●●○</span> Moderate</div>
                  <div className="flex items-center gap-2"><span className="text-red-600">●○○</span> Irregular</div>
                </div>
              </div>
              <div>
                <p className="font-semibold mb-2">Attentiveness:</p>
                <div className="space-y-1">
                  <div className="flex items-center gap-2"><span className="text-lg">⚡</span> Full Energy (Active)</div>
                  <div className="flex items-center gap-2"><span className="text-lg">🔋</span> Half Energy (Moderate)</div>
                  <div className="flex items-center gap-2"><span className="text-lg">🪫</span> Low Energy (Passive)</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Student Table */}
        {apiData.students && apiData.students.length > 0 && (
          <Card className="shadow-md border border-border/50">
            <CardHeader>
              <CardTitle className="text-lg font-bold">Student Attendance Records</CardTitle>
              <CardDescription>
                Total Classes: {apiData.overallStats?.totalClasses || 0} | 
                Average Attendance: {apiData.overallStats?.averageAttendance?.toFixed(1) || 0}%
              </CardDescription>
              
              {/* Search and Filter Controls */}
              <div className="flex flex-col sm:flex-row gap-3 mt-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name or USN..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={thresholdFilter === 'above' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setThresholdFilter('above')}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Above 75%
                  </Button>
                  <Button
                    variant={thresholdFilter === 'below' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setThresholdFilter('below')}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Below 75%
                  </Button>
                  {thresholdFilter !== 'all' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setThresholdFilter('all')}
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>USN</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-center">Attended</TableHead>
                      <TableHead className="text-center">Absent</TableHead>
                      <TableHead>Attendance %</TableHead>
                      <TableHead className="text-center">Trend</TableHead>
                      <TableHead className="text-center">Risk</TableHead>
                      <TableHead className="text-center">Consistency</TableHead>
                      <TableHead className="text-center">Attentiveness</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                          No students found matching your criteria
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredStudents.map((student: any) => (
                        <TableRow key={student.id}>
                          <TableCell className="font-mono text-sm">{student.usn}</TableCell>
                          <TableCell className="font-medium">{student.name}</TableCell>
                          <TableCell className="text-center">{student.present || 0}</TableCell>
                          <TableCell className="text-center">{student.absent || 0}</TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">{student.percentage}%</span>
                                <Badge 
                                  variant={student.percentage >= 75 ? "default" : "destructive"}
                                  className="text-xs"
                                >
                                  {student.percentage >= 75 ? "Good" : "At Risk"}
                                </Badge>
                              </div>
                              <Progress 
                                value={student.percentage} 
                                className={cn(
                                  "h-2",
                                  student.percentage >= 75 ? "bg-green-200" : "bg-red-200"
                                )}
                              />
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {getMLTrendIcon(student.trend || null)}
                          </TableCell>
                          <TableCell className="text-center">
                            {getMLRiskIcon(student.risk || null)}
                          </TableCell>
                          <TableCell className="text-center">
                            {getMLConsistencyIcon(student.consistency || null)}
                          </TableCell>
                          <TableCell className="text-center">
                            {getMLAttentivenessIcon(student.attentiveness || null)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              
              {/* Summary Stats */}
              <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  Showing {filteredStudents.length} of {apiData.students.length} students
                </span>
                <span>
                  Below 75%: {apiData.students.filter((s: any) => s.percentage < 75).length} students
                </span>
              </div>
            </CardContent>
          </Card>
        )}
      </>
    );
  }
}


// Student Analysis View Component
function StudentAnalysisView() {
  const { currentUser } = useStore();
  const { toast } = useToast();
  
  const [filterSemester, setFilterSemester] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(false);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Fetch available subjects for the student's semester
  useEffect(() => {
    const fetchSubjects = async () => {
      if (!filterSemester) {
        setAvailableSubjects([]);
        setFilterSubject("");
        return;
      }

      setIsLoadingSubjects(true);
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          console.error('No authentication token found. Please log in again.');
          setAvailableSubjects([]);
          setFilterSubject("");
          setIsLoadingSubjects(false);
          return;
        }

        // Fetch subjects from student enrollments
        const params = new URLSearchParams({
          semester: filterSemester
        });

        console.log('Fetching student subjects for semester:', filterSemester);

        const subjectsResponse = await fetch(`${API_BASE_URL}/analytics/student-subjects?${params}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        const subjectsData = await subjectsResponse.json();
        console.log('Student subjects response:', subjectsData);

        if (subjectsResponse.ok) {
          setAvailableSubjects(subjectsData.subjects || []);
          setFilterSubject("");
          console.log('Available subjects set to:', subjectsData.subjects);
        } else {
          console.error('Failed to fetch subjects:', subjectsData.message);
          setAvailableSubjects([]);
          setFilterSubject("");
        }
      } catch (error: any) {
        console.error('Error fetching subjects:', error);
        setAvailableSubjects([]);
        setFilterSubject("");
      } finally {
        setIsLoadingSubjects(false);
      }
    };

    fetchSubjects();
  }, [filterSemester]);

  // Fetch student analysis data
  useEffect(() => {
    const fetchAnalysisData = async () => {
      if (!filterSemester || !filterSubject) {
        setAnalysisData(null);
        return;
      }

      setIsLoading(true);
      setError("");

      try {
        const token = localStorage.getItem('token');
        if (!token) {
          throw new Error('Authentication required');
        }

        // Get student info
        const userResponse = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!userResponse.ok) {
          throw new Error('Failed to fetch user info');
        }

        const userData = await userResponse.json();
        const studentInfo = userData.user;

        const params = new URLSearchParams({
          semester: filterSemester,
          department: studentInfo.department || studentInfo.dept,
          section: studentInfo.sectionId || studentInfo.section,
          subject: filterSubject
        });

        const response = await fetch(`${API_BASE_URL}/analytics/student-analysis?${params}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        const data = await response.json();

        if (response.ok) {
          setAnalysisData(data);
          setError("");
        } else {
          setError(data.message || 'Failed to fetch analysis data');
          setAnalysisData(null);
        }
      } catch (error: any) {
        console.error('Error fetching analysis data:', error);
        setError(error.message || 'Failed to fetch analysis data');
        setAnalysisData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnalysisData();
  }, [filterSemester, filterSubject]);

  // Dynamic tooltip styles for dark mode
  const getTooltipStyle = (borderColor: string) => {
    if (typeof window !== 'undefined' && document.documentElement.classList.contains('dark')) {
      return {
        backgroundColor: 'hsl(142 25% 10%)',
        border: `2px solid hsl(142 30% 20%)`,
        borderRadius: '12px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5), 0 4px 16px rgba(0, 0, 0, 0.3)',
        color: 'hsl(0 0% 100%)'
      };
    }
    return {
      backgroundColor: '#fff',
      border: `2px solid ${borderColor}`,
      borderRadius: '12px',
      boxShadow: `0 10px 25px ${borderColor}20`
    };
  };

  const getAxisColor = () => {
    if (typeof window !== 'undefined' && document.documentElement.classList.contains('dark')) {
      return 'hsl(0 0% 100%)';
    }
    return '#6b7280';
  };

  const getGridColor = () => {
    if (typeof window !== 'undefined' && document.documentElement.classList.contains('dark')) {
      return 'hsl(142 30% 20%)';
    }
    return '#e5e7eb';
  };

  const getStrokeColor = () => {
    if (typeof window !== 'undefined' && document.documentElement.classList.contains('dark')) {
      return 'hsl(142 30% 20%)';
    }
    return '#fff';
  };

  const getActiveDotFill = () => {
    if (typeof window !== 'undefined' && document.documentElement.classList.contains('dark')) {
      return 'hsl(142 25% 10%)';
    }
    return '#fff';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-bold text-primary mb-2">My Attendance Analysis</h1>
        <p className="text-sm text-muted-foreground uppercase tracking-wider">Personal attendance insights and ML predictions</p>
      </div>

      {/* Academic Info Card */}
      {analysisData?.studentInfo && (
        <Card className="mb-6 relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-4">
                <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Academic Info</h2>
                <div className="flex gap-12">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Department</p>
                    <p className="text-xl font-bold">{analysisData.studentInfo.department}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Class</p>
                    <p className="text-xl font-bold">{analysisData.studentInfo.department} - {analysisData.studentInfo.section} Section</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Semester</p>
                    <p className="text-xl font-bold">{analysisData.studentInfo.semester}th Semester</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter Section */}
      <Card className="shadow-md border border-border/50">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent pb-4">
          <CardTitle className="text-base font-bold uppercase text-muted-foreground">Select Subject</CardTitle>
        </CardHeader>
        <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Semester</label>
            <Select value={filterSemester} onValueChange={setFilterSemester}>
              <SelectTrigger className="h-10 border-primary/20 hover:border-primary/50 transition-colors">
                <SelectValue placeholder="Select Semester" />
              </SelectTrigger>
              <SelectContent>
                {SEMESTERS.map(s => (
                  <SelectItem key={s} value={s}>Sem {s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Subject</label>
            <Select 
              value={filterSubject} 
              onValueChange={setFilterSubject}
              disabled={!filterSemester || isLoadingSubjects}
            >
              <SelectTrigger className={cn(
                "h-10 border-primary/20 hover:border-primary/50 transition-colors",
                (!filterSemester || isLoadingSubjects) && "opacity-50 cursor-not-allowed"
              )}>
                <SelectValue placeholder={
                  isLoadingSubjects 
                    ? "Loading subjects..." 
                    : availableSubjects.length === 0 && filterSemester
                    ? "No subjects available"
                    : "Select Subject"
                } />
              </SelectTrigger>
              <SelectContent>
                {availableSubjects.length === 0 ? (
                  <SelectItem value="no-subjects" disabled>
                    {filterSemester ? "No subjects found" : "Select semester first"}
                  </SelectItem>
                ) : (
                  availableSubjects.map((subject: string, index: number) => (
                    <SelectItem key={`${subject}-${index}`} value={subject}>{subject}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {filterSemester && availableSubjects.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {availableSubjects.length} subject{availableSubjects.length !== 1 ? 's' : ''} available
              </p>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="col-span-full">
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md border border-destructive/20">
                <AlertTriangle className="h-4 w-4" />
                {error}
              </div>
            </div>
          )}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="col-span-full">
              <div className="flex items-center gap-2 text-sm text-primary bg-primary/10 p-3 rounded-md border border-primary/20">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading analysis data...
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Show analysis data when available */}
      {analysisData && !error && !isLoading ? (
        <>
          {/* Attendance Summary */}
          <Card className="shadow-none border-l-4 border-l-success mb-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold uppercase text-muted-foreground">
                Attendance Summary - {analysisData.studentInfo?.subject}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-end mb-2">
                <div>
                  <p className="text-2xl font-bold">{analysisData.attendanceStats?.percentage || 0}%</p>
                  <p className="text-[10px] text-muted-foreground">Overall Attendance</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold">
                    {analysisData.attendanceStats?.present || 0} / {analysisData.attendanceStats?.total || 0} Classes
                  </p>
                </div>
              </div>
              <Progress value={analysisData.attendanceStats?.percentage || 0} className="h-1.5" />
            </CardContent>
          </Card>

          {/* ML Analysis Cards */}
          <div className="mb-8">
            <h2 className="text-sm font-bold text-muted-foreground uppercase mb-4 px-1">Student Analysis</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: ML - Trend Analysis */}
              <Card className="border-l-4 border-l-success shadow-md hover:shadow-xl hover:scale-105 transition-all duration-300">
                <CardHeader className="pb-2 bg-gradient-to-br from-success/10 to-transparent">
                  <CardTitle className="text-sm font-bold text-foreground">1) ML – Trend Analysis</CardTitle>
                </CardHeader>
                <CardContent className="pt-4 flex flex-col items-center justify-center text-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-success/20 flex items-center justify-center text-success">
                    {analysisData.mlAnalysis?.trend ? (
                      analysisData.mlAnalysis.trend === 'improving' ? <TrendingUp className="h-6 w-6" /> :
                      analysisData.mlAnalysis.trend === 'declining' ? <TrendingDown className="h-6 w-6" /> :
                      <Minus className="h-6 w-6" />
                    ) : <HelpCircle className="h-6 w-6" />}
                  </div>
                  <div>
                    <p className="text-lg font-bold text-success">
                      {getMLLabel(analysisData.mlAnalysis?.trend)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {analysisData.mlAnalysis?.trend ? 'Your attendance trend' : 'ML model not trained yet'}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Card 2: ML - Risk Prediction */}
              <Card className="border-l-4 border-l-primary shadow-md hover:shadow-xl hover:scale-105 transition-all duration-300">
                <CardHeader className="pb-2 bg-gradient-to-br from-primary/10 to-transparent">
                  <CardTitle className="text-sm font-bold text-foreground">2) ML – Risk Prediction</CardTitle>
                </CardHeader>
                <CardContent className="pt-4 flex flex-col items-center justify-center text-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center text-primary text-2xl">
                    {getMLRiskIcon(analysisData.mlAnalysis?.risk)}
                  </div>
                  <div>
                    <p className="text-lg font-bold text-primary">
                      {getMLLabel(analysisData.mlAnalysis?.risk)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {analysisData.mlAnalysis?.risk ? 'Risk assessment' : 'ML model not trained yet'}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Card 3: ML - Consistency Analysis */}
              <Card className="border-l-4 border-l-warning shadow-md hover:shadow-xl hover:scale-105 transition-all duration-300">
                <CardHeader className="pb-2 bg-gradient-to-br from-warning/10 to-transparent">
                  <CardTitle className="text-sm font-bold text-foreground">3) ML – Consistency Analysis</CardTitle>
                </CardHeader>
                <CardContent className="pt-4 flex flex-col items-center justify-center text-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-500 text-xl">
                    {getMLConsistencyIcon(analysisData.mlAnalysis?.consistency)}
                  </div>
                  <div>
                    <p className="text-lg font-bold text-orange-500">
                      {getMLLabel(analysisData.mlAnalysis?.consistency)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {analysisData.mlAnalysis?.consistency ? 'Attendance pattern' : 'ML model not trained yet'}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Card 4: Attentiveness Level */}
              <Card className="border-l-4 border-l-blue-500 shadow-md hover:shadow-xl hover:scale-105 transition-all duration-300">
                <CardHeader className="pb-2 bg-gradient-to-br from-blue-50 to-transparent">
                  <CardTitle className="text-sm font-bold text-foreground">4) Attentiveness Level</CardTitle>
                </CardHeader>
                <CardContent className="pt-4 flex flex-col items-center justify-center text-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-success/20 flex items-center justify-center text-2xl">
                    {getMLAttentivenessIcon(analysisData.mlAnalysis?.attentiveness)}
                  </div>
                  <div>
                    <p className="text-lg font-bold text-blue-600">
                      {getMLLabel(analysisData.mlAnalysis?.attentiveness)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {analysisData.mlAnalysis?.attentiveness ? 'Classroom participation' : 'ML model not trained yet'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Detailed Analysis Graphs */}
          <div className="space-y-6 mb-8">
            <h2 className="text-lg font-bold mb-6 px-1">Detailed Analysis Insights</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Graph 1: Attendance Trend Over Time */}
              <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-bold">1) Attendance Trend Over Time</CardTitle>
                  <CardDescription className="text-xs font-semibold uppercase tracking-wider text-green-600">
                    ML – TREND ANALYSIS GRAPH
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6" style={{ height: '280px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analysisData.chartData?.trendData || []} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={getGridColor()}/>
                      <XAxis dataKey="name" fontSize={12} stroke={getAxisColor()} fontWeight="500"/>
                      <YAxis fontSize={12} stroke={getAxisColor()} fontWeight="500"/>
                      <RechartsTooltip contentStyle={getTooltipStyle('#10b981')} />
                      <Line 
                        type="monotone" 
                        dataKey="attendance" 
                        stroke="#10b981" 
                        strokeWidth={3} 
                        dot={{fill: '#10b981', r: 5, strokeWidth: 2, stroke: getStrokeColor()}} 
                        activeDot={{r: 7, stroke: '#10b981', strokeWidth: 3, fill: getActiveDotFill()}}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Graph 2: Attendance Risk Category Distribution */}
              <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-bold">2) Attendance Risk Category Distribution</CardTitle>
                  <CardDescription className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                    ML – RISK PREDICTION GRAPH
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6" style={{ height: '280px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsBarChart 
                      data={[
                        { 
                          name: 'Above 75%', 
                          value: analysisData.attendanceStats?.percentage >= 75 ? analysisData.attendanceStats?.percentage : 0,
                          fill: '#3b82f6'
                        },
                        { 
                          name: 'Around Threshold', 
                          value: analysisData.attendanceStats?.percentage >= 65 && analysisData.attendanceStats?.percentage < 75 ? analysisData.attendanceStats?.percentage : 0,
                          fill: '#8b5cf6'
                        },
                        { 
                          name: 'Below 75%', 
                          value: analysisData.attendanceStats?.percentage < 65 ? analysisData.attendanceStats?.percentage : 0,
                          fill: '#a855f7'
                        }
                      ]}
                      margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={getGridColor()} />
                      <XAxis dataKey="name" stroke={getAxisColor()} fontSize={11} />
                      <YAxis stroke={getAxisColor()} fontSize={12} domain={[0, 100]} />
                      <RechartsTooltip 
                        contentStyle={getTooltipStyle('#3b82f6')}
                        formatter={(value: any) => [`${value}%`, 'Attendance']}
                      />
                      <Bar dataKey="value" radius={[8, 8, 0, 0]} />
                    </RechartsBarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Graph 3: Attendance Consistency Distribution */}
              <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-bold">3) Attendance Consistency Distribution</CardTitle>
                  <CardDescription className="text-xs font-semibold uppercase tracking-wider text-teal-600">
                    ML – CONSISTENCY ANALYSIS GRAPH
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6" style={{ height: '280px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          {
                            name: analysisData.chartData?.consistencyScore === 'regular' ? 'REGULAR' : 
                                  analysisData.chartData?.consistencyScore === 'moderately_irregular' ? 'MODERATELY IRREGULAR' : 
                                  'HIGHLY IRREGULAR',
                            value: analysisData.chartData?.consistencyScore === 'regular' ? 70 :
                                   analysisData.chartData?.consistencyScore === 'moderately_irregular' ? 20 :
                                   10,
                            fill: analysisData.chartData?.consistencyScore === 'regular' ? '#10b981' :
                                  analysisData.chartData?.consistencyScore === 'moderately_irregular' ? '#14b8a6' :
                                  '#06b6d4'
                          }
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={0}
                        dataKey="value"
                        label={({ value }) => `${value}%`}
                      >
                      </Pie>
                      <RechartsTooltip contentStyle={getTooltipStyle('#10b981')} />
                      <Legend 
                        verticalAlign="bottom" 
                        height={36}
                        iconType="circle"
                        formatter={(value) => <span className="text-xs font-medium">{value}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Graph 4: Student Attentiveness Level Analysis */}
              <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-bold">4) Student Attentiveness Level Analysis</CardTitle>
                  <CardDescription className="text-xs font-semibold uppercase tracking-wider text-cyan-600">
                    ATTENTIVENESS LEVEL CLASSIFICATION GRAPH
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6" style={{ height: '280px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsBarChart 
                      data={[
                        {
                          name: 'Actively Attentive',
                          value: analysisData.mlAnalysis?.attentiveness === 'actively_attentive' ? 100 : 0,
                          fill: '#06b6d4'
                        },
                        {
                          name: 'Moderately Attentive',
                          value: analysisData.mlAnalysis?.attentiveness === 'moderately_attentive' ? 60 : 0,
                          fill: '#0891b2'
                        },
                        {
                          name: 'Passively Attentive',
                          value: analysisData.mlAnalysis?.attentiveness === 'passively_attentive' ? 30 : 0,
                          fill: '#0e7490'
                        }
                      ]}
                      layout="vertical"
                      margin={{ top: 20, right: 30, left: 100, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={getGridColor()} />
                      <XAxis type="number" stroke={getAxisColor()} fontSize={12} domain={[0, 100]} />
                      <YAxis type="category" dataKey="name" stroke={getAxisColor()} fontSize={11} width={90} />
                      <RechartsTooltip 
                        contentStyle={getTooltipStyle('#06b6d4')}
                        formatter={(value: any) => [`${value}%`, 'Level']}
                      />
                      <Bar dataKey="value" radius={[0, 8, 8, 0]} />
                    </RechartsBarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      ) : (
        /* Show placeholder when no data */
        !isLoading && !error && (
          <Card className="shadow-md border border-border/50">
            <CardContent className="p-12 text-center">
              <div className="space-y-4">
                <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
                  <BarChart className="h-8 w-8 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-muted-foreground">No Analysis Data</h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    {!filterSemester 
                      ? "Please select a semester to continue"
                      : !filterSubject 
                      ? "Please select a subject to view your analysis"
                      : "No data available for the selected filters"
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      )}
    </div>
  );
}
