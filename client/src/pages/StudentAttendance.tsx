import { useState, useEffect } from "react";
import { useStore } from "@/lib/store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL } from "@/lib/constants";
import { CheckCircle2, XCircle, Clock, Calendar as CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface TimetableEntry {
  id: number;
  day: string;
  period: number;
  start_time: string;
  end_time: string;
  subject: string;
  teacher_name: string;
  room: string;
  attendance_status?: 'present' | 'absent' | 'excused' | null;
  session_id?: number;
}

export default function StudentAttendance() {
  const { currentUser } = useStore();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [timetableData, setTimetableData] = useState<TimetableEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [studentInfo, setStudentInfo] = useState<any>(null);

  // Fetch student info
  useEffect(() => {
    const fetchStudentInfo = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;

        const response = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setStudentInfo(data.user);
        }
      } catch (error) {
        console.error('Error fetching student info:', error);
      }
    };

    fetchStudentInfo();
  }, []);

  // Fetch timetable and attendance for selected date
  useEffect(() => {
    const fetchAttendanceData = async () => {
      if (!selectedDate || !studentInfo) return;

      setIsLoading(true);
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          toast({
            title: "Error",
            description: "Please login to view attendance",
            variant: "destructive"
          });
          return;
        }

        const dayName = format(selectedDate, 'EEEE');
        const dateStr = format(selectedDate, 'yyyy-MM-dd');

        // First, check if there's an attendance session for this date to determine the semester
        const sessionCheckParams = new URLSearchParams({
          date: dateStr
        });

        const sessionResponse = await fetch(`${API_BASE_URL}/attendance/student-daily?${sessionCheckParams}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        let semesterForDate = studentInfo.semester; // Default to current semester
        
        if (sessionResponse.ok) {
          const sessionData = await sessionResponse.json();
          if (sessionData.records && sessionData.records.length > 0) {
            // Use the semester from the attendance session
            semesterForDate = sessionData.records[0].semester;
          }
        }

        // Fetch timetable for the day using the determined semester
        const params = new URLSearchParams({
          semester: semesterForDate?.toString() || studentInfo.semester?.toString() || '',
          department: studentInfo.department || studentInfo.dept,
          section: studentInfo.sectionId || studentInfo.section,
          day: dayName,
          date: dateStr // Add date parameter to fetch date-specific timetables
        });

        console.log('Fetching timetable with params:', Object.fromEntries(params));

        const timetableResponse = await fetch(`${API_BASE_URL}/timetable/by-day?${params}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!timetableResponse.ok) {
          throw new Error('Failed to fetch timetable');
        }

        const timetableData = await timetableResponse.json();

        // Fetch attendance records for the date
        const attendanceParams = new URLSearchParams({
          date: dateStr
        });

        const attendanceResponse = await fetch(`${API_BASE_URL}/attendance/student-daily?${attendanceParams}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        let attendanceRecords: any[] = [];
        if (attendanceResponse.ok) {
          const attendanceData = await attendanceResponse.json();
          attendanceRecords = attendanceData.records || [];
        }

        console.log('Attendance records:', attendanceRecords);
        console.log('Timetable entries:', timetableData.timetable);

        // Helper function to check if session time is within valid range
        // Valid range: 15 min before start_time to 15 min after end_time
        const isTimeWithinRange = (startTime: string, endTime: string, sessionTime: string): boolean => {
          // Parse times (format: HH:MM or HH:MM:SS)
          const parseTime = (timeStr: string) => {
            const parts = timeStr.split(':');
            return parseInt(parts[0]) * 60 + parseInt(parts[1]); // Convert to minutes
          };

          const startMinutes = parseTime(startTime);
          const endMinutes = parseTime(endTime);
          const sessionMinutes = parseTime(sessionTime);

          const earliestValid = startMinutes - 15; // 15 min before start
          const latestValid = endMinutes + 15;     // 15 min after end

          return sessionMinutes >= earliestValid && sessionMinutes <= latestValid;
        };

        // Merge timetable with attendance data using strict matching
        const mergedData = timetableData.timetable.map((entry: TimetableEntry) => {
          // Find attendance record that matches subject AND time is within valid range
          const attendanceRecord = attendanceRecords.find(
            (record: any) => 
              record.subject === entry.subject && 
              isTimeWithinRange(entry.start_time, entry.end_time, record.session_time)
          );

          return {
            ...entry,
            attendance_status: attendanceRecord?.status || null,
            session_id: attendanceRecord?.session_id || null
          };
        });

        console.log('Merged data:', mergedData);
        setTimetableData(mergedData);

      } catch (error: any) {
        console.error('Error fetching attendance data:', error);
        toast({
          title: "Error",
          description: error.message || "Failed to fetch attendance data",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchAttendanceData();
  }, [selectedDate, studentInfo, toast]);

  const getStatusIcon = (status: string | null) => {
    if (!status) {
      return <Clock className="h-5 w-5 text-muted-foreground" />;
    }
    switch (status) {
      case 'present':
      case 'excused':
        return <CheckCircle2 className="h-5 w-5 text-success" />;
      case 'absent':
        return <XCircle className="h-5 w-5 text-destructive" />;
      default:
        return <Clock className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string | null) => {
    if (!status) {
      return <Badge variant="outline">Not Taken</Badge>;
    }
    switch (status) {
      case 'present':
        return <Badge className="bg-success text-white">Present</Badge>;
      case 'absent':
        return <Badge variant="destructive">Absent</Badge>;
      case 'excused':
        return <Badge className="bg-warning text-white">Excused</Badge>;
      default:
        return <Badge variant="outline">Not Taken</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">View Attendance</h1>
          <p className="text-muted-foreground">Check your daily attendance records</p>
        </div>
      </div>

      {/* Student Info Card */}
      {studentInfo && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold uppercase text-muted-foreground">Student Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-8">
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="font-semibold">{studentInfo.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">USN</p>
                <p className="font-semibold">{studentInfo.usn}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Department</p>
                <p className="font-semibold">{studentInfo.department}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Class</p>
                <p className="font-semibold">{studentInfo.dept} - {studentInfo.sectionId}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Semester</p>
                <p className="font-semibold">{studentInfo.semester}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-6">
        {/* Calendar */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Select Date
            </CardTitle>
            <CardDescription>Choose a date to view attendance</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              className="rounded-md border"
              disabled={(date) => date > new Date()}
            />
          </CardContent>
        </Card>

        {/* Timetable with Attendance - Horizontal Scrollable */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <CardTitle>
              Attendance for {format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </CardTitle>
            {timetableData.length > 0 && (
              <div className="text-xs text-muted-foreground">
                ← Scroll horizontally →
              </div>
            )}
          </div>

          {isLoading ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
                <p className="text-muted-foreground">Loading attendance data...</p>
              </CardContent>
            </Card>
          ) : timetableData.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <CalendarIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No Classes Scheduled</h3>
                <p className="text-muted-foreground">No classes scheduled for this day</p>
              </CardContent>
            </Card>
          ) : (
            <div className="relative">
              <div className="flex gap-6 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent hover:scrollbar-thumb-primary/40">
                {timetableData.map((entry, idx) => (
                  <Card 
                    key={entry.id} 
                    className="flex-shrink-0 w-[400px] shadow-lg snap-start hover:shadow-xl transition-all border-l-4"
                    style={{
                      borderLeftColor: entry.attendance_status === 'present' || entry.attendance_status === 'excused' 
                        ? 'hsl(var(--success))' 
                        : entry.attendance_status === 'absent' 
                        ? 'hsl(var(--destructive))' 
                        : 'hsl(var(--muted))'
                    }}
                  >
                    <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5 border-b pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg font-bold line-clamp-2">
                            {entry.subject}
                          </CardTitle>
                          <CardDescription className="mt-2 space-y-1">
                            <div className="flex items-center gap-2 text-sm">
                              <span className="font-semibold">Period {entry.period}</span>
                            </div>
                            <div className="text-xs">
                              👨‍🏫 {entry.teacher_name}
                            </div>
                            <div className="text-xs">
                              🚪 Room {entry.room}
                            </div>
                          </CardDescription>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {getStatusIcon(entry.attendance_status ?? null)}
                          {getStatusBadge(entry.attendance_status ?? null)}
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="p-4">
                      <div className="bg-muted rounded-lg p-4 text-center">
                        <div className="text-xs text-muted-foreground mb-1">Class Time</div>
                        <div className="flex items-center justify-center gap-2">
                          <span className="font-bold text-lg">{entry.start_time}</span>
                          <span className="text-muted-foreground">→</span>
                          <span className="font-bold text-lg">{entry.end_time}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-2">
                          Duration: {(() => {
                            const [startH, startM] = entry.start_time.split(':').map(Number);
                            const [endH, endM] = entry.end_time.split(':').map(Number);
                            const duration = (endH * 60 + endM) - (startH * 60 + startM);
                            return `${duration} minutes`;
                          })()}
                        </div>
                      </div>

                      {entry.attendance_status && (
                        <div className="mt-4 p-3 rounded-lg" style={{
                          backgroundColor: entry.attendance_status === 'present' || entry.attendance_status === 'excused'
                            ? 'hsl(var(--success) / 0.1)'
                            : entry.attendance_status === 'absent'
                            ? 'hsl(var(--destructive) / 0.1)'
                            : 'hsl(var(--muted))'
                        }}>
                          <div className="text-xs font-semibold text-center">
                            {entry.attendance_status === 'present' && '✓ You attended this class'}
                            {entry.attendance_status === 'absent' && '✗ You were absent'}
                            {entry.attendance_status === 'excused' && '📝 Excused absence'}
                            {!entry.attendance_status && 'Attendance not taken yet'}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
