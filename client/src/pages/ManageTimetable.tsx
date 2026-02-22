import { useState, useEffect, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Plus, Trash2, RefreshCw, Upload, Info, Calendar as CalendarIcon, Lock, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL, SEMESTERS, DEPARTMENTS, SECTIONS, getSubjectsByDepartments, getSubjectsForDepartment } from "@/lib/constants";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";

const timetableStyles = `
  .timetable-cell {
    overflow: hidden !important;
  }
  .timetable-cell::-webkit-scrollbar {
    display: none !important;
  }
  .timetable-cell {
    -ms-overflow-style: none !important;
    scrollbar-width: none !important;
  }
`;

export default function ManageTimetable() {
  const { toast } = useToast();
  const csvFileInputRef = useRef<HTMLInputElement>(null);

  // Form state for managing timetable
  const [timetableForm, setTimetableForm] = useState({
    semester: "",
    department: "",
    section: "",
    subject: "",
    dayOfWeek: "",
    startTime: "",
    endTime: "",
    teacherId: ""
  });

  const [timetableList, setTimetableList] = useState<any[]>([]);
  const [timetableLoading, setTimetableLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [csvFile, setCSVFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [timetableLoaded, setTimetableLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState("view");
  const [quickEntries, setQuickEntries] = useState<any[]>([
    { subject: "", dayOfWeek: "", startTime: "", endTime: "" }
  ]);
  const [templateSemester, setTemplateSemester] = useState("");
  const [templateDepartment, setTemplateDepartment] = useState("");
  const [templateSection, setTemplateSection] = useState("");
  const [templateDay, setTemplateDay] = useState("");
  const [templateDuration, setTemplateDuration] = useState("90"); // Default 90 minutes
  const [timetableFilter, setTimetableFilter] = useState({
    semester: "",
    department: "",
    section: ""
  });

  // Update Timetable tab state
  const [updateDate, setUpdateDate] = useState<Date>(new Date());
  const [updateSemester, setUpdateSemester] = useState("");
  const [updateDepartment, setUpdateDepartment] = useState("");
  const [updateSection, setUpdateSection] = useState("");
  const [updateTimetable, setUpdateTimetable] = useState<any[]>([]);
  const [updateIsLocked, setUpdateIsLocked] = useState(false);
  const [updateSource, setUpdateSource] = useState<'default' | 'date-specific'>('default');
  const [updateDayOfWeek, setUpdateDayOfWeek] = useState("");
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateLoaded, setUpdateLoaded] = useState(false);
  const [updateAvailableSubjects, setUpdateAvailableSubjects] = useState<string[]>([]);
  const [updatePeriodDuration, setUpdatePeriodDuration] = useState("60");

  // Get filtered subjects based on selected semester and department in template
  const filteredTemplateSubjects = useMemo(() => {
    if (!templateSemester || !templateDepartment) {
      return [];
    }
    const subjectsByDept = getSubjectsByDepartments(templateSemester, [templateDepartment]);
    return subjectsByDept[templateDepartment] || [];
  }, [templateSemester, templateDepartment]);

  // Get filtered subjects based on selected semester and department
  const filteredFilterSubjects = useMemo(() => {
    if (!timetableFilter.semester || !timetableFilter.department) {
      return [];
    }
    const subjectsByDept = getSubjectsByDepartments(timetableFilter.semester, [timetableFilter.department]);
    return subjectsByDept[timetableFilter.department] || [];
  }, [timetableFilter.semester, timetableFilter.department]);

  useEffect(() => {
    // Don't fetch on mount - wait for user to click Load Timetable
    // Reset timetable view when component mounts
    setTimetableLoaded(false);
    setTimetableList([]);
  }, []);

  // Reset timetable display when switching to view tab
  useEffect(() => {
    if (activeTab === "view") {
      // Don't auto-load, just ensure we're in a clean state
      // User must click "Load" button to fetch data
    }
  }, [activeTab]);

  const fetchTimetable = async () => {
    // Validate that all filters are selected
    if (!timetableFilter.semester || !timetableFilter.department || !timetableFilter.section) {
      toast({
        title: "Filters Required",
        description: "Please select Semester, Department, and Section to load timetable",
        variant: "destructive"
      });
      return;
    }

    setTimetableLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token found');

      const params = new URLSearchParams();
      params.append('semester', timetableFilter.semester);
      params.append('department', timetableFilter.department);
      params.append('section', timetableFilter.section);

      const response = await fetch(`${API_BASE_URL}/timetable?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setTimetableList(data.timetable || []);
        setTimetableLoaded(true);
      } else {
        throw new Error('Failed to fetch timetable');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch timetable';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setTimetableLoading(false);
    }
  };

  const handleDeleteTimetable = async (id: number) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token found');

      const response = await fetch(`${API_BASE_URL}/timetable/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        toast({
          title: "Success!",
          description: "Timetable entry deleted successfully"
        });
        // Only refresh if filters are set
        if (timetableFilter.semester && timetableFilter.department && timetableFilter.section) {
          fetchTimetable();
        }
      } else {
        throw new Error('Failed to delete');
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: "Error",
        description: "Failed to delete timetable entry",
        variant: "destructive"
      });
    }
  };

  const generateTimeSlots = (): string[] => {
    if (timetableList.length === 0) return [];
    
    // Get all unique start times from timetable and sort them
    const uniqueTimes = new Set<string>();
    timetableList.forEach(entry => {
      uniqueTimes.add(entry.start_time);
    });
    
    const sortedTimes = Array.from(uniqueTimes).sort();
    return sortedTimes;
  };

  const isTimeInSlot = (startTime: string, endTime: string, timeSlot: string): boolean => {
    return startTime === timeSlot;
  };

  const calculateEndTime = (startTime: string, durationMinutes: number): string => {
    if (!startTime) return "";
    
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + durationMinutes;
    const endHours = Math.floor(totalMinutes / 60) % 24;
    const endMinutes = totalMinutes % 60;
    
    return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
  };

  const handleQuickEntryChange = (index: number, field: string, value: string) => {
    const newEntries = [...quickEntries];
    
    // If start time is being changed, auto-calculate end time
    if (field === 'startTime' && value) {
      const durationMinutes = parseInt(templateDuration) || 90;
      const calculatedEndTime = calculateEndTime(value, durationMinutes);
      newEntries[index] = { ...newEntries[index], [field]: value, endTime: calculatedEndTime };
    } else {
      newEntries[index] = { ...newEntries[index], [field]: value };
    }
    
    setQuickEntries(newEntries);
  };

  const addQuickEntryRow = () => {
    const lastEntry = quickEntries[quickEntries.length - 1];
    const newStartTime = lastEntry?.endTime || "";
    
    // Calculate end time for the new row if start time exists
    let newEndTime = "";
    if (newStartTime) {
      const durationMinutes = parseInt(templateDuration) || 90;
      newEndTime = calculateEndTime(newStartTime, durationMinutes);
    }
    
    setQuickEntries([...quickEntries, { subject: "", dayOfWeek: templateDay, startTime: newStartTime, endTime: newEndTime }]);
  };

  const removeQuickEntryRow = (index: number) => {
    setQuickEntries(quickEntries.filter((_, i) => i !== index));
  };

  const handleQuickEntrySubmit = async () => {
    if (!templateSemester || !templateDepartment || !templateSection || !templateDay) {
      toast({
        title: "Error",
        description: "Please select Semester, Department, Section, and Day first",
        variant: "destructive"
      });
      return;
    }

    const validEntries = quickEntries.filter(entry => 
      entry.subject && entry.startTime && entry.endTime
    );

    if (validEntries.length === 0) {
      toast({
        title: "Error",
        description: "Please fill in at least one complete entry",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);
    let successCount = 0;
    let errorCount = 0;

    for (const entry of validEntries) {
      try {
        const token = localStorage.getItem('token');
        if (!token) throw new Error('No token found');

        const fullEntry = {
          semester: templateSemester,
          department: templateDepartment,
          section: templateSection,
          subject: entry.subject,
          dayOfWeek: templateDay,
          startTime: entry.startTime,
          endTime: entry.endTime
        };

        const response = await fetch(`${API_BASE_URL}/timetable`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(fullEntry)
        });

        if (response.ok) {
          successCount++;
        } else {
          errorCount++;
        }
      } catch (error) {
        errorCount++;
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    toast({
      title: "Complete",
      description: `Added ${successCount} entries. ${errorCount > 0 ? `${errorCount} failed.` : 'Go to View Timetable to see the entries.'}`,
      variant: errorCount > 0 ? "destructive" : "default"
    });

    setQuickEntries([{ subject: "", dayOfWeek: templateDay, startTime: "", endTime: "" }]);
    setSubmitting(false);
    // Don't auto-refresh - user needs to select filters first in View Timetable tab
  };

  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCSVFile(file);
    toast({
      title: "File Selected",
      description: `${file.name} selected. Click Upload to import.`
    });
  };

  const handleCSVUpload = async () => {
    if (!csvFile) {
      toast({
        title: "Error",
        description: "Please select a CSV file first",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const csv = event.target?.result as string;
        const lines = csv.split('\n').filter(line => line.trim());
        
        console.log('CSV lines:', lines.length);
        
        // Skip header row
        const entries = lines.slice(1).map(line => {
          const parts = line.split(',').map(v => v.trim());
          return { 
            semester: parts[0], 
            department: parts[1], 
            section: parts[2], 
            subject: parts[3], 
            dayOfWeek: parts[4], 
            startTime: parts[5], 
            endTime: parts[6],
            date: parts[7] || null // Optional date field
          };
        });

        console.log('Parsed entries:', entries);

        if (entries.length === 0) {
          toast({
            title: "Error",
            description: "No valid entries found in CSV",
            variant: "destructive"
          });
          setUploading(false);
          return;
        }

        let successCount = 0;
        let errorCount = 0;
        const errors: string[] = [];

        for (const entry of entries) {
          if (!entry.semester || !entry.department || !entry.section || !entry.subject || !entry.dayOfWeek || !entry.startTime || !entry.endTime) {
            errorCount++;
            errors.push(`Missing fields in: ${JSON.stringify(entry)}`);
            continue;
          }

          try {
            const token = localStorage.getItem('token');
            if (!token) throw new Error('No token found');

            console.log('Sending entry:', entry);

            const response = await fetch(`${API_BASE_URL}/timetable`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify(entry)
            });

            console.log('Response status:', response.status);

            if (response.ok) {
              successCount++;
              console.log('Entry added successfully');
            } else {
              const errorData = await response.text();
              errorCount++;
              errors.push(`Status ${response.status}: ${errorData}`);
              console.error('Failed to add entry:', response.status, errorData);
            }
          } catch (error) {
            errorCount++;
            errors.push(String(error));
            console.error('Error adding entry:', error);
          }

          // Add small delay between requests
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.log('Import summary:', { successCount, errorCount, errors });

        toast({
          title: "Import Complete",
          description: `Successfully imported ${successCount} entries. ${errorCount > 0 ? `${errorCount} failed.` : 'Go to View Timetable to see the entries.'}`,
          variant: errorCount > 0 ? "destructive" : "default"
        });

        // Reset file
        setCSVFile(null);
        if (csvFileInputRef.current) {
          csvFileInputRef.current.value = '';
        }

        // Don't auto-refresh - user needs to select filters first in View Timetable tab
      } catch (error) {
        console.error('CSV import error:', error);
        toast({
          title: "Error",
          description: "Failed to import CSV file: " + (error instanceof Error ? error.message : 'Unknown error'),
          variant: "destructive"
        });
      } finally {
        setUploading(false);
      }
    };
    reader.readAsText(csvFile);
  };

  return (
    <div className="space-y-6">
      <style>{timetableStyles}</style>
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-bold">Manage Timetable</h1>
        <p className="text-muted-foreground">Add or update class schedule</p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="view" className="data-[state=active]:bg-green-600 data-[state=active]:text-white">View Timetable</TabsTrigger>
          <TabsTrigger value="create" className="data-[state=active]:bg-green-600 data-[state=active]:text-white">Create Timetable</TabsTrigger>
          <TabsTrigger value="update" className="data-[state=active]:bg-green-600 data-[state=active]:text-white">Update Timetable</TabsTrigger>
        </TabsList>

        {/* View Timetable Tab */}
        <TabsContent value="view" className="mt-4 space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <Label>Semester <span className="text-red-500">*</span></Label>
                  <Select value={timetableFilter.semester} onValueChange={(value) => setTimetableFilter(prev => ({ ...prev, semester: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select semester" />
                    </SelectTrigger>
                    <SelectContent>
                      {SEMESTERS.map(sem => (
                        <SelectItem key={sem} value={sem}>{sem}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Department <span className="text-red-500">*</span></Label>
                  <Select value={timetableFilter.department} onValueChange={(value) => setTimetableFilter(prev => ({ ...prev, department: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEPARTMENTS.map(dept => (
                        <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Section <span className="text-red-500">*</span></Label>
                  <Select value={timetableFilter.section} onValueChange={(value) => setTimetableFilter(prev => ({ ...prev, section: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select section" />
                    </SelectTrigger>
                    <SelectContent>
                      {SECTIONS.map(sec => (
                        <SelectItem key={sec} value={sec}>{sec}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end gap-2">
                  <Button 
                    onClick={() => {
                      setTimetableFilter({ semester: "", department: "", section: "" });
                      setTimetableLoaded(false);
                      setTimetableList([]);
                    }} 
                    variant="outline"
                    disabled={timetableLoading}
                    className="flex-1"
                  >
                    Clear
                  </Button>
                  <Button onClick={fetchTimetable} disabled={timetableLoading} className="flex-1">
                    {timetableLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                    Load
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Timetable List */}
          <Card>
            <CardHeader>
              <CardTitle>Current Timetable</CardTitle>
              <CardDescription>{timetableLoaded ? `${timetableList.length} entries found` : 'Click Load Timetable to view'}</CardDescription>
            </CardHeader>
            <CardContent>
              {!timetableLoaded ? (
                <p className="text-muted-foreground text-center py-8">Select Semester, Department, and Section, then click "Load" to view timetable.</p>
              ) : timetableList.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No timetable entries found for the selected filters.</p>
              ) : (
                <div className="overflow-x-auto">
                  <div className="inline-block min-w-full bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg overflow-hidden">
                          <th className="p-3 text-left font-bold text-sm min-w-[85px]">Day</th>
                          {generateTimeSlots().map((timeSlot) => (
                            <th key={timeSlot} className="p-3 text-center font-bold text-sm min-w-[110px]">
                              {timeSlot}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, dayIdx) => {
                          const isEvenRow = dayIdx % 2 === 0;
                          const bgColor = isEvenRow ? 'bg-white' : 'bg-green-50/40';
                          const boxBg = isEvenRow ? 'bg-white' : 'bg-green-50/40';
                          const boxBorder = isEvenRow ? 'border-green-200/50' : 'border-green-50/40';
                          const textColor = 'text-gray-700';
                          const dotColor = isEvenRow ? 'bg-green-400' : 'bg-green-300';
                          const rowBorder = isEvenRow ? 'border-b border-green-200/50' : '';
                          
                          return (
                            <tr 
                              key={day} 
                              className={`transition-all duration-200 ${bgColor} ${rowBorder}`}
                            >
                              <td className={`p-3 font-semibold ${textColor} min-w-[85px] text-sm`}>
                                {day}
                              </td>
                              {generateTimeSlots().map((timeSlot) => {
                                const classesAtTime = timetableList.filter(entry => 
                                  entry.day_of_week === day && 
                                  isTimeInSlot(entry.start_time, entry.end_time, timeSlot)
                                );
                                
                                return (
                                  <td 
                                    key={`${day}-${timeSlot}`} 
                                    className={`timetable-cell p-2.5 min-w-[110px] align-top min-h-[800px] ${isEvenRow ? 'border-b border-green-200/50' : ''}`}
                                  >
                                    <div className="space-y-1 overflow-hidden">
                                      {classesAtTime.map((cls, idx) => (
                                        <div 
                                          key={idx} 
                                          className="group relative overflow-hidden rounded-md transition-all duration-300"
                                        >
                                          <div className={`relative z-10 p-2 rounded-md border ${boxBg} ${boxBorder}`}>
                                            <div className={`font-semibold ${textColor} mb-1 text-xs break-words leading-tight line-clamp-2`}>
                                              {cls.subject}
                                            </div>
                                            
                                            <div className="flex items-center gap-1 mb-1">
                                              <div className={`w-1.5 h-1.5 rounded-full ${dotColor}`}></div>
                                              <span className={`text-xs ${textColor} font-medium`}>
                                                {cls.start_time} - {cls.end_time}
                                              </span>
                                            </div>
                                            
                                            <div className="flex gap-1 flex-wrap">
                                              <span className={`inline-block px-1.5 py-0.5 bg-white text-gray-600 text-xs rounded font-medium border border-gray-200`}>
                                                {cls.department}
                                              </span>
                                              <span className={`inline-block px-1.5 py-0.5 bg-white text-gray-600 text-xs rounded font-medium border border-gray-200`}>
                                                {cls.section}
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Create Timetable Tab */}
        <TabsContent value="create" className="mt-4 space-y-4">
          <Tabs defaultValue="fast-entry" className="w-full">
            <TabsList className="bg-transparent border-b-0 w-auto gap-2">
              <TabsTrigger value="fast-entry" className="data-[state=active]:bg-green-600 data-[state=active]:text-white rounded-lg px-4 py-2 text-xs font-medium">Fast Entry</TabsTrigger>
              <TabsTrigger value="csv-import" className="data-[state=active]:bg-green-600 data-[state=active]:text-white rounded-lg px-4 py-2 text-xs font-medium">CSV Import</TabsTrigger>
            </TabsList>

            {/* Fast Entry Sub-Tab */}
            <TabsContent value="fast-entry" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Fast Entry - Template Mode</CardTitle>
              <CardDescription>Select semester/department/section/day once, then quickly add multiple classes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Important Instructions */}
              <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded-r-lg">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-blue-900 font-semibold mb-1">How to Use:</p>
                    <p className="text-sm text-blue-800">
                      Select Day, Semester, Department, Section, and Duration. Add subjects with time slots. New rows auto-calculate times based on duration. Change duration between rows if needed (e.g., 55 min for lectures, 180 min for labs).
                    </p>
                  </div>
                </div>
              </div>

              {/* Template Selection */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <Label>Semester <span className="text-red-500">*</span></Label>
                  <Select value={templateSemester} onValueChange={setTemplateSemester}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select semester" />
                    </SelectTrigger>
                    <SelectContent>
                      {SEMESTERS.map(sem => (
                        <SelectItem key={sem} value={sem}>{sem}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Department <span className="text-red-500">*</span></Label>
                  <Select value={templateDepartment} onValueChange={setTemplateDepartment}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEPARTMENTS.map(dept => (
                        <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Section <span className="text-red-500">*</span></Label>
                  <Select value={templateSection} onValueChange={setTemplateSection}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select section" />
                    </SelectTrigger>
                    <SelectContent>
                      {SECTIONS.map(sec => (
                        <SelectItem key={sec} value={sec}>{sec}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Day <span className="text-red-500">*</span></Label>
                  <Select value={templateDay} onValueChange={setTemplateDay}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select day" />
                    </SelectTrigger>
                    <SelectContent>
                      {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
                        <SelectItem key={day} value={day}>{day}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Duration (minutes)</Label>
                  <Input 
                    type="number"
                    min="15"
                    max="300"
                    step="15"
                    value={templateDuration}
                    onChange={(e) => setTemplateDuration(e.target.value)}
                    placeholder="90"
                    className="h-10"
                  />
                </div>
              </div>

              {templateSemester && templateDepartment && templateSection && templateDay && (
                <>
                  <div className="bg-green-50 border-l-4 border-green-500 p-3 rounded-r-lg">
                    <p className="text-sm text-green-700 font-medium">
                      ✓ Template Active: {templateSemester}th sem, {templateDepartment}, Section {templateSection}, <span className="font-bold text-green-900">{templateDay}</span> | Duration: {templateDuration} min
                    </p>
                    <p className="text-xs text-green-600 mt-1">All entries below will be added to <strong>{templateDay}</strong></p>
                  </div>
                  
                  {/* Quick Entry Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-muted">
                          <th className="border p-2 text-left">Subject</th>
                          <th className="border p-2 text-left">Start Time</th>
                          <th className="border p-2 text-left">End Time (Auto)</th>
                          <th className="border p-2 text-center">Delete</th>
                        </tr>
                      </thead>
                      <tbody>
                        {quickEntries.map((entry, index) => (
                          <tr key={index} className="border-b hover:bg-muted/50">
                            <td className="border p-2">
                              <Select value={entry.subject} onValueChange={(value) => handleQuickEntryChange(index, 'subject', value)}>
                                <SelectTrigger className="h-8">
                                  <SelectValue placeholder="Select subject" />
                                </SelectTrigger>
                                <SelectContent>
                                  {filteredTemplateSubjects.map(subject => (
                                    <SelectItem key={subject} value={subject}>{subject}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="border p-2">
                              <Input 
                                type="time"
                                value={entry.startTime}
                                onChange={(e) => handleQuickEntryChange(index, 'startTime', e.target.value)}
                                className="h-8 text-xs"
                              />
                            </td>
                            <td className="border p-2">
                              <Input 
                                type="time"
                                value={entry.endTime}
                                disabled
                                className="h-8 text-xs bg-muted"
                              />
                            </td>
                            <td className="border p-2 text-center">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => removeQuickEntryRow(index)}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={addQuickEntryRow} variant="outline" className="flex-1">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Row
                    </Button>
                    <Button onClick={handleQuickEntrySubmit} disabled={submitting} className="flex-1 bg-green-600 hover:bg-green-700">
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                      Save All ({quickEntries.filter(e => e.subject && e.startTime && e.endTime).length})
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
            </TabsContent>

            {/* CSV Import Sub-Tab */}
            <TabsContent value="csv-import" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Bulk Import from CSV</CardTitle>
              <CardDescription>Upload a CSV file to quickly add multiple timetable entries</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="bg-muted p-3 rounded-lg space-y-3">
                  <div>
                    <p className="text-sm font-semibold mb-1">📋 CSV Format:</p>
                    <p className="text-sm text-muted-foreground font-mono bg-white dark:bg-gray-800 p-2 rounded border">semester,department,section,subject,dayOfWeek,startTime,endTime</p>
                  </div>
                  
                  <div className="border-t pt-2">
                    <p className="text-sm font-semibold text-muted-foreground mb-1">✅ Requirements:</p>
                    <ul className="text-sm text-muted-foreground space-y-0.5 ml-4">
                      <li>• Semester: 1-8 | Department: CS, IS | Section: A, B</li>
                      <li>• Subject: EXACT name from system (case-sensitive)</li>
                      <li>• Day: Monday-Saturday | Time: HH:MM (24-hour)</li>
                    </ul>
                  </div>
                  
                  <div className="border-t pt-2">
                    <p className="text-sm font-semibold text-muted-foreground mb-1">📝 Example:</p>
                    <div className="text-sm text-muted-foreground font-mono bg-white dark:bg-gray-800 p-2 rounded border space-y-0.5">
                      <div>semester,department,section,subject,dayOfWeek,startTime,endTime</div>
                      <div>1,CS,A,Engineering Mathematics – I,Monday,09:00,09:55</div>
                    </div>
                  </div>
                  
                  <div className="p-2 bg-blue-50 dark:bg-blue-950/20 rounded border border-blue-300 dark:border-blue-900">
                    <p className="text-sm text-blue-900 dark:text-blue-100 flex items-start gap-1">
                      <Info className="h-4 w-4 shrink-0 mt-0.5" />
                      <span><strong>Note:</strong> First row = header. Subject names must match system exactly. Check Fast Entry tab for valid subjects. Save as CSV (Comma delimited).</span>
                    </p>
                  </div>
                </div>
                <div>
                  <Label htmlFor="csv-upload">Select CSV File</Label>
                  <Input 
                    ref={csvFileInputRef}
                    id="csv-upload"
                    type="file" 
                    accept=".csv"
                    onChange={handleCSVImport}
                    className="cursor-pointer"
                  />
                  {csvFile && (
                    <p className="text-sm text-green-600 mt-2">✓ {csvFile.name} selected</p>
                  )}
                </div>
                <Button 
                  onClick={handleCSVUpload} 
                  disabled={!csvFile || uploading}
                  className="w-full"
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                  {uploading ? "Uploading..." : "Upload CSV"}
                </Button>
              </div>
            </CardContent>
          </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* Update Timetable Tab */}
        <TabsContent value="update" className="mt-4 space-y-4">
          <UpdateTimetableContent 
            updateDate={updateDate}
            setUpdateDate={setUpdateDate}
            updateSemester={updateSemester}
            setUpdateSemester={setUpdateSemester}
            updateDepartment={updateDepartment}
            setUpdateDepartment={setUpdateDepartment}
            updateSection={updateSection}
            setUpdateSection={setUpdateSection}
            updateTimetable={updateTimetable}
            setUpdateTimetable={setUpdateTimetable}
            updateIsLocked={updateIsLocked}
            setUpdateIsLocked={setUpdateIsLocked}
            updateSource={updateSource}
            setUpdateSource={setUpdateSource}
            updateDayOfWeek={updateDayOfWeek}
            setUpdateDayOfWeek={setUpdateDayOfWeek}
            updateLoading={updateLoading}
            setUpdateLoading={setUpdateLoading}
            updateLoaded={updateLoaded}
            setUpdateLoaded={setUpdateLoaded}
            updateAvailableSubjects={updateAvailableSubjects}
            setUpdateAvailableSubjects={setUpdateAvailableSubjects}
            updatePeriodDuration={updatePeriodDuration}
            setUpdatePeriodDuration={setUpdatePeriodDuration}
            toast={toast}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Update Timetable Component
function UpdateTimetableContent({ 
  updateDate, setUpdateDate,
  updateSemester, setUpdateSemester,
  updateDepartment, setUpdateDepartment,
  updateSection, setUpdateSection,
  updateTimetable, setUpdateTimetable,
  updateIsLocked, setUpdateIsLocked,
  updateSource, setUpdateSource,
  updateDayOfWeek, setUpdateDayOfWeek,
  updateLoading, setUpdateLoading,
  updateLoaded, setUpdateLoaded,
  updateAvailableSubjects, setUpdateAvailableSubjects,
  updatePeriodDuration, setUpdatePeriodDuration,
  toast
}: any) {
  
  const hasValidFilters = updateSemester && updateDepartment && updateSection;

  // Standard time templates
  const timeTemplates = [
    { label: "Standard (9 AM - 4 PM, 1hr periods)", periods: [
      { start: "09:00", end: "10:00" },
      { start: "10:00", end: "11:00" },
      { start: "11:00", end: "12:00" },
      { start: "12:00", end: "13:00" },
      { start: "14:00", end: "15:00" },
      { start: "15:00", end: "16:00" }
    ]},
    { label: "Morning Shift (8 AM - 1 PM, 1hr periods)", periods: [
      { start: "08:00", end: "09:00" },
      { start: "09:00", end: "10:00" },
      { start: "10:00", end: "11:00" },
      { start: "11:00", end: "12:00" },
      { start: "12:00", end: "13:00" }
    ]},
    { label: "Afternoon Shift (1 PM - 6 PM, 1hr periods)", periods: [
      { start: "13:00", end: "14:00" },
      { start: "14:00", end: "15:00" },
      { start: "15:00", end: "16:00" },
      { start: "16:00", end: "17:00" },
      { start: "17:00", end: "18:00" }
    ]}
  ];

  // Update available subjects when semester or department changes
  useEffect(() => {
    if (updateSemester && updateDepartment) {
      const subjects = getSubjectsForDepartment(updateSemester, updateDepartment);
      setUpdateAvailableSubjects(subjects);
    } else {
      setUpdateAvailableSubjects([]);
    }
  }, [updateSemester, updateDepartment]);

  const loadSchedule = async () => {
    if (!hasValidFilters) {
      toast({
        title: "Missing Filters",
        description: "Please select Semester, Department, and Section",
        variant: "destructive"
      });
      return;
    }

    setUpdateLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast({
          title: "Authentication Required",
          description: "Please login to continue",
          variant: "destructive"
        });
        return;
      }

      const dateStr = format(updateDate, 'yyyy-MM-dd');
      const response = await fetch(
        `${API_BASE_URL}/timetable/for-date?date=${dateStr}&semester=${updateSemester}&department=${updateDepartment}&section=${updateSection}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setUpdateTimetable(data.timetable || []);
        setUpdateIsLocked(data.is_locked);
        setUpdateSource(data.source);
        setUpdateDayOfWeek(data.day_of_week);
        setUpdateLoaded(true);
        
        toast({
          title: "Schedule Loaded",
          description: `Showing ${data.source} timetable for ${data.day_of_week}`
        });
      } else {
        toast({
          title: "Failed to Load",
          description: "Could not load timetable",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Load schedule error:', error);
      toast({
        title: "Error",
        description: "Failed to load schedule",
        variant: "destructive"
      });
    } finally {
      setUpdateLoading(false);
    }
  };

  const saveSchedule = async () => {
    // Validation
    const emptySubjects = updateTimetable.filter(entry => !entry.subject || entry.subject.trim() === '');
    if (emptySubjects.length > 0) {
      toast({
        title: "Validation Error",
        description: "All periods must have a subject selected",
        variant: "destructive"
      });
      return;
    }

    for (let i = 0; i < updateTimetable.length; i++) {
      for (let j = i + 1; j < updateTimetable.length; j++) {
        const period1 = updateTimetable[i];
        const period2 = updateTimetable[j];
        
        if ((period1.start_time < period2.end_time && period1.end_time > period2.start_time) || 
            (period2.start_time < period1.end_time && period2.end_time > period1.start_time)) {
          toast({
            title: "Validation Error",
            description: `Period ${i + 1} and Period ${j + 1} have overlapping times`,
            variant: "destructive"
          });
          return;
        }
      }
    }

    for (let i = 0; i < updateTimetable.length; i++) {
      if (updateTimetable[i].start_time >= updateTimetable[i].end_time) {
        toast({
          title: "Validation Error",
          description: `Period ${i + 1}: Start time must be before end time`,
          variant: "destructive"
        });
        return;
      }
    }

    if (updateTimetable.length === 0) {
      toast({
        title: "No Periods",
        description: "Please add at least one period",
        variant: "destructive"
      });
      return;
    }

    setUpdateLoading(true);
    try {
      const token = localStorage.getItem('token');
      const dateStr = format(updateDate, 'yyyy-MM-dd');
      
      const response = await fetch(`${API_BASE_URL}/timetable/update-for-date`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          date: dateStr,
          semester: parseInt(updateSemester),
          department: updateDepartment,
          section: updateSection,
          timetable: updateTimetable.map(entry => ({
            start_time: entry.start_time,
            end_time: entry.end_time,
            subject: entry.subject
          }))
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast({
          title: "Success",
          description: `Timetable saved for ${format(updateDate, 'PPP')}`
        });
        
        loadSchedule();
      } else {
        toast({
          title: "Failed to Save",
          description: data.message || "Could not save timetable",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Save schedule error:', error);
      toast({
        title: "Error",
        description: "Failed to save schedule",
        variant: "destructive"
      });
    } finally {
      setUpdateLoading(false);
    }
  };

  const addPeriod = () => {
    let startTime = "09:00";
    let endTime = "10:00";
    
    if (updateTimetable.length > 0) {
      const lastPeriod = updateTimetable[updateTimetable.length - 1];
      startTime = lastPeriod.end_time;
      
      const [hours, minutes] = startTime.split(':').map(Number);
      const duration = parseInt(updatePeriodDuration);
      const totalMinutes = hours * 60 + minutes + duration;
      const newHours = Math.floor(totalMinutes / 60);
      const newMinutes = totalMinutes % 60;
      endTime = `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;
    }
    
    setUpdateTimetable([...updateTimetable, {
      start_time: startTime,
      end_time: endTime,
      subject: ""
    }]);
  };

  const applyTemplate = (templateIndex: number) => {
    const template = timeTemplates[templateIndex];
    const newTimetable = template.periods.map(period => ({
      start_time: period.start,
      end_time: period.end,
      subject: ""
    }));
    setUpdateTimetable(newTimetable);
    toast({
      title: "Template Applied",
      description: `${template.label} has been applied`
    });
  };

  const removePeriod = (index: number) => {
    setUpdateTimetable(updateTimetable.filter((_: any, i: number) => i !== index));
  };

  const updatePeriod = (index: number, field: string, value: string) => {
    const updated = [...updateTimetable];
    updated[index] = { ...updated[index], [field]: value };
    setUpdateTimetable(updated);
  };

  const cancel = () => {
    setUpdateTimetable([]);
    setUpdateLoaded(false);
    setUpdateIsLocked(false);
    setUpdateSemester("");
    setUpdateDepartment("");
    setUpdateSection("");
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Update Timetable for Specific Date</CardTitle>
          <CardDescription>Modify timetable for a particular date without affecting the default schedule</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Select Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start" disabled={updateLoaded}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(updateDate, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={updateDate} onSelect={(d) => d && setUpdateDate(d)} />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Semester</Label>
              <Select value={updateSemester} onValueChange={setUpdateSemester} disabled={updateLoaded}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {SEMESTERS.map(s => (
                    <SelectItem key={s} value={s}>Sem {s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Department</Label>
              <Select value={updateDepartment} onValueChange={setUpdateDepartment} disabled={updateLoaded}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map(d => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Section</Label>
              <Select value={updateSection} onValueChange={setUpdateSection} disabled={updateLoaded}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {SECTIONS.map(s => (
                    <SelectItem key={s} value={s}>Section {s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button 
            onClick={loadSchedule} 
            disabled={!hasValidFilters || updateLoading}
            className="w-full"
          >
            {updateLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              "Load Schedule"
            )}
          </Button>

          {updateLoaded && (
            <Button 
              onClick={cancel} 
              variant="outline"
              className="w-full"
            >
              Change Filters
            </Button>
          )}
        </CardContent>
      </Card>

      {updateLoaded && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>
                Timetable for {updateDepartment}-{updateSection}, Sem {updateSemester} - {format(updateDate, 'PPP')}
              </span>
              {updateIsLocked && (
                <span className="flex items-center gap-2 text-sm font-normal text-orange-600">
                  <Lock className="h-4 w-4" />
                  LOCKED
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!updateIsLocked && updateSource === 'default' && (
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-900">
                    <p className="font-semibold mb-1">Showing default {updateDayOfWeek} schedule</p>
                    <p>Editing will create a NEW timetable for {format(updateDate, 'PPP')}.</p>
                    <p>Default schedule will NOT be modified.</p>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <p className="text-sm font-semibold mb-3">Quick Setup Templates</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {timeTemplates.map((template, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        onClick={() => applyTemplate(index)}
                        className="text-xs"
                      >
                        {template.label}
                      </Button>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <label className="text-xs font-medium">Period Duration:</label>
                    <Select value={updatePeriodDuration} onValueChange={setUpdatePeriodDuration}>
                      <SelectTrigger className="w-32 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="45">45 min</SelectItem>
                        <SelectItem value="50">50 min</SelectItem>
                        <SelectItem value="55">55 min</SelectItem>
                        <SelectItem value="60">60 min</SelectItem>
                        <SelectItem value="90">90 min</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-xs text-muted-foreground">(for new periods)</span>
                  </div>
                </div>
              </div>
            )}

            {updateIsLocked && (
              <div className="flex items-start gap-3 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-orange-600 shrink-0 mt-0.5" />
                <div className="text-sm text-orange-900">
                  <p className="font-semibold mb-1">This date has a specific timetable that is locked</p>
                  <p>Cannot edit. Contact administrator if changes are needed.</p>
                </div>
              </div>
            )}

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Period</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Start Time</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">End Time</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Subject</th>
                    {!updateIsLocked && <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {updateTimetable.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                        No periods found. Click "Add Period" to create one.
                      </td>
                    </tr>
                  ) : (
                    updateTimetable.map((entry: any, index: number) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium">{index + 1}</td>
                        <td className="px-4 py-3">
                          {updateIsLocked ? (
                            <span className="text-sm">{entry.start_time}</span>
                          ) : (
                            <Input
                              type="time"
                              value={entry.start_time}
                              onChange={(e) => updatePeriod(index, 'start_time', e.target.value)}
                              className="w-32"
                            />
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {updateIsLocked ? (
                            <span className="text-sm">{entry.end_time}</span>
                          ) : (
                            <Input
                              type="time"
                              value={entry.end_time}
                              onChange={(e) => updatePeriod(index, 'end_time', e.target.value)}
                              className="w-32"
                            />
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {updateIsLocked ? (
                            <span className="text-sm">{entry.subject}</span>
                          ) : (
                            <Select
                              value={entry.subject}
                              onValueChange={(value) => updatePeriod(index, 'subject', value)}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select subject" />
                              </SelectTrigger>
                              <SelectContent>
                                {updateAvailableSubjects.map((subject) => (
                                  <SelectItem key={subject} value={subject}>
                                    {subject}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </td>
                        {!updateIsLocked && (
                          <td className="px-4 py-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removePeriod(index)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between">
              <div>
                {!updateIsLocked && (
                  <Button variant="outline" onClick={addPeriod} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Period
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={cancel}>
                  Cancel
                </Button>
                {!updateIsLocked && (
                  <Button onClick={saveSchedule} disabled={updateLoading}>
                    {updateLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      `Save for ${format(updateDate, 'MMM d, yyyy')}`
                    )}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
