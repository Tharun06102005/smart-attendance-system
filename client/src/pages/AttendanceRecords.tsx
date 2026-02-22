import { useState, useEffect } from "react";
import { useStore, AttendanceStatus } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, Calendar as CalendarIcon, FileText, AlertTriangle, Edit, UserCheck, UserX } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { SEMESTERS, DEPARTMENTS, SECTIONS, API_BASE_URL, getSubjectsForDepartment } from "@/lib/constants";

interface AttendanceRecord {
  id: string;
  name: string;
  status: AttendanceStatus | 'excused';
  emotion?: string | null;
  attentiveness?: string | null;
  reasonType?: string;
  confidence?: number | null;
  markedBy?: string;
  markedAt?: string;
}

interface SessionData {
  session: {
    id: number;
    date: string;
    time: string;
    totalStudents: number;
    presentCount: number;
    absentCount: number;
    capturedImagePath: string | null;
    capturedImagePaths: string[];
  };
  attendanceRecords: AttendanceRecord[];
}

export default function AttendanceRecords() {
  const { currentUser, editAttendance, initializeUser } = useStore();
  const { toast } = useToast();

  // Filters
  const [filterSemester, setFilterSemester] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterSection, setFilterSection] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [date, setDate] = useState<Date>(new Date());
  
  // Data state
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filtersLocked, setFiltersLocked] = useState(false);
  
  // Edit state (per session)
  const [editingSessions, setEditingSessions] = useState<{[sessionId: number]: boolean}>({});
  const [editedRecords, setEditedRecords] = useState<{[sessionId: number]: AttendanceRecord[]}>({});
  const [hasChanges, setHasChanges] = useState<{[sessionId: number]: boolean}>({});
  const [changedStudents, setChangedStudents] = useState<{[sessionId: number]: Set<string>}>({});

  // Ensure user data is loaded
  useEffect(() => {
    if (!currentUser) {
      initializeUser();
    }
  }, []);

  // Load attendance records
  const loadRecords = async () => {
    if (!filterSemester || !filterDept || !filterSection || !filterSubject) {
      toast({
        title: "Missing Filters",
        description: "Please select all filters",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Authentication required');

      const params = new URLSearchParams({
        classId: filterDept,
        sectionId: filterSection,
        semester: filterSemester,
        subject: filterSubject,
        date: format(date, 'yyyy-MM-dd')
      });

      const response = await fetch(`${API_BASE_URL}/attendance/records?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      console.log('📊 API Response:', data);
      console.log('📊 Has Session:', data.hasSession);
      console.log('📊 Sessions Array:', data.sessions);
      console.log('📊 Total Sessions:', data.totalSessions);

      if (response.ok && data.hasSession) {
        console.log('✅ Setting sessions state with', data.sessions.length, 'sessions');
        
        setSessions(data.sessions);
        setFiltersLocked(true);
        
        // Initialize edited records for each session
        const initialEdited: {[key: number]: AttendanceRecord[]} = {};
        data.sessions.forEach((sessionData: SessionData) => {
          initialEdited[sessionData.session.id] = [...sessionData.attendanceRecords];
        });
        setEditedRecords(initialEdited);
        
        toast({
          title: "Records Loaded",
          description: `Found ${data.totalSessions} session(s) with attendance records`
        });
      } else {
        toast({
          title: "No Records Found",
          description: "No attendance sessions found for the selected filters",
          variant: "destructive"
        });
        setSessions([]);
      }
    } catch (error) {
      console.error('Load records error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load records",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle edit mode for a session
  const toggleEdit = (sessionId: number) => {
    setEditingSessions(prev => ({
      ...prev,
      [sessionId]: !prev[sessionId]
    }));
    
    // Reset changes if canceling
    if (editingSessions[sessionId]) {
      const originalSession = sessions.find(s => s.session.id === sessionId);
      if (originalSession) {
        setEditedRecords(prev => ({
          ...prev,
          [sessionId]: [...originalSession.attendanceRecords]
        }));
      }
      setHasChanges(prev => ({
        ...prev,
        [sessionId]: false
      }));
      setChangedStudents(prev => ({
        ...prev,
        [sessionId]: new Set()
      }));
    }
  };

  // Update attendance status
  const updateStatus = (sessionId: number, studentId: string, newStatus: AttendanceStatus) => {
    setEditedRecords(prev => ({
      ...prev,
      [sessionId]: prev[sessionId].map(record =>
        record.id === studentId ? { ...record, status: newStatus } : record
      )
    }));
    
    // Track which students were changed
    setChangedStudents(prev => {
      const sessionChanges = new Set(prev[sessionId] || []);
      sessionChanges.add(studentId);
      return {
        ...prev,
        [sessionId]: sessionChanges
      };
    });
    
    setHasChanges(prev => ({
      ...prev,
      [sessionId]: true
    }));
  };

  // Submit changes for a session
  const submitChanges = async (sessionId: number) => {
    try {
      const changedIds = changedStudents[sessionId] || new Set();
      
      // Only send records that were actually changed
      const records = editedRecords[sessionId]
        .filter(r => changedIds.has(r.id))
        .map(r => ({
          studentId: r.id,
          status: r.status,
          reasonType: r.reasonType || null
        }));

      if (records.length === 0) {
        toast({
          title: "No Changes",
          description: "No records were modified",
          variant: "destructive"
        });
        return;
      }

      await editAttendance(sessionId.toString(), records, format(date, 'yyyy-MM-dd'));

      toast({
        title: "Changes Saved",
        description: "Attendance records updated successfully"
      });

      setEditingSessions(prev => ({ ...prev, [sessionId]: false }));
      setHasChanges(prev => ({ ...prev, [sessionId]: false }));
      
      // Reload to get fresh data
      await loadRecords();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save changes",
        variant: "destructive"
      });
    }
  };

  // Reset filters
  const resetFilters = () => {
    setFiltersLocked(false);
    setFilterSemester("");
    setFilterDept("");
    setFilterSection("");
    setFilterSubject("");
    setSessions([]);
    setEditingSessions({});
    setEditedRecords({});
    setHasChanges({});
  };

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters Card */}
      <Card>
        <CardHeader>
          <CardTitle>View Attendance Records</CardTitle>
          <CardDescription>Select filters and date to view attendance records</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Select value={filterSemester} onValueChange={setFilterSemester} disabled={filtersLocked}>
              <SelectTrigger>
                <SelectValue placeholder="Semester"/>
              </SelectTrigger>
              <SelectContent>
                {SEMESTERS.map(s => (
                  <SelectItem key={s} value={s}>Sem {s}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterDept} onValueChange={setFilterDept} disabled={filtersLocked}>
              <SelectTrigger>
                <SelectValue placeholder="Department"/>
              </SelectTrigger>
              <SelectContent>
                {DEPARTMENTS.map(d => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterSection} onValueChange={setFilterSection} disabled={filtersLocked}>
              <SelectTrigger>
                <SelectValue placeholder="Section"/>
              </SelectTrigger>
              <SelectContent>
                {SECTIONS.map(s => (
                  <SelectItem key={s} value={s}>Section {s}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select 
              value={filterSubject} 
              onValueChange={setFilterSubject}
              disabled={!filterSemester || !filterDept || filtersLocked}
            >
              <SelectTrigger>
                <SelectValue placeholder="Subject"/>
              </SelectTrigger>
              <SelectContent>
                {filterSemester && filterDept && getSubjectsForDepartment(filterSemester, filterDept).map(subj => (
                  <SelectItem key={subj} value={subj}>{subj}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start" disabled={filtersLocked}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(date, "MMM dd, yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <CalendarComponent 
                  mode="single" 
                  selected={date} 
                  onSelect={(d) => d && setDate(d)} 
                  initialFocus 
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex gap-2">
            {!filtersLocked ? (
              <Button 
                onClick={loadRecords}
                disabled={!filterSemester || !filterDept || !filterSection || !filterSubject || isLoading}
                className="flex-1"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Load Records
                  </>
                )}
              </Button>
            ) : (
              <Button onClick={resetFilters} variant="outline" className="flex-1">
                Change Filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sessions Display */}
      {sessions.length > 0 && (
        <div className="space-y-6">
          <div className="text-sm text-muted-foreground">
            Showing {sessions.length} session(s) for {format(date, "MMMM d, yyyy")}
          </div>
          {sessions.map((sessionData, idx) => {
        const sessionId = sessionData.session.id;
        const isEditing = editingSessions[sessionId] || false;
        const records = isEditing ? editedRecords[sessionId] : sessionData.attendanceRecords;
        const changed = hasChanges[sessionId] || false;
        
        // Check if session date is today
        const isToday = format(new Date(sessionData.session.date), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

        return (
          <Card key={sessionId} className="border-2">
            <CardHeader className="bg-muted/50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">
                    Session {idx + 1} - {sessionData.session.time}
                  </CardTitle>
                  <CardDescription>
                    {format(new Date(sessionData.session.date), "EEEE, MMMM d, yyyy")}
                    {isToday && <span className="ml-2 text-green-600 font-semibold">(Today)</span>}
                  </CardDescription>
                </div>
                {/* Only show edit buttons if session is from today */}
                {isToday && (
                  <div className="flex gap-2">
                    {!isEditing ? (
                      <Button size="sm" variant="outline" onClick={() => toggleEdit(sessionId)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                    ) : (
                      <>
                        <Button size="sm" variant="outline" onClick={() => toggleEdit(sessionId)}>
                          Cancel
                        </Button>
                        <Button 
                          size="sm" 
                          onClick={() => submitChanges(sessionId)}
                          disabled={!changed}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Save {changed && "*"}
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold">{sessionData.session.totalStudents}</div>
                    <div className="text-sm text-muted-foreground">Total</div>
                  </CardContent>
                </Card>
                <Card className="border-green-200 bg-green-50">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {records.filter(r => r.status === 'present').length}
                    </div>
                    <div className="text-sm text-green-700">Present</div>
                  </CardContent>
                </Card>
                <Card className="border-red-200 bg-red-50">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {records.filter(r => r.status === 'absent').length}
                    </div>
                    <div className="text-sm text-red-700">Absent</div>
                  </CardContent>
                </Card>
              </div>

              {/* Captured Images */}
              {sessionData.session.capturedImagePaths && sessionData.session.capturedImagePaths.length > 0 ? (
                <div>
                  <h3 className="font-semibold mb-2">
                    Captured Images ({sessionData.session.capturedImagePaths.length}):
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {sessionData.session.capturedImagePaths.map((imagePath, idx) => (
                      <div key={idx} className="relative">
                        <img 
                          src={imagePath}
                          alt={`Attendance capture ${idx + 1}`}
                          className="w-full h-auto rounded-lg border"
                          style={{ maxHeight: '300px', objectFit: 'contain' }}
                          onError={(e) => {
                            console.error('Image load error:', imagePath);
                            e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="%23f0f0f0"/><text x="50%" y="50%" text-anchor="middle" fill="%23999">Image not found</text></svg>';
                          }}
                        />
                        <p className="text-xs text-muted-foreground mt-1 text-center">
                          Image {idx + 1} of {sessionData.session.capturedImagePaths.length}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center p-4 bg-muted rounded-lg">
                  <p className="text-muted-foreground">No image captured for this session</p>
                </div>
              )}

              {/* Student Records Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2">
                      <th className="text-left p-3 font-bold">USN</th>
                      <th className="text-left p-3 font-bold">Name</th>
                      <th className="text-left p-3 font-bold">Status</th>
                      {!isEditing && <th className="text-left p-3 font-bold">Marked By</th>}
                      {!isEditing && <th className="text-left p-3 font-bold">Confidence</th>}
                      {!isEditing && <th className="text-left p-3 font-bold">Emotion</th>}
                      {!isEditing && <th className="text-left p-3 font-bold">Attentiveness</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((record) => (
                      <tr key={record.id} className="border-b hover:bg-muted/50">
                        <td className="p-3 font-mono">{record.id}</td>
                        <td className="p-3">{record.name}</td>
                        <td className="p-3">
                          {isEditing ? (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant={record.status === 'present' ? 'default' : 'outline'}
                                className={cn(
                                  record.status === 'present' && "bg-green-600 hover:bg-green-700"
                                )}
                                onClick={() => updateStatus(sessionId, record.id, 'present')}
                              >
                                Present
                              </Button>
                              <Button
                                size="sm"
                                variant={record.status === 'absent' ? 'default' : 'outline'}
                                className={cn(
                                  record.status === 'absent' && "bg-red-600 hover:bg-red-700"
                                )}
                                onClick={() => updateStatus(sessionId, record.id, 'absent')}
                              >
                                Absent
                              </Button>
                            </div>
                          ) : (
                            <span className={cn(
                              "px-3 py-1 rounded-full text-xs font-bold",
                              record.status === 'present' && "bg-green-100 text-green-700",
                              record.status === 'absent' && "bg-red-100 text-red-700"
                            )}>
                              {record.status.toUpperCase()}
                            </span>
                          )}
                        </td>
                        {!isEditing && (
                          <>
                            <td className="p-3">
                              <span className={cn(
                                "px-2 py-1 rounded text-xs font-semibold",
                                record.markedBy === 'manual' ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700"
                              )}>
                                {record.markedBy === 'manual' ? 'Manual' : 'System'}
                              </span>
                            </td>
                            <td className="p-3">{record.confidence ? `${record.confidence}%` : 'N/A'}</td>
                            <td className="p-3">{record.emotion || 'N/A'}</td>
                            <td className="p-3">{record.attentiveness || 'N/A'}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        );
      })}
        </div>
      )}

      {/* No Data Message */}
      {filtersLocked && sessions.length === 0 && !isLoading && (
        <Card>
          <CardContent className="p-12 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Records Found</h3>
            <p className="text-muted-foreground">
              No attendance sessions found for the selected filters and date.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
