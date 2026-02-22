import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Trash2, Users, BookOpen, Calendar, BarChart3, AlertCircle, Database, RefreshCw, Table as TableIcon, UserPlus, Hash, Lock, Eye, EyeOff, Mail, Phone, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL, SEMESTERS, DEPARTMENTS, SECTIONS, getSubjectsByDepartments } from "@/lib/constants";
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

interface DashboardStats {
  approvedTeacherIds: number;
  registeredTeachers: number;
  totalStudents: number;
  totalSessions: number;
}

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

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [dbmsData, setDbmsData] = useState<DbmsData | null>(null);
  const [teachersTableData, setTeachersTableData] = useState<TableData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dbmsLoading, setDbmsLoading] = useState(false);
  const [teachersLoading, setTeachersLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState("");
  const [selectedTab, setSelectedTab] = useState("teachers");
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [conflictData, setConflictData] = useState<any>(null);
  const [pendingAssignment, setPendingAssignment] = useState<any>(null);
  const { toast } = useToast();

  // Form state for editing teacher
  const [editTeacherForm, setEditTeacherForm] = useState({
    teacherId: "",
    name: "",
    email: "",
    phone_no: "",
    password: "",
    confirmPassword: ""
  });
  const [editTeacherData, setEditTeacherData] = useState<any>(null); // Original data from database (for display)
  const [teacherFetched, setTeacherFetched] = useState(false);
  const [fetchingTeacher, setFetchingTeacher] = useState(false);
  const [updatingTeacher, setUpdatingTeacher] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [showEditConfirmPassword, setShowEditConfirmPassword] = useState(false);

  // Form state for registering teacher
  const [teacherRegForm, setTeacherRegForm] = useState({
    name: "",
    teacherId: "",
    email: "",
    phone_no: "",
    password: "",
    confirmPassword: "",
    semesters: [] as string[],
    departments: [] as string[],
    sections: [] as string[],
    subjects: [] as string[],
    enrollmentYear: new Date().getFullYear().toString(),
    enrollmentMonth: "August"
  });

  // Form state for assigning teachers to subjects
  const [assignTeacherForm, setAssignTeacherForm] = useState({
    teacherId: "",
    semesters: [] as string[],
    departments: [] as string[],
    sections: [] as string[],
    subjects: [] as string[],
    enrollmentYear: new Date().getFullYear().toString(),
    enrollmentMonth: "August"
  });

  // Calculate semester type and completion date based on enrollment month
  const teacherEnrollmentInfo = useMemo(() => {
    const semesterType = teacherRegForm.enrollmentMonth === "August" ? "Odd" : "Even";
    const completionMonth = teacherRegForm.enrollmentMonth === "August" ? "December" : "June";
    const completionYear = teacherRegForm.enrollmentYear;
    
    // Create completion date - last day of the month
    // December = month 12, June = month 6 (1-indexed for YYYY-MM-DD format)
    const monthNum = completionMonth === "December" ? "12" : "06";
    const lastDay = completionMonth === "December" ? "31" : "30";
    const completionDate = `${completionYear}-${monthNum}-${lastDay}`;
    
    return {
      semesterType,
      completionMonth,
      completionYear,
      completionDate
    };
  }, [teacherRegForm.enrollmentMonth, teacherRegForm.enrollmentYear]);

  // Generate year options (present -1 year to future +6 years)
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = currentYear - 1; i <= currentYear + 6; i++) {
      years.push(i.toString());
    }
    return years;
  }, []);

  // Get subjects based on selected semesters and departments
  const filteredTeacherSubjects = useMemo(() => {
    if (teacherRegForm.semesters.length === 0 || teacherRegForm.departments.length === 0) {
      return {};
    }
    
    // Get subjects for ALL selected semesters
    const result: Record<string, Record<string, string[]>> = {};
    
    teacherRegForm.semesters.forEach(semester => {
      const subjectsByDept = getSubjectsByDepartments(semester, teacherRegForm.departments);
      result[semester] = subjectsByDept;
    });
    
    return result;
  }, [teacherRegForm.semesters, teacherRegForm.departments]);

  // Calculate semester type and completion date for assign teacher form
  const assignTeacherEnrollmentInfo = useMemo(() => {
    const semesterType = assignTeacherForm.enrollmentMonth === "August" ? "Odd" : "Even";
    const completionMonth = assignTeacherForm.enrollmentMonth === "August" ? "December" : "June";
    const completionYear = assignTeacherForm.enrollmentYear;
    
    // Create completion date - last day of the month
    // December = month 12, June = month 6 (1-indexed for YYYY-MM-DD format)
    const monthNum = completionMonth === "December" ? "12" : "06";
    const lastDay = completionMonth === "December" ? "31" : "30";
    const completionDate = `${completionYear}-${monthNum}-${lastDay}`;
    
    return {
      semesterType,
      completionMonth,
      completionYear,
      completionDate
    };
  }, [assignTeacherForm.enrollmentMonth, assignTeacherForm.enrollmentYear]);

  // Get subjects based on selected semesters and departments for assign teacher form
  const filteredAssignTeacherSubjects = useMemo(() => {
    if (assignTeacherForm.semesters.length === 0 || assignTeacherForm.departments.length === 0) {
      return {};
    }
    
    // Get subjects for ALL selected semesters
    const result: Record<string, Record<string, string[]>> = {};
    
    assignTeacherForm.semesters.forEach(semester => {
      const subjectsByDept = getSubjectsByDepartments(semester, assignTeacherForm.departments);
      result[semester] = subjectsByDept;
    });
    
    return result;
  }, [assignTeacherForm.semesters, assignTeacherForm.departments]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchTeachersTableData = async () => {
    setTeachersLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token found');

      const response = await fetch(`${API_BASE_URL}/dbms-values/table/teachers`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        setTeachersTableData(data);
      } else {
        throw new Error(data.message || 'Failed to fetch teachers table');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setTeachersLoading(false);
    }
  };

  const fetchDbmsData = async () => {
    setDbmsLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token found');

      const response = await fetch(`${API_BASE_URL}/dbms-values`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        setDbmsData(data);
        const tableNames = Object.keys(data.tables);
        if (tableNames.length > 0 && !selectedTable) {
          setSelectedTable(tableNames[0]);
        }
      } else {
        throw new Error(data.message || 'Failed to fetch database values');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setDbmsLoading(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token found');

      // Fetch dashboard stats
      const statsResponse = await fetch(`${API_BASE_URL}/admin/dashboard`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData.stats);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch data';
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTeacherRegNextStep = () => {
    if (!teacherRegForm.name || !teacherRegForm.teacherId || !teacherRegForm.password || !teacherRegForm.confirmPassword) {
      toast({
        title: "Error",
        description: "Please fill in all personal information fields.",
        variant: "destructive"
      });
      return;
    }

    if (teacherRegForm.password !== teacherRegForm.confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match.",
        variant: "destructive"
      });
      return;
    }

    if (teacherRegForm.password.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters long.",
        variant: "destructive"
      });
      return;
    }
  };

  const handleTeacherRegMultiSelect = (field: keyof typeof teacherRegForm, value: string) => {
    setTeacherRegForm(prev => {
      const currentValue = prev[field];
      if (Array.isArray(currentValue)) {
        const newValue = currentValue.includes(value)
          ? currentValue.filter((item: string) => item !== value)
          : [...currentValue, value];
        
        // Reset subjects when departments change
        if (field === 'departments') {
          return {
            ...prev,
            [field]: newValue,
            subjects: []
          };
        }
        
        return {
          ...prev,
          [field]: newValue
        };
      }
      return prev;
    });
  };

  const handleAssignTeacherMultiSelect = (field: keyof typeof assignTeacherForm, value: string) => {
    setAssignTeacherForm(prev => {
      const currentValue = prev[field];
      if (Array.isArray(currentValue)) {
        // Use Set to ensure no duplicates
        const uniqueValues = Array.from(new Set(currentValue.filter((item: string) => item && item.trim())));
        
        const newValue = uniqueValues.includes(value)
          ? uniqueValues.filter((item: string) => item !== value)
          : [...uniqueValues, value];
        
        // Reset subjects when departments change
        if (field === 'departments') {
          return {
            ...prev,
            [field]: Array.from(new Set(newValue)),
            subjects: []
          };
        }
        
        return {
          ...prev,
          [field]: Array.from(new Set(newValue))
        };
      }
      return prev;
    });
  };

  const fetchTeacherDetails = async () => {
    if (!editTeacherForm.teacherId.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter a Teacher ID"
      });
      return;
    }

    setFetchingTeacher(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token found');

      const response = await fetch(`${API_BASE_URL}/teachers/${editTeacherForm.teacherId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Set original data for display
        setEditTeacherData({
          teacherId: data.teacher.teacher_id,
          name: data.teacher.name,
          email: data.teacher.email,
          phone_no: data.teacher.phone_no
        });
        
        // Set form data for editing
        setEditTeacherForm({
          ...editTeacherForm,
          name: data.teacher.name,
          email: data.teacher.email,
          phone_no: data.teacher.phone_no,
          password: "",
          confirmPassword: ""
        });
        setTeacherFetched(true);
        toast({
          title: "Success",
          description: "Teacher details fetched successfully"
        });
      } else {
        throw new Error(data.message || 'Failed to fetch teacher details');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch teacher details';
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage
      });
      setTeacherFetched(false);
    } finally {
      setFetchingTeacher(false);
    }
  };

  const handleEditTeacherSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check if teacher has been fetched first
    if (!teacherFetched) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please fetch teacher details first"
      });
      return;
    }

    // Validation
    if (!editTeacherForm.name || !editTeacherForm.email || !editTeacherForm.phone_no) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Name, email, and phone number are required"
      });
      return;
    }

    // Name validation
    if (editTeacherForm.name.trim().length < 3) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Name must be at least 3 characters long"
      });
      return;
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(editTeacherForm.email)) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter a valid email address"
      });
      return;
    }

    // Phone number validation (required)
    if (editTeacherForm.phone_no.length !== 10 || !/^\d{10}$/.test(editTeacherForm.phone_no)) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Phone number must be exactly 10 digits"
      });
      return;
    }

    // Password validation (if provided)
    if (editTeacherForm.password) {
      if (editTeacherForm.password.length < 6) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Password must be at least 6 characters"
        });
        return;
      }

      if (editTeacherForm.password !== editTeacherForm.confirmPassword) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Passwords do not match"
        });
        return;
      }
    }

    setUpdatingTeacher(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token found');

      const response = await fetch(`${API_BASE_URL}/teachers/${editTeacherForm.teacherId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: editTeacherForm.name,
          email: editTeacherForm.email,
          phone_no: editTeacherForm.phone_no,
          password: editTeacherForm.password || undefined
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast({
          title: "Success",
          description: data.message || "Teacher details updated successfully"
        });
        
        // Clear password fields and refresh teacher details
        setEditTeacherForm({
          ...editTeacherForm,
          password: "",
          confirmPassword: ""
        });
        
        // Refresh the teacher details to show updated info
        await fetchTeacherDetails();
      } else {
        throw new Error(data.message || 'Failed to update teacher details');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update teacher details';
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage
      });
    } finally {
      setUpdatingTeacher(false);
    }
  };

  const handleTeacherRegSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation 1: Check all fields not empty
    if (!teacherRegForm.name || !teacherRegForm.teacherId || !teacherRegForm.email || !teacherRegForm.phone_no || !teacherRegForm.password || !teacherRegForm.confirmPassword) {
      toast({
        title: "Error",
        description: "Please fill in all personal information fields.",
        variant: "destructive"
      });
      return;
    }

    // Validation 2: Name minimum 3 characters
    if (teacherRegForm.name.trim().length < 3) {
      toast({
        title: "Error",
        description: "Name must be at least 3 characters long.",
        variant: "destructive"
      });
      return;
    }

    // Validation 3: Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(teacherRegForm.email)) {
      toast({
        title: "Error",
        description: "Please enter a valid email address.",
        variant: "destructive"
      });
      return;
    }

    // Validation 4: Phone number validation (exactly 10 digits)
    if (teacherRegForm.phone_no.length !== 10 || !/^\d{10}$/.test(teacherRegForm.phone_no)) {
      toast({
        title: "Error",
        description: "Phone number must be exactly 10 digits.",
        variant: "destructive"
      });
      return;
    }

    // Validation 5: Teacher ID minimum 3 characters
    if (teacherRegForm.teacherId.trim().length < 3) {
      toast({
        title: "Error",
        description: "Teacher ID must be at least 3 characters long.",
        variant: "destructive"
      });
      return;
    }

    // Validation 6: Password match
    if (teacherRegForm.password !== teacherRegForm.confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match.",
        variant: "destructive"
      });
      return;
    }

    // Validation 7: Password length
    if (teacherRegForm.password.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters long.",
        variant: "destructive"
      });
      return;
    }

    setRegistering(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token found');

      const response = await fetch(`${API_BASE_URL}/auth/register/teacher`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: teacherRegForm.name,
          teacherId: teacherRegForm.teacherId,
          email: teacherRegForm.email,
          phone_no: teacherRegForm.phone_no,
          password: teacherRegForm.password
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Success!",
          description: "Teacher account created successfully.",
        });
        setTeacherRegForm({
          name: "",
          teacherId: "",
          email: "",
          phone_no: "",
          password: "",
          confirmPassword: "",
          semesters: [],
          departments: [],
          sections: [],
          subjects: [],
          enrollmentYear: new Date().getFullYear().toString(),
          enrollmentMonth: "August"
        });
        fetchData();
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to create account. Please try again.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Registration error:', error);
      toast({
        title: "Error",
        description: "Network error. Please check your connection and try again.",
        variant: "destructive"
      });
    } finally {
      setRegistering(false);
    }
  };

  const handleAssignTeacherSubmit = async (e: React.FormEvent, forceAssign = false) => {
    e.preventDefault();

    // Clean up duplicates before validation
    const uniqueSubjects = Array.from(new Set(assignTeacherForm.subjects.filter(s => s && s.trim())));
    if (uniqueSubjects.length !== assignTeacherForm.subjects.length) {
      // Update form with cleaned subjects
      setAssignTeacherForm(prev => ({ ...prev, subjects: uniqueSubjects }));
    }

    // Validation 1: Check all required fields
    if (!assignTeacherForm.teacherId || assignTeacherForm.semesters.length === 0 || 
        assignTeacherForm.departments.length === 0 || assignTeacherForm.sections.length === 0 || 
        uniqueSubjects.length === 0) {
      toast({
        title: "Error",
        description: "Please select teacher ID, at least one semester, department, section, and subject.",
        variant: "destructive"
      });
      return;
    }

    // Validation 2: Teacher ID format (minimum 3 characters)
    const trimmedTeacherId = assignTeacherForm.teacherId.trim();
    if (trimmedTeacherId.length < 3) {
      toast({
        title: "Error",
        description: "Teacher ID must be at least 3 characters long.",
        variant: "destructive"
      });
      return;
    }

    // Validation 3: Validate that at least one subject is selected from every sem-dept-sec combination
    const missingCombinations = [];
    for (const semester of assignTeacherForm.semesters) {
      for (const dept of assignTeacherForm.departments) {
        for (const section of assignTeacherForm.sections) {
          const hasSubject = assignTeacherForm.subjects.some(s => {
            const [subSem, subDept, subSec] = s.split(':');
            return subSem === semester && subDept === dept && subSec === section;
          });
          if (!hasSubject) {
            const deptName = dept === "CS" ? "CSE" : "ISE";
            missingCombinations.push(`Semester ${semester} - ${deptName} - Section ${section}`);
          }
        }
      }
    }

    if (missingCombinations.length > 0) {
      toast({
        title: "Error",
        description: `Please select at least one subject for: ${missingCombinations.join(', ')}`,
        variant: "destructive"
      });
      return;
    }

    setRegistering(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token found');

      // Extract subject data with their combinations from "SEM:DEPT:SECTION:Subject" format
      // Use uniqueSubjects to ensure no duplicates are sent
      const subjectCombinations = uniqueSubjects.map(s => {
        const [semester, dept, section, subject] = s.split(':');
        return { semester, department: dept, section, subject };
      });

      const response = await fetch(`${API_BASE_URL}/teachers/assign-subjects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          teacherId: trimmedTeacherId,
          subjectCombinations: subjectCombinations,
          enrollmentDate: `${assignTeacherForm.enrollmentYear}-${assignTeacherForm.enrollmentMonth === "August" ? "08" : "02"}-01`,
          completionDate: assignTeacherEnrollmentInfo.completionDate,
          forceAssign: forceAssign
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Success!",
          description: data.hadConflicts 
            ? `Teacher subjects assigned successfully (${data.enrollmentCount} assignments, overriding conflicts).`
            : `Teacher subjects assigned successfully (${data.enrollmentCount} assignments).`,
        });
        setAssignTeacherForm({
          teacherId: "",
          semesters: [],
          departments: [],
          sections: [],
          subjects: [],
          enrollmentYear: new Date().getFullYear().toString(),
          enrollmentMonth: "August"
        });
        setConflictData(null);
        setPendingAssignment(null);
        fetchData();
      } else if (response.status === 409 && data.type === 'conflict' && data.requiresConfirmation) {
        // Show conflict warning dialog
        setConflictData(data);
        
        // Store the subject combinations for force assign
        const subjectCombinations = assignTeacherForm.subjects.map(s => {
          const [semester, dept, section, subject] = s.split(':');
          return { semester, department: dept, section, subject };
        });
        
        setPendingAssignment({
          teacherId: trimmedTeacherId,
          subjectCombinations: subjectCombinations,
          enrollmentDate: `${assignTeacherForm.enrollmentYear}-${assignTeacherForm.enrollmentMonth === "August" ? "08" : "02"}-01`,
          completionDate: assignTeacherEnrollmentInfo.completionDate
        });
        setShowConflictDialog(true);
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to assign subjects. Please try again.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Assignment error:', error);
      toast({
        title: "Error",
        description: "Network error. Please check your connection and try again.",
        variant: "destructive"
      });
    } finally {
      setRegistering(false);
    }
  };

  const handleForceAssign = async () => {
    setShowConflictDialog(false);
    setRegistering(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token found');

      const response = await fetch(`${API_BASE_URL}/teachers/assign-subjects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...pendingAssignment,
          forceAssign: true
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Success!",
          description: `Teacher subjects assigned successfully (${data.enrollmentCount} assignments, overriding conflicts).`,
        });
        setAssignTeacherForm({
          teacherId: "",
          semesters: [],
          departments: [],
          sections: [],
          subjects: [],
          enrollmentYear: new Date().getFullYear().toString(),
          enrollmentMonth: "August"
        });
        setConflictData(null);
        setPendingAssignment(null);
        fetchData();
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to assign subjects. Please try again.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Force assignment error:', error);
      toast({
        title: "Error",
        description: "Network error. Please check your connection and try again.",
        variant: "destructive"
      });
    } finally {
      setRegistering(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

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
      if (value.length > 100) {
        return value.substring(0, 100) + '...';
      }
      if (value.startsWith('[') && value.endsWith(']')) {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed) && parsed.length > 3) {
            return `[${parsed.slice(0, 3).join(', ')}...] (${parsed.length} items)`;
          }
        } catch (e) {
          // Not valid JSON
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-bold">Manage Teachers</h1>
        <p className="text-muted-foreground">View and register teachers</p>
      </div>

      {/* Main Content */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="teachers" className="data-[state=active]:bg-green-600 data-[state=active]:text-white">View Teachers</TabsTrigger>
          <TabsTrigger value="register">Register Teacher</TabsTrigger>
          <TabsTrigger value="assign">Assign Subjects to Teachers</TabsTrigger>
          <TabsTrigger value="edit">Edit Teacher</TabsTrigger>
        </TabsList>

        {/* Approved Teachers Tab */}
        <TabsContent value="teachers" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Teachers</CardTitle>
              <CardDescription>View all teacher information from database</CardDescription>
            </CardHeader>
            <CardContent>
              {!teachersTableData ? (
                <div className="text-center py-8">
                  <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground mb-4">Click to load teacher data</p>
                  <Button onClick={fetchTeachersTableData} disabled={teachersLoading}>
                    {teachersLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Load Teachers Data
                      </>
                    )}
                  </Button>
                </div>
              ) : teachersTableData.data.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">No teachers in database</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead className="sticky top-0 z-10 bg-muted/50">
                      <tr>
                        {teachersTableData.structure.map((col) => (
                          <th 
                            key={col.name} 
                            className="font-semibold whitespace-nowrap min-w-[120px] px-3 py-2 text-left border-r border-border/50 bg-muted/50 text-sm"
                          >
                            <div className="flex items-center gap-1">
                              {col.name}
                              {col.primaryKey && <Badge className="text-xs">PK</Badge>}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {teachersTableData.data.map((row, index) => (
                        <tr key={index} className="hover:bg-muted/50 border-b border-border/30">
                          {teachersTableData.structure.map((col) => (
                            <td 
                              key={col.name} 
                              className="font-mono text-xs whitespace-nowrap min-w-[120px] px-3 py-2 border-r border-border/50"
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
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="p-2 text-xs text-muted-foreground border-t bg-muted/20 mt-2">
                    📊 {teachersTableData.rowCount} rows × {teachersTableData.structure.length} columns
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Register Teacher Tab */}
        <TabsContent value="register" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Register New Teacher</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleTeacherRegSubmit} className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-foreground border-b pb-2">Personal Information</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="reg-name">Full Name <span className="text-red-500">*</span></Label>
                        <div className="relative">
                          <UserPlus className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="reg-name"
                            placeholder="Enter full name"
                            className="pl-9"
                            value={teacherRegForm.name}
                            onChange={(e) => setTeacherRegForm(prev => ({ ...prev, name: e.target.value }))}
                            disabled={registering}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">Minimum 3 characters</p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="reg-teacherId">Teacher ID <span className="text-red-500">*</span></Label>
                        <div className="relative">
                          <Hash className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="reg-teacherId"
                            placeholder="Enter unique teacher ID"
                            className="pl-9"
                            value={teacherRegForm.teacherId}
                            onChange={(e) => setTeacherRegForm(prev => ({ ...prev, teacherId: e.target.value }))}
                            disabled={registering}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">Minimum 3 characters</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="reg-email">Email <span className="text-red-500">*</span></Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="reg-email"
                            type="email"
                            placeholder="teacher@college.edu"
                            className="pl-9"
                            value={teacherRegForm.email}
                            onChange={(e) => setTeacherRegForm(prev => ({ ...prev, email: e.target.value }))}
                            disabled={registering}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">Valid email format required</p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="reg-phone">Phone Number <span className="text-red-500">*</span></Label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="reg-phone"
                            type="tel"
                            placeholder="9876543210"
                            maxLength={10}
                            className="pl-9"
                            value={teacherRegForm.phone_no}
                            onChange={(e) => setTeacherRegForm(prev => ({ ...prev, phone_no: e.target.value.replace(/\D/g, '') }))}
                            disabled={registering}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">Exactly 10 digits</p>
                      </div>
                    </div>

                    {/* Security Note - Above Password Fields */}
                    <div className="flex items-start gap-2 text-sm text-muted-foreground bg-amber-50 dark:bg-amber-900/20 p-3 rounded-md border border-amber-200 dark:border-amber-800">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                      <span className="text-amber-700 dark:text-amber-300 font-medium">
                        <strong>Note:</strong> This password should be entered by the teacher themselves for security purposes. Keep your password secure, do not share it with anyone, and do not forget it.
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="reg-password">Password <span className="text-red-500">*</span></Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="reg-password"
                            type={showPassword ? "text" : "password"}
                            placeholder="Create a strong password"
                            className="pl-9 pr-10"
                            value={teacherRegForm.password}
                            onChange={(e) => setTeacherRegForm(prev => ({ ...prev, password: e.target.value }))}
                            disabled={registering}
                          />
                          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="text-gray-400 hover:text-gray-600 focus:outline-none"
                              disabled={registering}
                            >
                              {showPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">Minimum 6 characters</p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="reg-confirmPassword">Confirm Password <span className="text-red-500">*</span></Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="reg-confirmPassword"
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder="Confirm your password"
                            className="pl-9 pr-10"
                            value={teacherRegForm.confirmPassword}
                            onChange={(e) => setTeacherRegForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                            disabled={registering}
                          />
                          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                            <button
                              type="button"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              className="text-gray-400 hover:text-gray-600 focus:outline-none"
                              disabled={registering}
                            >
                              {showConfirmPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">Must match password</p>
                      </div>
                    </div>

                    {/* Next Steps Note - At Bottom */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md border border-blue-200 dark:border-blue-800">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                          <strong>Note:</strong> Teachers must be registered before the start of the semester enrollment date. After registration, use "Assign Subjects to Teachers" tab to assign teaching duties.
                        </p>
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-6 border-t">
                      <Button 
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setTeacherRegForm({
                            name: "",
                            teacherId: "",
                            email: "",
                            phone_no: "",
                            password: "",
                            confirmPassword: "",
                            semesters: [],
                            departments: [],
                            sections: [],
                            subjects: [],
                            enrollmentYear: new Date().getFullYear().toString(),
                            enrollmentMonth: "August"
                          });
                          setShowPassword(false);
                          setShowConfirmPassword(false);
                        }}
                        disabled={registering}
                      >
                        Cancel
                      </Button>
                      <Button 
                        type="submit" 
                        disabled={registering}
                      >
                        {registering ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4 mr-2" />
                            Create Teacher Account
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Assign Subjects to Teachers Tab */}
        <TabsContent value="assign" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Assign Subjects to Teachers</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAssignTeacherSubmit} className="space-y-6">
                {/* Important Note - Above Teacher Information */}
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md border border-blue-200 dark:border-blue-800">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      <strong>Note:</strong> The teacher must be already registered and subjects must be assigned before the start of the semester enrollment date. Each teacher can only be assigned once for all their subjects during the current enrollment period.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-foreground border-b pb-2">Teacher Information</h3>
                  
                  <div className="space-y-2">
                    <Label htmlFor="assign-teacherId">Teacher ID <span className="text-red-500">*</span></Label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="assign-teacherId"
                        placeholder="Enter registered teacher ID"
                        className="pl-9"
                        value={assignTeacherForm.teacherId}
                        onChange={(e) => setAssignTeacherForm(prev => ({ ...prev, teacherId: e.target.value }))}
                        disabled={registering}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Minimum 3 characters</p>
                  </div>

                  {/* Enrollment Information */}
                  <div className="border-t pt-4 mt-4">
                    <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Enrollment Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="assign-enrollment-year" className="text-sm font-medium">Enrollment Year <span className="text-red-500">*</span></Label>
                        <Select onValueChange={v => setAssignTeacherForm(prev => ({ ...prev, enrollmentYear: v }))} value={assignTeacherForm.enrollmentYear}>
                          <SelectTrigger id="assign-enrollment-year" className="h-10">
                            <SelectValue placeholder="Select Year" />
                          </SelectTrigger>
                          <SelectContent>
                            {yearOptions.map(year => (
                              <SelectItem key={year} value={year}>{year}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="assign-enrollment-month" className="text-sm font-medium">Enrollment Month <span className="text-red-500">*</span></Label>
                        <Select onValueChange={v => setAssignTeacherForm(prev => ({ ...prev, enrollmentMonth: v }))} value={assignTeacherForm.enrollmentMonth}>
                          <SelectTrigger id="assign-enrollment-month" className="h-10">
                            <SelectValue placeholder="Select Month" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="August">August</SelectItem>
                            <SelectItem value="February">February</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2 mt-4">
                      <Label className="text-sm font-medium">Enrollment Date</Label>
                      <div className="h-10 px-3 py-2 rounded-md border border-input bg-muted flex items-center">
                        <span className="text-sm text-muted-foreground">{assignTeacherForm.enrollmentMonth} {assignTeacherForm.enrollmentYear}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Semester Type</Label>
                        <div className="h-10 px-3 py-2 rounded-md border border-input bg-muted flex items-center">
                          <span className="text-sm font-semibold text-primary">{assignTeacherEnrollmentInfo.semesterType}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Completion Date</Label>
                        <div className="h-10 px-3 py-2 rounded-md border border-input bg-muted flex items-center">
                          <span className="text-sm text-muted-foreground">{assignTeacherEnrollmentInfo.completionMonth} {assignTeacherEnrollmentInfo.completionYear}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Semester */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Label className="text-base font-semibold">Semesters</Label>
                      <span className="text-red-500 text-sm">*</span>
                      {assignTeacherForm.semesters.length === 0 && (
                        <div className="px-2 py-0.5 rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800">
                          <span className="text-xs font-medium text-red-700 dark:text-red-300">Required</span>
                        </div>
                      )}
                    </div>
                    <div className="bg-muted/30 p-4 rounded-lg border grid grid-cols-4 gap-4">
                      {SEMESTERS.map((sem) => (
                        <div key={sem} className="flex items-center space-x-2">
                          <Checkbox
                            id={`assign-sem-${sem}`}
                            checked={assignTeacherForm.semesters.includes(sem)}
                            onCheckedChange={() => handleAssignTeacherMultiSelect('semesters', sem)}
                          />
                          <Label htmlFor={`assign-sem-${sem}`} className="text-sm cursor-pointer">Sem {sem}</Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Departments */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Label className="text-base font-semibold">Departments</Label>
                      <span className="text-red-500 text-sm">*</span>
                      {assignTeacherForm.departments.length === 0 && (
                        <div className="px-2 py-0.5 rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800">
                          <span className="text-xs font-medium text-red-700 dark:text-red-300">Required</span>
                        </div>
                      )}
                    </div>
                    <div className="bg-muted/30 p-4 rounded-lg border space-y-2">
                      {DEPARTMENTS.map((dept) => (
                        <div key={dept} className="flex items-center space-x-2">
                          <Checkbox
                            id={`assign-dept-${dept}`}
                            checked={assignTeacherForm.departments.includes(dept)}
                            onCheckedChange={() => handleAssignTeacherMultiSelect('departments', dept)}
                          />
                          <Label htmlFor={`assign-dept-${dept}`} className="text-sm cursor-pointer font-medium">
                            {dept === "CS" ? "Computer Science (CSE)" : "Information Science (ISE)"}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Sections */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Label className="text-base font-semibold">Sections</Label>
                      <span className="text-red-500 text-sm">*</span>
                      {assignTeacherForm.sections.length === 0 && (
                        <div className="px-2 py-0.5 rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800">
                          <span className="text-xs font-medium text-red-700 dark:text-red-300">Required</span>
                        </div>
                      )}
                    </div>
                    <div className="bg-muted/30 p-4 rounded-lg border grid grid-cols-4 gap-4">
                      {SECTIONS.map((sec) => (
                        <div key={sec} className="flex items-center space-x-2">
                          <Checkbox
                            id={`assign-section-${sec}`}
                            checked={assignTeacherForm.sections.includes(sec)}
                            onCheckedChange={() => handleAssignTeacherMultiSelect('sections', sec)}
                          />
                          <Label htmlFor={`assign-section-${sec}`} className="text-sm cursor-pointer">Section {sec}</Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Subjects */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Label className="text-base font-semibold">Subjects</Label>
                      <span className="text-red-500 text-sm">*</span>
                      <span className="text-xs font-normal text-muted-foreground">(Select at least one from each combination)</span>
                      {(() => {
                        // Check if at least one subject is selected for EVERY combination
                        let allCombinationsValid = true;
                        let totalCombinations = 0;
                        let validCombinations = 0;

                        if (assignTeacherForm.semesters.length > 0 && assignTeacherForm.departments.length > 0 && assignTeacherForm.sections.length > 0) {
                          for (const semester of assignTeacherForm.semesters) {
                            for (const dept of assignTeacherForm.departments) {
                              for (const section of assignTeacherForm.sections) {
                                totalCombinations++;
                                const hasSubject = assignTeacherForm.subjects.some(s => {
                                  const [subSem, subDept, subSec] = s.split(':');
                                  return subSem === semester && subDept === dept && subSec === section;
                                });
                                if (hasSubject) {
                                  validCombinations++;
                                } else {
                                  allCombinationsValid = false;
                                }
                              }
                            }
                          }
                        }

                        if (assignTeacherForm.subjects.length === 0) {
                          return (
                            <div className="px-2 py-0.5 rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800">
                              <span className="text-xs font-medium text-red-700 dark:text-red-300">Required</span>
                            </div>
                          );
                        } else if (!allCombinationsValid) {
                          return (
                            <div className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
                              <span className="text-xs font-medium text-amber-700 dark:text-amber-300">{validCombinations}/{totalCombinations}</span>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    {assignTeacherForm.semesters.length === 0 || assignTeacherForm.departments.length === 0 || assignTeacherForm.sections.length === 0 ? (
                      <div className="bg-muted/30 p-4 rounded-lg border text-sm text-muted-foreground">
                        Please select at least one semester, department, and section first
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Disclaimer - Shows before any subject is selected */}
                        {assignTeacherForm.subjects.length === 0 && (
                          <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex items-start gap-3">
                            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                            <div className="space-y-1">
                              <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                                Important: Subject Selection Required
                              </p>
                              <p className="text-xs text-amber-700 dark:text-amber-300">
                                You must select at least one subject for each Semester-Department-Section combination below. 
                                The form will validate this before submission.
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Success indicator - Shows after ALL combinations are complete */}
                        {(() => {
                          let allCombinationsValid = true;
                          let totalCombinations = 0;

                          for (const semester of assignTeacherForm.semesters) {
                            for (const dept of assignTeacherForm.departments) {
                              for (const section of assignTeacherForm.sections) {
                                totalCombinations++;
                                const hasSubject = assignTeacherForm.subjects.some(s => {
                                  const [subSem, subDept, subSec] = s.split(':');
                                  return subSem === semester && subDept === dept && subSec === section;
                                });
                                if (!hasSubject) {
                                  allCombinationsValid = false;
                                }
                              }
                            }
                          }

                          return allCombinationsValid && assignTeacherForm.subjects.length > 0 && (
                            <div className="bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 flex items-center gap-3">
                              <div className="h-5 w-5 rounded-full bg-emerald-600 flex items-center justify-center flex-shrink-0">
                                <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                                  All {totalCombinations} combinations complete ({assignTeacherForm.subjects.length} subject{assignTeacherForm.subjects.length > 1 ? 's' : ''} selected)
                                </p>
                              </div>
                            </div>
                          );
                        })()}

                        <div className="bg-muted/30 p-4 rounded-lg border space-y-6">
                          {Object.entries(filteredAssignTeacherSubjects).map(([semester, deptSubjects]) => (
                            <div key={semester} className="space-y-4">
                              <div className="flex items-center gap-3">
                                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent"></div>
                                <h3 className="text-sm font-bold text-primary px-3 py-1 bg-primary/5 rounded-md border border-primary/20">
                                  Semester {semester}
                                </h3>
                                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent"></div>
                              </div>
                              
                              {Object.entries(deptSubjects).map(([dept, subjects], deptIndex) => (
                                <div key={`${semester}-${dept}`} className="space-y-4">
                                  {deptIndex > 0 && (
                                    <div className="relative py-2">
                                      <div className="absolute inset-0 flex items-center">
                                        <div className="w-full border-t-2 border-dashed border-border/40"></div>
                                      </div>
                                    </div>
                                  )}
                                  
                                  <div className="flex items-center gap-2 pl-2">
                                    <div className="h-5 w-0.5 bg-primary/60 rounded-full"></div>
                                    <h4 className="text-sm font-semibold text-foreground">
                                      {dept === "CS" ? "CSE" : "ISE"}
                                    </h4>
                                  </div>
                                  
                                  {assignTeacherForm.sections.map((section, sectionIndex) => {
                                    // Check if subjects are selected for THIS specific semester-dept-section combination
                                    const sectionSubjects = assignTeacherForm.subjects.filter(s => {
                                      const parts = s.split(':');
                                      if (parts.length < 4) return false;
                                      const [subSem, subDept, subSec] = parts;
                                      return subSem === semester && subDept === dept && subSec === section;
                                    });
                                    const hasSelection = sectionSubjects.length > 0;
                                    
                                    return (
                                      <div key={`${semester}-${dept}-${section}`}>
                                        <div className="space-y-2 pl-6">
                                          <div className="flex items-center gap-2 py-1.5">
                                            <div className="flex items-center gap-2 flex-1">
                                              <div className="h-1.5 w-1.5 rounded-full bg-primary"></div>
                                              <h5 className="text-sm font-semibold text-foreground">
                                                Section {section}
                                              </h5>
                                              {!hasSelection && (
                                                <div className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
                                                  <span className="text-xs font-medium text-amber-700 dark:text-amber-300">Required</span>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-4">
                                            {subjects.map((subject) => {
                                              const subjectKey = `${semester}:${dept}:${section}:${subject}`;
                                              return (
                                                <div key={subjectKey} className="flex items-center space-x-2">
                                                  <Checkbox
                                                    id={`assign-subject-${semester}-${dept}-${section}-${subject}`}
                                                    checked={assignTeacherForm.subjects.includes(subjectKey)}
                                                    onCheckedChange={() => handleAssignTeacherMultiSelect('subjects', subjectKey)}
                                                  />
                                                  <Label htmlFor={`assign-subject-${semester}-${dept}-${section}-${subject}`} className="text-sm cursor-pointer">{subject}</Label>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                        {/* Elegant separator between sections */}
                                        {sectionIndex < assignTeacherForm.sections.length - 1 && (
                                          <div className="my-3 pl-6">
                                            <div className="h-px bg-gradient-to-r from-border/50 via-border/30 to-transparent"></div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>

                        {/* Summary Box - Shows all selected subjects */}
                        {assignTeacherForm.subjects.length > 0 && (
                          <div className="mt-6 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3 pb-2 border-b border-blue-200 dark:border-blue-900">
                              <span className="text-sm font-semibold text-blue-900 dark:text-blue-100">Selected Subjects</span>
                              <Badge className="bg-blue-600 hover:bg-blue-600">{assignTeacherForm.subjects.length} Total</Badge>
                            </div>

                            <div className="space-y-3 text-sm">
                              {assignTeacherForm.semesters.map((semester) => {
                                const semesterSubjects = assignTeacherForm.subjects.filter(s => s.split(':')[0] === semester);
                                if (semesterSubjects.length === 0) return null;

                                return (
                                  <div key={`summary-${semester}`}>
                                    <div className="font-semibold text-blue-700 dark:text-blue-400 mb-2">Semester {semester}</div>
                                    
                                    {assignTeacherForm.departments.map((dept) => {
                                      const deptSubjects = semesterSubjects.filter(s => s.split(':')[1] === dept);
                                      if (deptSubjects.length === 0) return null;

                                      return (
                                        <div key={`summary-${semester}-${dept}`} className="ml-3 mb-2">
                                          <div className="font-medium text-blue-800 dark:text-blue-300 mb-1">{dept === "CS" ? "CSE" : "ISE"}</div>
                                          
                                          {assignTeacherForm.sections.map((section) => {
                                            const sectionSubjects = deptSubjects.filter(s => s.split(':')[2] === section);
                                            if (sectionSubjects.length === 0) return null;

                                            return (
                                              <div key={`summary-${semester}-${dept}-${section}`} className="ml-3 mb-1.5 flex gap-2">
                                                <span className="text-blue-600 dark:text-blue-400 min-w-[60px]">Sec {section}:</span>
                                                <div className="flex flex-wrap gap-1.5">
                                                  {sectionSubjects.map((subKey) => {
                                                    const subjectName = subKey.split(':')[3];
                                                    return (
                                                      <span key={subKey} className="px-2 py-0.5 bg-white dark:bg-blue-950 border border-blue-300 dark:border-blue-800 rounded text-xs text-blue-900 dark:text-blue-100">
                                                        {subjectName}
                                                      </span>
                                                    );
                                                  })}
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-3 pt-6 border-t">
                    <Button 
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setAssignTeacherForm({
                          teacherId: "",
                          semesters: [],
                          departments: [],
                          sections: [],
                          subjects: [],
                          enrollmentYear: new Date().getFullYear().toString(),
                          enrollmentMonth: "August"
                        });
                      }}
                      disabled={registering}
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={registering}
                    >
                      {registering ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Assigning...
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-2" />
                          Assign Subjects to Teacher
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Edit Teacher Tab */}
        <TabsContent value="edit" className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Edit Teacher Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Informational Note at Top */}
            <div className="mb-6 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                    How to Edit Teacher Information
                  </p>
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    Enter the teacher's ID and click "Fetch Details" to load their current information. You can then update their personal details or change their password. All changes are saved to the database and will be reflected immediately.
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleEditTeacherSubmit} className="space-y-6">
              {/* Fetch Teacher Section */}
              <div className="space-y-4 pb-6 border-b">
                <div className="space-y-2">
                  <Label htmlFor="edit-teacher-id" className="flex items-center gap-2">
                    Teacher ID
                  </Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Hash className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="edit-teacher-id"
                        placeholder="Enter registered teacher ID"
                        className="pl-9"
                        value={editTeacherForm.teacherId}
                        onChange={(e) => {
                          setEditTeacherForm({ ...editTeacherForm, teacherId: e.target.value });
                          setTeacherFetched(false);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (editTeacherForm.teacherId.trim()) {
                              fetchTeacherDetails();
                            }
                          }
                        }}
                        disabled={fetchingTeacher || teacherFetched}
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={fetchTeacherDetails}
                      disabled={fetchingTeacher || !editTeacherForm.teacherId.trim()}
                    >
                      {fetchingTeacher ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Fetching...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Fetch Details
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Teacher Info Display - Only show after fetching */}
              {teacherFetched && (
                <>
                  {/* Current Teacher Information (Read-only) */}
                  <div className="space-y-4 pb-6 border-b">
                    <h3 className="text-lg font-semibold text-foreground">Current Teacher Information</h3>
                    <div className="bg-muted/30 p-4 rounded-lg border space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Teacher ID</Label>
                          <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md border">
                            <Hash className="h-4 w-4 text-muted-foreground" />
                            <span className="font-mono font-semibold">{editTeacherData.teacherId}</span>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Full Name</Label>
                          <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md border">
                            <UserPlus className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{editTeacherData.name}</span>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Email</Label>
                          <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md border">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{editTeacherData.email}</span>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Phone Number</Label>
                          <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md border">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{editTeacherData.phone_no || 'Not provided'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Edit Form */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-foreground">Update Information</h3>
                    
                    <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg p-3">
                      <p className="text-sm text-blue-900 dark:text-blue-100">
                        <strong>Note:</strong> Teacher ID cannot be changed. Modify the fields below to update teacher information.
                      </p>
                    </div>

                    {/* Name */}
                    <div className="space-y-2">
                      <Label htmlFor="edit-name">Full Name <span className="text-red-500">*</span></Label>
                      <div className="relative">
                        <UserPlus className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="edit-name"
                          placeholder="Enter full name"
                          className="pl-9"
                          value={editTeacherForm.name}
                          onChange={(e) => setEditTeacherForm({ ...editTeacherForm, name: e.target.value })}
                          required
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">Minimum 3 characters</p>
                    </div>

                    {/* Email */}
                    <div className="space-y-2">
                      <Label htmlFor="edit-email">Email <span className="text-red-500">*</span></Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="edit-email"
                          type="email"
                          placeholder="teacher@college.edu"
                          className="pl-9"
                          value={editTeacherForm.email}
                          onChange={(e) => setEditTeacherForm({ ...editTeacherForm, email: e.target.value })}
                          required
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">Valid email format required</p>
                    </div>

                    {/* Phone Number */}
                    <div className="space-y-2">
                      <Label htmlFor="edit-phone">Phone Number <span className="text-red-500">*</span></Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="edit-phone"
                          type="tel"
                          placeholder="9876543210"
                          maxLength={10}
                          className="pl-9"
                          value={editTeacherForm.phone_no}
                          onChange={(e) => setEditTeacherForm({ ...editTeacherForm, phone_no: e.target.value.replace(/\D/g, '') })}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">Exactly 10 digits</p>
                    </div>

                    {/* Security Note - Above Password Fields */}
                    <div className="flex items-start gap-2 text-sm text-muted-foreground bg-amber-50 dark:bg-amber-900/20 p-3 rounded-md border border-amber-200 dark:border-amber-800">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                      <span className="text-amber-700 dark:text-amber-300 font-medium">
                        <strong>Note:</strong> This password should be entered by the teacher themselves for security purposes. Keep your password secure, do not share it with anyone, and do not forget it.
                      </span>
                    </div>

                    {/* Password */}
                    <div className="space-y-2">
                      <Label htmlFor="edit-password">New Password (Optional)</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="edit-password"
                          type={showEditPassword ? "text" : "password"}
                          placeholder="Leave blank to keep current password"
                          className="pl-9 pr-10"
                          value={editTeacherForm.password}
                          onChange={(e) => setEditTeacherForm({ ...editTeacherForm, password: e.target.value })}
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                          <button
                            type="button"
                            onClick={() => setShowEditPassword(!showEditPassword)}
                            className="text-gray-400 hover:text-gray-600 focus:outline-none"
                          >
                            {showEditPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">Minimum 6 characters. Leave blank to keep current password.</p>
                    </div>

                    {/* Confirm Password */}
                    <div className="space-y-2">
                      <Label htmlFor="edit-confirm-password">Confirm New Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="edit-confirm-password"
                          type={showEditConfirmPassword ? "text" : "password"}
                          placeholder="Re-enter new password"
                          className="pl-9 pr-10"
                          value={editTeacherForm.confirmPassword}
                          onChange={(e) => setEditTeacherForm({ ...editTeacherForm, confirmPassword: e.target.value })}
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                          <button
                            type="button"
                            onClick={() => setShowEditConfirmPassword(!showEditConfirmPassword)}
                            className="text-gray-400 hover:text-gray-600 focus:outline-none"
                          >
                            {showEditConfirmPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">Must match password</p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-end gap-3 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setEditTeacherForm({
                            teacherId: '',
                            name: '',
                            email: '',
                            phone_no: '',
                            password: '',
                            confirmPassword: ''
                          });
                          setEditTeacherData(null);
                          setTeacherFetched(false);
                          setShowEditPassword(false);
                          setShowEditConfirmPassword(false);
                        }}
                        disabled={updatingTeacher}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={updatingTeacher}
                      >
                        {updatingTeacher ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Updating...
                          </>
                        ) : (
                          "Update Teacher Details"
                        )}
                      </Button>
                    </div>
                  </div>
                </>
              )}

              {/* Show message if not fetched yet */}
              {!teacherFetched && !fetchingTeacher && (
                <div className="text-center py-8 text-muted-foreground">
                  <UserPlus className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Enter a Teacher ID and click "Fetch Details" to start editing</p>
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      </TabsContent>
      </Tabs>

      {/* Conflict Warning Dialog */}
      <AlertDialog open={showConflictDialog} onOpenChange={setShowConflictDialog}>
        <AlertDialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-orange-600">
              <AlertCircle className="h-5 w-5" />
              Subject Assignment Conflict Detected
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              The following subjects are already assigned to other teachers. Proceeding will create duplicate assignments for the same class.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          {conflictData && conflictData.conflicts && (
            <div className="space-y-3 my-4">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 space-y-3">
                {conflictData.conflicts.map((conflict: any, index: number) => (
                  <div key={index} className="flex items-start gap-3 pb-3 border-b border-orange-200 last:border-0 last:pb-0">
                    <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 space-y-1">
                      <div className="font-semibold text-sm text-orange-900">
                        {conflict.subject}
                      </div>
                      <div className="text-sm text-orange-700">
                        Semester {conflict.semester} • {conflict.department === "CS" ? "CSE" : "ISE"} • Section {conflict.section}
                      </div>
                      <div className="text-xs text-orange-600 bg-orange-100 inline-block px-2 py-1 rounded mt-1">
                        Currently assigned to: <span className="font-semibold">{conflict.existingTeacherId}</span> ({conflict.existingTeacherName})
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-900">
                  <strong>Note:</strong> Multiple teachers can be assigned to the same subject (useful for team teaching or lab sessions). Teachers can share the same account if needed. However, only one teacher can take attendance at a time. This may cause confusion in attendance tracking and scheduling.
                </p>
              </div>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowConflictDialog(false);
              setConflictData(null);
              setPendingAssignment(null);
            }}>
              Cancel Assignment
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleForceAssign}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Proceed Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}