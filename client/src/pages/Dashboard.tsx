import { useStore } from "@/lib/store";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, CheckCircle2, BarChart3, Camera, Users, Database, BookOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL } from "@/lib/constants";

interface DashboardData {
  teacherInfo?: {
    name: string;
    teacherId: string;
    semesters: string[];
    departments: string[];
    sections: string[];
    subjects: string[];
  };
  studentInfo?: {
    name: string;
    usn: string;
    semester: number;
    department: string;
    dept: string;
    sectionId: string;
    subject: string;
  };
  totalStudents?: number;
  todayAttendance?: {
    sessions: number;
    percentage: number;
  };
  overallPercentage?: number;
  totalClasses?: number;
  presentClasses?: number;
}

export default function Dashboard() {
  const { currentUser } = useStore();
  const { toast } = useToast();
  const [dashboardData, setDashboardData] = useState<DashboardData>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          toast({
            title: "Error",
            description: "Please login to access dashboard",
            variant: "destructive"
          });
          return;
        }

        const response = await fetch(`${API_BASE_URL}/dashboard/summary`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setDashboardData(data);
        } else {
          console.error('Failed to fetch dashboard data');
        }
      } catch (error) {
        console.error('Dashboard fetch error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (currentUser) {
      fetchDashboardData();
    }
  }, [currentUser, toast]);

  const AcademicInfo = () => {
    if (currentUser?.role === 'student' && dashboardData.studentInfo) {
      return (
        <Card className="mb-6 relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-4">
                <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Academic Info</h2>
                <div className="flex gap-12">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Department</p>
                    <p className="text-xl font-bold">{dashboardData.studentInfo.department}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Class</p>
                    <p className="text-xl font-bold">{dashboardData.studentInfo.dept} - {dashboardData.studentInfo.sectionId} Section</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Semester</p>
                    <p className="text-xl font-bold">{dashboardData.studentInfo.semester}th Semester</p>
                  </div>
                </div>
              </div>
              <Link href="/timetable">
                <Button variant="outline" className="gap-2 font-bold uppercase text-xs border-2">
                  <Calendar className="h-4 w-4" />
                  View Timetable
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-col gap-2 mb-8">
          <div className="h-10 bg-muted rounded animate-pulse"></div>
          <div className="h-4 bg-muted rounded w-1/3 animate-pulse"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-muted rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2 mb-8">
        <h1 className="text-4xl font-serif font-bold text-green-600 tracking-wide">
          {dashboardData.teacherInfo?.name || dashboardData.studentInfo?.name || currentUser?.name} Dashboard
        </h1>
        <p className="text-sm text-muted-foreground uppercase tracking-widest font-medium">Academic summary and insights</p>
      </div>

      <AcademicInfo />

      <div className={`grid grid-cols-1 ${currentUser?.role === 'teacher' ? 'md:grid-cols-4' : 'md:grid-cols-2'} gap-6`}>
        {currentUser?.role === 'teacher' && (
          <>
            <Link href="/attendance">
              <Card className="hover:bg-muted/50 cursor-pointer transition-all duration-200 group border-2 border-transparent hover:border-success/20 hover:scale-[1.02] active:scale-[0.98]">
                <CardContent className="p-6 flex flex-col items-center text-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center text-success group-hover:scale-110 transition-transform">
                    <Camera className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold uppercase text-sm">Take Attendance</h3>
                    <p className="text-xs text-muted-foreground">Capture attendance</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/attendance-records">
              <Card className="hover:bg-muted/50 cursor-pointer transition-all duration-200 group border-2 border-transparent hover:border-warning/20 hover:scale-[1.02] active:scale-[0.98]">
                <CardContent className="p-6 flex flex-col items-center text-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-warning/10 flex items-center justify-center text-warning group-hover:scale-110 transition-transform">
                    <BookOpen className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold uppercase text-sm">View/Edit Attendance</h3>
                    <p className="text-xs text-muted-foreground">View and edit records</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/timetable">
              <Card className="hover:bg-muted/50 cursor-pointer transition-all duration-200 group border-2 border-transparent hover:border-primary/20 hover:scale-[1.02] active:scale-[0.98]">
                <CardContent className="p-6 flex flex-col items-center text-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-bold uppercase text-sm">Timetable</h3>
                    <p className="text-xs text-muted-foreground">View official schedule</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/analysis">
              <Card className="hover:bg-muted/50 cursor-pointer transition-all duration-200 group border-2 border-transparent hover:border-info/20 hover:scale-[1.02] active:scale-[0.98]">
                <CardContent className="p-6 flex flex-col items-center text-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-info/10 flex items-center justify-center text-info group-hover:scale-110 transition-transform">
                    <BarChart3 className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold uppercase text-sm">Attendance Analysis</h3>
                    <p className="text-xs text-muted-foreground">View ML-powered insights</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </>
        )}

        {currentUser?.role === 'student' && (
          <>
            <Link href="/timetable">
              <Card className="hover:bg-muted/50 cursor-pointer transition-all duration-200 group border-2 border-transparent hover:border-primary/20 hover:scale-[1.02] active:scale-[0.98]">
                <CardContent className="p-6 flex flex-col items-center text-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-bold uppercase text-sm">Timetable</h3>
                    <p className="text-xs text-muted-foreground">View official schedule</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/student-attendance">
              <Card className="hover:bg-muted/50 cursor-pointer transition-all duration-200 group border-2 border-transparent hover:border-success/20 hover:scale-[1.02] active:scale-[0.98]">
                <CardContent className="p-6 flex flex-col items-center text-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center text-success group-hover:scale-110 transition-transform">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold uppercase text-sm">View Attendance</h3>
                    <p className="text-xs text-muted-foreground">Check daily attendance</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/analysis">
              <Card className="hover:bg-muted/50 cursor-pointer transition-all duration-200 group border-2 border-transparent hover:border-info/20 hover:scale-[1.02] active:scale-[0.98]">
                <CardContent className="p-6 flex flex-col items-center text-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-info/10 flex items-center justify-center text-info group-hover:scale-110 transition-transform">
                    <BarChart3 className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold uppercase text-sm">Attendance Analysis</h3>
                    <p className="text-xs text-muted-foreground">View ML-powered insights</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </>
        )}

        {currentUser?.role === 'admin' && (
          <>
            <Link href="/admin">
              <Card className="hover:bg-muted/50 cursor-pointer transition-all duration-200 group border-2 border-transparent hover:border-primary/20 hover:scale-[1.02] active:scale-[0.98]">
                <CardContent className="p-6 flex flex-col items-center text-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                    <Users className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold uppercase text-sm">Manage Teachers</h3>
                    <p className="text-xs text-muted-foreground">Approve teacher IDs</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/students">
              <Card className="hover:bg-muted/50 cursor-pointer transition-all duration-200 group border-2 border-transparent hover:border-warning/20 hover:scale-[1.02] active:scale-[0.98]">
                <CardContent className="p-6 flex flex-col items-center text-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-warning/10 flex items-center justify-center text-warning group-hover:scale-110 transition-transform">
                    <BookOpen className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold uppercase text-sm">Manage Students</h3>
                    <p className="text-xs text-muted-foreground">Register and view students</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/timetable-manage">
              <Card className="hover:bg-muted/50 cursor-pointer transition-all duration-200 group border-2 border-transparent hover:border-success/20 hover:scale-[1.02] active:scale-[0.98]">
                <CardContent className="p-6 flex flex-col items-center text-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center text-success group-hover:scale-110 transition-transform">
                    <Calendar className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold uppercase text-sm">Manage Timetable</h3>
                    <p className="text-xs text-muted-foreground">Create class schedule</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/dbms-values">
              <Card className="hover:bg-muted/50 cursor-pointer transition-all duration-200 group border-2 border-transparent hover:border-info/20 hover:scale-[1.02] active:scale-[0.98]">
                <CardContent className="p-6 flex flex-col items-center text-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-info/10 flex items-center justify-center text-info group-hover:scale-110 transition-transform">
                    <Database className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold uppercase text-sm">DBMS Values</h3>
                    <p className="text-xs text-muted-foreground">View database</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}