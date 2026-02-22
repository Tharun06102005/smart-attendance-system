import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Webcam from "react-webcam";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, RefreshCw, Camera, Save, Trash2, AlertCircle, Eye, EyeOff, Info, Calendar, UserPlus, User, Hash, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL, SEMESTERS, DEPARTMENTS, SECTIONS, getSubjectsByDepartments } from "@/lib/constants";
import { cn } from "@/lib/utils";

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

interface StudentRegForm {
  name: string;
  usn: string;
  department: string;
  semester: string;
  subjects: string[];
  password: string;
  confirmPassword: string;
  email: string;
  phone_no: string;
}

export default function ManageStudents() {
  const [studentsTableData, setStudentsTableData] = useState<TableData | null>(null);
  const [loading, setLoading] = useState(false);
  const [studentRegistering, setStudentRegistering] = useState(false);
  const [checkingStudent, setCheckingStudent] = useState(false);
  const [studentVerified, setStudentVerified] = useState(false);
  const { toast } = useToast();

  // Student registration form state
  const [studentRegForm, setStudentRegForm] = useState<StudentRegForm>({
    name: "",
    usn: "",
    department: "",
    semester: "",
    subjects: [],
    password: "",
    confirmPassword: "",
    email: "",
    phone_no: ""
  });

  // Form state for assigning students to semester
  const [assignStudentForm, setAssignStudentForm] = useState({
    usn: "",
    sectionId: "",
    semester: "",
    department: "",
    subjects: [] as string[],
    enrollmentYear: new Date().getFullYear().toString(),
    enrollmentMonth: "August"
  });

  // Edit student state
  const [editStudentUSN, setEditStudentUSN] = useState("");
  const [editStudentData, setEditStudentData] = useState<any>(null); // Original data from database
  const [editStudentFormData, setEditStudentFormData] = useState<any>(null); // Form data being edited
  const [searchingStudent, setSearchingStudent] = useState(false);
  const [updatingStudent, setUpdatingStudent] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [showEditConfirmPassword, setShowEditConfirmPassword] = useState(false);
  const [editCapturedImages, setEditCapturedImages] = useState<string[]>([]);
  const [editOriginalImages, setEditOriginalImages] = useState<string[]>([]);
  const [editImageSizes, setEditImageSizes] = useState<number[]>([]);
  const [editEnhancementModes, setEditEnhancementModes] = useState<number[]>([]);
  const [isEditCameraOpen, setIsEditCameraOpen] = useState(false);
  const [updatingImage, setUpdatingImage] = useState(false);
  const editWebcamRef = useRef<Webcam>(null);

  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [originalImages, setOriginalImages] = useState<string[]>([]);
  const [imageSizes, setImageSizes] = useState<number[]>([]);
  const [enhancementModes, setEnhancementModes] = useState<number[]>([]);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [showStudentPassword, setShowStudentPassword] = useState(false);
  const [showStudentConfirmPassword, setShowStudentConfirmPassword] = useState(false);
  const webcamRef = useRef<Webcam>(null);

  // Get subjects based on selected semester and department
  const filteredSubjects = useMemo(() => {
    if (!studentRegForm.semester || !studentRegForm.department) {
      return [];
    }
    const subjectsByDept = getSubjectsByDepartments(studentRegForm.semester, [studentRegForm.department]);
    return subjectsByDept[studentRegForm.department] || [];
  }, [studentRegForm.semester, studentRegForm.department]);

  // Auto-populate subjects when semester/department changes
  const autoSelectedSubjects = useMemo(() => {
    return filteredSubjects;
  }, [filteredSubjects]);

  // Get subjects based on selected semester and department for assign student form
  const filteredAssignStudentSubjects = useMemo(() => {
    if (!assignStudentForm.semester || !assignStudentForm.department) {
      return [];
    }
    const subjectsByDept = getSubjectsByDepartments(assignStudentForm.semester, [assignStudentForm.department]);
    return subjectsByDept[assignStudentForm.department] || [];
  }, [assignStudentForm.semester, assignStudentForm.department]);

  // Auto-populate subjects for assign student form
  const autoAssignedStudentSubjects = useMemo(() => {
    return filteredAssignStudentSubjects;
  }, [filteredAssignStudentSubjects]);

  // Calculate semester type and completion date for assign student form
  const assignStudentEnrollmentInfo = useMemo(() => {
    const semesterType = assignStudentForm.enrollmentMonth === "August" ? "Odd" : "Even";
    const completionMonth = assignStudentForm.enrollmentMonth === "August" ? "December" : "June";
    const completionYear = assignStudentForm.enrollmentYear;
    
    // Create completion date in YYYY-MM-DD format (direct string, no Date object)
    // August enrollment → December 31st
    // February enrollment → June 30th
    const completionDate = assignStudentForm.enrollmentMonth === "August" 
      ? `${completionYear}-12-31`
      : `${completionYear}-06-30`;
    
    return {
      semesterType,
      completionMonth,
      completionYear,
      completionDate
    };
  }, [assignStudentForm.enrollmentMonth, assignStudentForm.enrollmentYear]);

  // Generate year options (present -1 year to future +6 years)
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = currentYear - 1; i <= currentYear + 6; i++) {
      years.push(i.toString());
    }
    return years;
  }, []);

  const fetchStudentsTableData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token found');

      const response = await fetch(`${API_BASE_URL}/dbms-values/table/students`, {
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
        setStudentsTableData(data);
      } else {
        throw new Error(data.message || 'Failed to fetch students table');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Check if student exists and fetch department
  const handleCheckStudent = async () => {
    if (!assignStudentForm.usn.trim()) {
      toast({ title: "Error", description: "Please enter Student ID", variant: "destructive" });
      return;
    }

    setCheckingStudent(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast({ title: "Authentication Error", description: "Please login again.", variant: "destructive" });
        return;
      }

      const response = await fetch(`${API_BASE_URL}/students/get-by-usn/${assignStudentForm.usn}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (response.ok && data.student) {
        setAssignStudentForm(prev => ({ ...prev, department: data.student.department }));
        setStudentVerified(true);
        toast({
          title: "Success",
          description: `Student found. Department: ${data.student.department}`,
          className: "bg-success text-success-foreground"
        });
      } else {
        setStudentVerified(false);
        setAssignStudentForm(prev => ({ ...prev, department: "" }));
        toast({
          title: "Not Found",
          description: "Student ID not present in the student table",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error checking student:', error);
      setStudentVerified(false);
      setAssignStudentForm(prev => ({ ...prev, department: "" }));
      toast({
        title: "Error",
        description: "Failed to check student",
        variant: "destructive"
      });
    } finally {
      setCheckingStudent(false);
    }
  };

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      // Always replace with the new image (limit to 1)
      setCapturedImages([imageSrc]);
    }
  }, [webcamRef]);

  const removeImage = (index: number) => {
    setCapturedImages(prev => prev.filter((_, i) => i !== index));
    setOriginalImages(prev => prev.filter((_, i) => i !== index));
    setImageSizes(prev => prev.filter((_, i) => i !== index));
    setEnhancementModes(prev => prev.filter((_, i) => i !== index));
  };

  // Edit mode capture functions
  const editCapture = useCallback(() => {
    const imageSrc = editWebcamRef.current?.getScreenshot();
    if (imageSrc) {
      // Always replace with the new image (limit to 1)
      setEditCapturedImages([imageSrc]);
    }
  }, [editWebcamRef]);

  const removeEditImage = (index: number) => {
    setEditCapturedImages(prev => prev.filter((_, i) => i !== index));
    setEditOriginalImages(prev => prev.filter((_, i) => i !== index));
    setEditImageSizes(prev => prev.filter((_, i) => i !== index));
    setEditEnhancementModes(prev => prev.filter((_, i) => i !== index));
  };

  // ========== IMAGE ENHANCEMENT FUNCTIONS (copied from TakeAttendance) ==========
  
  // Helper to get image size
  const getImageSize = (base64: string): number => {
    const base64Length = base64.length - (base64.indexOf(',') + 1);
    const padding = (base64.charAt(base64.length - 2) === '=' ? 2 : (base64.charAt(base64.length - 1) === '=' ? 1 : 0));
    return (base64Length * 0.75) - padding;
  };

  // Helper to detect skin tone
  const detectSkinTone = (r: number, g: number, b: number): boolean => {
    const rgbCondition = (r > 60 && g > 30 && b > 15 && r > g && r > b && (r - g) > 10 && (r - b) > 10);
    const sum = r + g + b;
    if (sum === 0) return false;
    const rNorm = r / sum;
    const gNorm = g / sum;
    const normalizedCondition = (rNorm > 0.33 && rNorm < 0.50 && gNorm > 0.25 && gNorm < 0.40);
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
    const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
    const ycbcrCondition = (y > 40 && cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173);
    return rgbCondition || normalizedCondition || ycbcrCondition;
  };

  // Mode 1: Balanced Enhancement
  const applyBalancedEnhancement = (imageData: ImageData, width: number, height: number): ImageData => {
    const output = new ImageData(width, height);
    for (let i = 0; i < imageData.data.length; i += 4) {
      let r = imageData.data[i] + 15;
      let g = imageData.data[i + 1] + 15;
      let b = imageData.data[i + 2] + 15;
      r = (r - 128) * 1.1 + 128;
      g = (g - 128) * 1.1 + 128;
      b = (b - 128) * 1.1 + 128;
      output.data[i] = Math.min(255, Math.max(0, r));
      output.data[i + 1] = Math.min(255, Math.max(0, g));
      output.data[i + 2] = Math.min(255, Math.max(0, b));
      output.data[i + 3] = imageData.data[i + 3];
    }
    return output;
  };

  // Mode 2: Low Light Boost
  const applyLowLightBoost = (imageData: ImageData, width: number, height: number): ImageData => {
    const output = new ImageData(width, height);
    for (let i = 0; i < imageData.data.length; i += 4) {
      let r = imageData.data[i] * 2.5 + 50;
      let g = imageData.data[i + 1] * 2.5 + 50;
      let b = imageData.data[i + 2] * 2.5 + 50;
      output.data[i] = Math.min(255, Math.max(0, r));
      output.data[i + 1] = Math.min(255, Math.max(0, g));
      output.data[i + 2] = Math.min(255, Math.max(0, b));
      output.data[i + 3] = imageData.data[i + 3];
    }
    return output;
  };

  // Mode 3: Warm & Natural
  const applyClaritySharpness = (imageData: ImageData, width: number, height: number): ImageData => {
    const output = new ImageData(width, height);
    for (let i = 0; i < imageData.data.length; i += 4) {
      let r = (imageData.data[i] + 20) * 1.08;
      let g = (imageData.data[i + 1] + 20) * 1.04;
      let b = (imageData.data[i + 2] + 20) * 0.92;
      r = (r - 128) * 1.12 + 128;
      g = (g - 128) * 1.12 + 128;
      b = (b - 128) * 1.12 + 128;
      output.data[i] = Math.min(255, Math.max(0, r));
      output.data[i + 1] = Math.min(255, Math.max(0, g));
      output.data[i + 2] = Math.min(255, Math.max(0, b));
      output.data[i + 3] = imageData.data[i + 3];
    }
    return output;
  };

  // Mode 4: Color & Vibrance
  const applyColorVibrance = (imageData: ImageData, width: number, height: number): ImageData => {
    const output = new ImageData(width, height);
    for (let i = 0; i < imageData.data.length; i += 4) {
      let r = imageData.data[i] - 8;
      let g = imageData.data[i + 1] - 8;
      let b = imageData.data[i + 2] - 8;
      r = (r - 128) * 1.12 + 128;
      g = (g - 128) * 1.12 + 128;
      b = (b - 128) * 1.12 + 128;
      const avg = (r + g + b) / 3;
      r = avg + (r - avg) * 1.3;
      g = avg + (g - avg) * 1.3;
      b = avg + (b - avg) * 1.3;
      output.data[i] = Math.min(255, Math.max(0, r));
      output.data[i + 1] = Math.min(255, Math.max(0, g));
      output.data[i + 2] = Math.min(255, Math.max(0, b));
      output.data[i + 3] = imageData.data[i + 3];
    }
    return output;
  };

  // Apply enhancement to image
  const applyEnhancement = (base64Image: string, mode: number): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(base64Image);
        
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        let enhanced;
        if (mode === 0) enhanced = applyBalancedEnhancement(imageData, canvas.width, canvas.height);
        else if (mode === 1) enhanced = applyLowLightBoost(imageData, canvas.width, canvas.height);
        else if (mode === 2) enhanced = applyClaritySharpness(imageData, canvas.width, canvas.height);
        else enhanced = applyColorVibrance(imageData, canvas.width, canvas.height);
        
        ctx.putImageData(enhanced, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.95));
      };
      img.src = base64Image;
    });
  };

  // Handle enhance for Register Student gallery
  const handleEnhanceImage = async (index: number) => {
    const currentMode = enhancementModes[index] ?? -1;
    const nextMode = (currentMode + 1) % 4;
    const modeNames = ['✨ Balanced', '🌙 Low Light', '🔥 Warm & Natural', '🎨 Vibrant'];
    
    const originalImage = originalImages[index] || capturedImages[index];
    const enhanced = await applyEnhancement(originalImage, nextMode);
    
    setCapturedImages(prev => {
      const newImages = [...prev];
      newImages[index] = enhanced;
      return newImages;
    });
    
    if (!originalImages[index]) {
      setOriginalImages(prev => {
        const newOriginals = [...prev];
        newOriginals[index] = capturedImages[index];
        return newOriginals;
      });
    }
    
    setImageSizes(prev => {
      const newSizes = [...prev];
      newSizes[index] = getImageSize(enhanced);
      return newSizes;
    });
    
    setEnhancementModes(prev => {
      const newModes = [...prev];
      newModes[index] = nextMode;
      return newModes;
    });
    
    toast({
      title: `${modeNames[nextMode]} Applied`,
      description: `Mode ${nextMode + 1} of 4`
    });
  };

  // Handle reset for Register Student gallery
  const handleResetImage = (index: number) => {
    if (originalImages[index]) {
      setCapturedImages(prev => {
        const newImages = [...prev];
        newImages[index] = originalImages[index];
        return newImages;
      });
      setImageSizes(prev => {
        const newSizes = [...prev];
        newSizes[index] = getImageSize(originalImages[index]);
        return newSizes;
      });
      setEnhancementModes(prev => {
        const newModes = [...prev];
        newModes[index] = -1;
        return newModes;
      });
      toast({ title: "Image Reset", description: "Restored to original" });
    }
  };

  // Handle enhance for Edit Student gallery
  const handleEditEnhanceImage = async (index: number) => {
    const currentMode = editEnhancementModes[index] ?? -1;
    const nextMode = (currentMode + 1) % 4;
    const modeNames = ['✨ Balanced', '🌙 Low Light', '🔥 Warm & Natural', '🎨 Vibrant'];
    
    const originalImage = editOriginalImages[index] || editCapturedImages[index];
    const enhanced = await applyEnhancement(originalImage, nextMode);
    
    setEditCapturedImages(prev => {
      const newImages = [...prev];
      newImages[index] = enhanced;
      return newImages;
    });
    
    if (!editOriginalImages[index]) {
      setEditOriginalImages(prev => {
        const newOriginals = [...prev];
        newOriginals[index] = editCapturedImages[index];
        return newOriginals;
      });
    }
    
    setEditImageSizes(prev => {
      const newSizes = [...prev];
      newSizes[index] = getImageSize(enhanced);
      return newSizes;
    });
    
    setEditEnhancementModes(prev => {
      const newModes = [...prev];
      newModes[index] = nextMode;
      return newModes;
    });
    
    toast({
      title: `${modeNames[nextMode]} Applied`,
      description: `Mode ${nextMode + 1} of 4`
    });
  };

  // Handle reset for Edit Student gallery
  const handleEditResetImage = (index: number) => {
    if (editOriginalImages[index]) {
      setEditCapturedImages(prev => {
        const newImages = [...prev];
        newImages[index] = editOriginalImages[index];
        return newImages;
      });
      setEditImageSizes(prev => {
        const newSizes = [...prev];
        newSizes[index] = getImageSize(editOriginalImages[index]);
        return newSizes;
      });
      setEditEnhancementModes(prev => {
        const newModes = [...prev];
        newModes[index] = -1;
        return newModes;
      });
      toast({ title: "Image Reset", description: "Restored to original" });
    }
  };

  // ========== END OF ENHANCEMENT FUNCTIONS ==========

  // Handle image update
  const handleUpdateImage = async () => {
    if (editCapturedImages.length === 0) {
      toast({
        title: "Error",
        description: "Please capture an image first",
        variant: "destructive"
      });
      return;
    }

    setUpdatingImage(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast({ title: "Authentication Error", description: "Please login again.", variant: "destructive" });
        return;
      }

      // Get the captured image as base64
      const imageBase64 = editCapturedImages[0].split(',')[1]; // Remove data:image/jpeg;base64, prefix

      const response = await fetch(`${API_BASE_URL}/students/${editStudentData.usn}/update-image`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          image_base64: imageBase64,
          filename: 'face.jpg'
        })
      });

      const result = await response.json();

      if (response.ok) {
        toast({
          title: "Success",
          description: "Student image updated successfully"
        });
        
        // Refresh student data to show new image
        await handleSearchStudent(editStudentData.usn);
        
        // Clear edit capture state
        setEditCapturedImages([]);
        setIsEditCameraOpen(false);
      } else {
        toast({
          title: "Update Failed",
          description: result.message || "Failed to update image",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Image update error:', error);
      toast({
        title: "Network Error",
        description: "Failed to connect to server. Please try again.",
        variant: "destructive"
      });
    } finally {
      setUpdatingImage(false);
    }
  };

  const handleCancelImageUpdate = () => {
    setEditCapturedImages([]);
    setIsEditCameraOpen(false);
  };

  const handleStudentRegSubmit = async () => {
    // Trim whitespace for validation
    const name = studentRegForm.name.trim();
    const usn = studentRegForm.usn.trim();
    const password = studentRegForm.password.trim();
    const confirmPassword = studentRegForm.confirmPassword.trim();
    const department = studentRegForm.department.trim();
    const email = studentRegForm.email.trim();
    const phone_no = studentRegForm.phone_no.trim();

    if (!name || !usn || !password || !confirmPassword || !department || !email || !phone_no) {
      const missingFields = [];
      if (!name) missingFields.push("Full Name");
      if (!usn) missingFields.push("Student ID");
      if (!password) missingFields.push("Password");
      if (!confirmPassword) missingFields.push("Confirm Password");
      if (!department) missingFields.push("Department");
      if (!email) missingFields.push("Email");
      if (!phone_no) missingFields.push("Phone Number");
      
      toast({ 
        title: "Error", 
        description: `Please fill in: ${missingFields.join(", ")}`, 
        variant: "destructive" 
      });
      return;
    }

    // Validate name length
    if (name.length < 3) {
      toast({ 
        title: "Invalid Name", 
        description: "Full Name must be at least 3 characters long", 
        variant: "destructive" 
      });
      return;
    }

    // Validate USN length
    if (usn.length < 3) {
      toast({ 
        title: "Invalid Student ID", 
        description: "Student ID (USN) must be at least 3 characters long", 
        variant: "destructive" 
      });
      return;
    }

    // Check if passwords match
    if (password !== confirmPassword) {
      toast({ 
        title: "Password Mismatch", 
        description: "Passwords do not match. Please try again.", 
        variant: "destructive" 
      });
      return;
    }

    // Validate email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({ 
        title: "Invalid Email", 
        description: "Please enter a valid email address", 
        variant: "destructive" 
      });
      return;
    }

    // Validate phone number
    if (!/^\d{10}$/.test(phone_no)) {
      toast({ 
        title: "Invalid Phone Number", 
        description: "Phone number must be exactly 10 digits", 
        variant: "destructive" 
      });
      return;
    }
    
    if (password.length < 6) {
      toast({ title: "Password Error", description: "Password must be at least 6 characters long.", variant: "destructive" });
      return;
    }

    if (capturedImages.length < 1) {
      toast({ title: "Photos Required", description: "Please capture at least 1 image.", variant: "destructive" });
      return;
    }

    setStudentRegistering(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast({ title: "Authentication Error", description: "Please login again.", variant: "destructive" });
        return;
      }

      // Get the first captured image as base64
      const imageBase64 = capturedImages[0].split(',')[1]; // Remove data:image/jpeg;base64, prefix

      const apiResponse = await fetch(`${API_BASE_URL}/students/register`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: studentRegForm.name,
          usn: studentRegForm.usn,
          department: studentRegForm.department,
          password: studentRegForm.password,
          email: studentRegForm.email,
          phone_no: studentRegForm.phone_no,
          image_base64: imageBase64,
          filename: 'face.jpg'
        })
      });

      const result = await apiResponse.json();

      if (apiResponse.ok) {
        toast({
          title: "Registration Successful",
          description: `${studentRegForm.name} has been registered successfully. Admin will assign semester and section.`,
          className: "bg-success text-success-foreground"
        });

        setStudentRegForm({ name: "", usn: "", department: "", semester: "", subjects: [], password: "", confirmPassword: "", email: "", phone_no: "" });
        setCapturedImages([]);
        setIsCameraOpen(false);
        
        // Refresh students table if it's loaded
        if (studentsTableData) {
          fetchStudentsTableData();
        }
      } else {
        toast({
          title: "Registration Failed",
          description: result.message || "Failed to register student.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Registration error:', error);
      toast({
        title: "Network Error",
        description: "Failed to connect to server. Please try again.",
        variant: "destructive"
      });
    } finally {
      setStudentRegistering(false);
    }
  };

  const handleAssignStudentSubmit = async () => {
    if (!assignStudentForm.usn || !assignStudentForm.sectionId || !assignStudentForm.semester || !assignStudentForm.department) {
      toast({ title: "Error", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }

    setStudentRegistering(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast({ title: "Authentication Error", description: "Please login again.", variant: "destructive" });
        setStudentRegistering(false);
        return;
      }

      // Pre-check: Verify if student already has enrollment for this date or semester
      const enrollmentDate = `${assignStudentForm.enrollmentYear}-${assignStudentForm.enrollmentMonth === "August" ? "08" : "02"}-01`;
      const enrollmentYearMonth = enrollmentDate.substring(0, 7); // Gets YYYY-MM

      // Check existing enrollments for this student
      const checkResponse = await fetch(`${API_BASE_URL}/students/${assignStudentForm.usn}/enrollments`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (checkResponse.ok) {
        const checkResult = await checkResponse.json();
        const existingEnrollments = checkResult.enrollments || [];

        // Check 1: Same enrollment date (year-month)
        const duplicateDate = existingEnrollments.find((e: any) => 
          e.enrollment_date && e.enrollment_date.substring(0, 7) === enrollmentYearMonth
        );

        if (duplicateDate) {
          toast({
            title: "Enrollment Date Conflict",
            description: `Student is already enrolled for ${assignStudentForm.enrollmentMonth} ${assignStudentForm.enrollmentYear}. A student cannot have two semester enrollments at the same date.`,
            variant: "destructive"
          });
          setStudentRegistering(false);
          return;
        }

        // Check 2: Same semester
        const duplicateSemester = existingEnrollments.find((e: any) => 
          e.semester === parseInt(assignStudentForm.semester)
        );

        if (duplicateSemester) {
          toast({
            title: "Semester Already Enrolled",
            description: `Student is already enrolled in Semester ${assignStudentForm.semester}. A student cannot enroll in the same semester twice.`,
            variant: "destructive"
          });
          setStudentRegistering(false);
          return;
        }
      }

      const apiResponse = await fetch(`${API_BASE_URL}/students/assign-semester`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          usn: assignStudentForm.usn,
          sectionId: assignStudentForm.sectionId,
          semester: assignStudentForm.semester,
          department: assignStudentForm.department,
          subjects: autoAssignedStudentSubjects,
          enrollmentDate: enrollmentDate,
          completionDate: assignStudentEnrollmentInfo.completionDate
        })
      });

      const result = await apiResponse.json();

      if (apiResponse.ok) {
        toast({
          title: "Success",
          description: "Student semester assignment successful.",
          className: "bg-success text-success-foreground"
        });

        setAssignStudentForm({ usn: "", sectionId: "", semester: "", department: "", subjects: [], enrollmentYear: new Date().getFullYear().toString(), enrollmentMonth: "August" });
        setStudentVerified(false);
        
        // Refresh students table if it's loaded
        if (studentsTableData) {
          fetchStudentsTableData();
        }
      } else {
        toast({
          title: "Assignment Failed",
          description: result.message || "Failed to assign semester to student.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Assignment error:', error);
      toast({
        title: "Network Error",
        description: "Failed to connect to server. Please try again.",
        variant: "destructive"
      });
    } finally {
      setStudentRegistering(false);
    }
  };

  // Search student for editing
  const handleSearchStudent = async (usnToSearch?: string) => {
    const searchUSN = usnToSearch || editStudentUSN.trim();
    
    if (!searchUSN) {
      toast({
        title: "Error",
        description: "Please enter a USN to search",
        variant: "destructive"
      });
      return;
    }

    setSearchingStudent(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/students/${searchUSN}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();

      if (response.ok && result.student) {
        // Set original data (for display)
        setEditStudentData(result.student);
        // Set form data (for editing)
        setEditStudentFormData({
          ...result.student,
          password: '',
          confirmPassword: ''
        });
        // Only show toast if it's a manual search (not a refresh)
        if (!usnToSearch) {
          toast({
            title: "Student Found",
            description: `Found ${result.student.name}`
          });
        }
      } else {
        setEditStudentData(null);
        setEditStudentFormData(null);
        toast({
          title: "Not Found",
          description: result.message || "Student not found",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: "Error",
        description: "Failed to search student",
        variant: "destructive"
      });
    } finally {
      setSearchingStudent(false);
    }
  };

  // Update student information
  const handleUpdateStudent = async () => {
    if (!editStudentFormData) return;

    // Validation 1: Check required fields are not empty
    const name = editStudentFormData.name?.trim();
    const email = editStudentFormData.email?.trim();
    const phone_no = editStudentFormData.phone_no?.trim();

    if (!name || name.length < 3) {
      toast({
        title: "Invalid Name",
        description: "Full Name must be at least 3 characters long.",
        variant: "destructive"
      });
      return;
    }

    // Validation 2: Email format
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address.",
        variant: "destructive"
      });
      return;
    }

    // Validation 3: Phone number (exactly 10 digits)
    if (!phone_no || !/^\d{10}$/.test(phone_no)) {
      toast({
        title: "Invalid Phone Number",
        description: "Phone number must be exactly 10 digits.",
        variant: "destructive"
      });
      return;
    }

    // Validation 4: Check if passwords match when password is being changed
    if (editStudentFormData.password && editStudentFormData.password.trim()) {
      if (editStudentFormData.password !== editStudentFormData.confirmPassword) {
        toast({
          title: "Password Mismatch",
          description: "Passwords do not match. Please try again.",
          variant: "destructive"
        });
        return;
      }

      if (editStudentFormData.password.length < 6) {
        toast({
          title: "Invalid Password",
          description: "Password must be at least 6 characters long.",
          variant: "destructive"
        });
        return;
      }
    }

    setUpdatingStudent(true);
    try {
      const token = localStorage.getItem('token');
      
      const updateData: any = {
        name: name,
        email: email,
        phone_no: phone_no
      };

      // Only include password if it's been changed
      if (editStudentFormData.password && editStudentFormData.password.trim()) {
        updateData.password = editStudentFormData.password;
      }

      const response = await fetch(`${API_BASE_URL}/students/${editStudentData.usn}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updateData)
      });

      const result = await response.json();

      if (response.ok) {
        toast({
          title: "Success",
          description: "Student information updated successfully"
        });
        
        // Refresh student data to show updated information
        await handleSearchStudent(editStudentData.usn);
        
        // Refresh students table if it's loaded
        if (studentsTableData) {
          fetchStudentsTableData();
        }
      } else {
        toast({
          title: "Update Failed",
          description: result.message || "Failed to update student",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Update error:', error);
      toast({
        title: "Error",
        description: "Failed to update student",
        variant: "destructive"
      });
    } finally {
      setUpdatingStudent(false);
    }
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-bold">Manage Students</h1>
        <p className="text-muted-foreground">View and register students</p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="view" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="view">View Students</TabsTrigger>
          <TabsTrigger value="register">Register Student</TabsTrigger>
          <TabsTrigger value="assign">Assign Semester to Student</TabsTrigger>
          <TabsTrigger value="edit">Edit Students</TabsTrigger>
        </TabsList>

        {/* View Students Tab */}
        <TabsContent value="view" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Students</CardTitle>
              <CardDescription>View all student information from database</CardDescription>
            </CardHeader>
            <CardContent>
              {!studentsTableData ? (
                <div className="text-center py-8">
                  <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground mb-4">Click to load student data</p>
                  <Button onClick={fetchStudentsTableData} disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Load Students Data
                      </>
                    )}
                  </Button>
                </div>
              ) : studentsTableData.data.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">No students in database</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead className="sticky top-0 z-10 bg-muted/50">
                      <tr>
                        {studentsTableData.structure.map((col) => (
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
                      {studentsTableData.data.map((row, index) => (
                        <tr key={index} className="hover:bg-muted/50 border-b border-border/30">
                          {studentsTableData.structure.map((col) => (
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
                    📊 {studentsTableData.rowCount} rows × {studentsTableData.structure.length} columns
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Register Student Tab */}
        <TabsContent value="register" className="mt-4">
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-primary">Student Registration</h2>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Student Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="student-name" className="text-sm font-medium">Full Name <span className="text-destructive">*</span></Label>
                    <div className="relative">
                      <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input 
                        id="student-name"
                        value={studentRegForm.name} 
                        onChange={e => setStudentRegForm({...studentRegForm, name: e.target.value})} 
                        placeholder="Enter student's full name"
                        className="pl-9 h-10"
                        required
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Minimum 3 characters</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="student-usn" className="text-sm font-medium">Student ID (USN) <span className="text-destructive">*</span></Label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input 
                        id="student-usn"
                        value={studentRegForm.usn} 
                        onChange={e => setStudentRegForm({...studentRegForm, usn: e.target.value})} 
                        placeholder="e.g. 1KT23CS001"
                        className="pl-9 h-10"
                        required
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Minimum 3 characters</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="student-email" className="text-sm font-medium">Email <span className="text-destructive">*</span></Label>
                    <div className="relative">
                      <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <Input 
                        id="student-email"
                        type="email"
                        value={studentRegForm.email} 
                        onChange={e => setStudentRegForm({...studentRegForm, email: e.target.value})} 
                        placeholder="student@example.com"
                        className="pl-9 h-10"
                        required
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Valid email format required</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="student-phone" className="text-sm font-medium">Phone Number <span className="text-destructive">*</span></Label>
                    <div className="relative">
                      <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      <Input 
                        id="student-phone"
                        type="tel"
                        value={studentRegForm.phone_no} 
                        onChange={e => setStudentRegForm({...studentRegForm, phone_no: e.target.value.replace(/\D/g, '')})} 
                        placeholder="9876543210"
                        maxLength={10}
                        className="pl-9 h-10"
                        required
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Enter 10-digit mobile number</p>
                  </div>
                  
                  {/* Security Note - Above Password Fields */}
                  <div className="flex items-start gap-2 text-sm text-muted-foreground bg-amber-50 dark:bg-amber-900/20 p-3 rounded-md border border-amber-200 dark:border-amber-800">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                    <span className="text-amber-700 dark:text-amber-300 font-medium">
                      <strong>Note:</strong> This password should be entered by the student themselves for security purposes. Keep your password secure, do not share it with anyone, and do not forget it.
                    </span>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="student-password" className="text-sm font-medium">Password <span className="text-destructive">*</span></Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input 
                        id="student-password"
                        type={showStudentPassword ? "text" : "password"} 
                        value={studentRegForm.password} 
                        onChange={e => setStudentRegForm({...studentRegForm, password: e.target.value})} 
                        placeholder="Create a strong password"
                        className="pl-9 pr-10 h-10"
                        required
                      />
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                        <button
                          type="button"
                          onClick={() => setShowStudentPassword(!showStudentPassword)}
                          className="text-gray-400 hover:text-gray-600 focus:outline-none"
                        >
                          {showStudentPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">Minimum 6 characters required</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="student-confirm-password" className="text-sm font-medium">Confirm Password <span className="text-destructive">*</span></Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input 
                        id="student-confirm-password"
                        type={showStudentConfirmPassword ? "text" : "password"} 
                        value={studentRegForm.confirmPassword} 
                        onChange={e => setStudentRegForm({...studentRegForm, confirmPassword: e.target.value})} 
                        placeholder="Confirm your password"
                        className="pl-9 pr-10 h-10"
                        required
                      />
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                        <button
                          type="button"
                          onClick={() => setShowStudentConfirmPassword(!showStudentConfirmPassword)}
                          className="text-gray-400 hover:text-gray-600 focus:outline-none"
                        >
                          {showStudentConfirmPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">Must match password</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="student-department" className="text-sm font-medium">Department <span className="text-destructive">*</span></Label>
                    <Select value={studentRegForm.department} onValueChange={v => setStudentRegForm({...studentRegForm, department: v})}>
                      <SelectTrigger id="student-department" className="h-10">
                        <SelectValue placeholder="Select Department" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CS">Computer Science (CSE)</SelectItem>
                        <SelectItem value="IS">Information Science (ISE)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md border border-blue-200 dark:border-blue-800">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        <strong>Note:</strong> Semester and Section will be assigned later by admin through "Assign Semester to Student" tab.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button className="flex-1" variant={isCameraOpen ? "outline" : "default"} onClick={() => {
                      setIsCameraOpen(!isCameraOpen);
                      if (!isCameraOpen) {
                        setCapturedImages([]);
                      }
                    }}>
                      {isCameraOpen ? "Close Camera" : "Open Camera"}
                    </Button>
                    <Button 
                      className="flex-1" 
                      variant="outline"
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.onchange = (e) => {
                          const file = (e.target as HTMLInputElement).files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              const imageData = event.target?.result as string;
                              setCapturedImages([imageData]);
                              setIsCameraOpen(false);
                            };
                            reader.readAsDataURL(file);
                          }
                        };
                        input.click();
                      }}
                    >
                      Upload Image
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Face Capture</CardTitle>
                  <CardDescription className="flex items-start gap-2 font-medium bg-primary/5 p-3 rounded-md">
                    <Info className="h-4 w-4 shrink-0 mt-0.5 text-green-700" />
                    <span className="text-foreground">
                      📸 <strong>Capture Requirements:</strong><br/>
                      • <strong>One high-quality image</strong> is required<br/>
                      • <strong>Face the camera directly</strong> with <strong>good lighting</strong><br/>
                      • Ensure <strong>clear visibility of facial features</strong><br/>
                      • Remove <strong>sunglasses/dark glasses, cap, hat, or mask</strong><br/>
                      • Avoid <strong>reflective glare</strong> on regular glasses<br/>
                      • Maintain <strong>neutral expression</strong><br/>
                      • Use camera for live capture or upload existing photo
                    </span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isCameraOpen && (
                    <div className="relative rounded-lg overflow-hidden bg-black aspect-video border-2 border-primary">
                      <Webcam 
                        ref={webcamRef}
                        className="w-full h-full object-cover"
                        audio={false}
                        screenshotFormat="image/jpeg"
                      />
                      <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                        <Button 
                          onClick={capture} 
                          size="icon" 
                          className="h-12 w-12 rounded-full border-4 border-white shadow-lg bg-green-500 hover:bg-green-600 transition-all"
                        >
                          <Camera className="h-6 w-6 text-white" />
                        </Button>
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-1 gap-4">
                    {capturedImages.map((img, idx) => (
                      <div key={idx} className="flex flex-col gap-2">
                        {/* Image container */}
                        <div className="relative rounded-md border bg-gray-100 h-[600px]">
                          <img src={img} className="w-full h-full object-contain rounded-md" />
                          
                          {/* Delete button - top-right */}
                          <button 
                            onClick={() => removeImage(idx)} 
                            className="absolute bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors shadow-lg"
                            style={{ 
                              top: '8px', 
                              right: '8px',
                              padding: '4px',
                              zIndex: 10,
                              position: 'absolute'
                            }}
                            title="Delete Image"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                        
                        {/* Action buttons - always visible below image */}
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleEnhanceImage(idx)}
                            className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-2 py-1.5 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1 shadow-sm"
                            title="Enhance Image"
                          >
                            <span>{enhancementModes[idx] === 0 ? '✨' : enhancementModes[idx] === 1 ? '🌙' : enhancementModes[idx] === 2 ? '🔥' : enhancementModes[idx] === 3 ? '🎨' : '✨'}</span>
                            <span>{enhancementModes[idx] === -1 || enhancementModes[idx] === undefined ? 'Enhance' : enhancementModes[idx] === 0 ? 'Balanced' : enhancementModes[idx] === 1 ? 'Low Light' : enhancementModes[idx] === 2 ? 'Warm' : 'Vibrant'}</span>
                          </button>
                          <button
                            onClick={() => handleResetImage(idx)}
                            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white px-2 py-1.5 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1 shadow-sm"
                            title="Reset to Original"
                          >
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Reset
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <div className="flex justify-end pt-6 border-t">
              <Button size="lg" className="w-full md:w-auto gap-2" onClick={handleStudentRegSubmit} disabled={studentRegistering}>
                {studentRegistering ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Registering...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" /> Save Student Record
                  </>
                )}
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* Assign Semester to Student Tab */}
        <TabsContent value="assign" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Assign Semester to Student</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Important Note */}
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md border border-blue-200 dark:border-blue-800">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      <strong>Note:</strong> The student must be registered before the semester enrollment date. After <strong>fetching</strong> the student details, department and subjects are automatically assigned based on the student's registration and selected semester.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-foreground border-b pb-2">Student Assignment</h3>
                  
                  <div className="space-y-2">
                    <Label htmlFor="assign-usn">Student ID (USN) <span className="text-red-500">*</span></Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Hash className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="assign-usn"
                          placeholder="Enter registered student ID"
                          className="pl-9"
                          value={assignStudentForm.usn}
                          onChange={(e) => setAssignStudentForm(prev => ({ ...prev, usn: e.target.value }))}
                          disabled={studentRegistering || checkingStudent || studentVerified}
                        />
                      </div>
                      <Button
                        type="button"
                        onClick={handleCheckStudent}
                        disabled={checkingStudent || !assignStudentForm.usn.trim()}
                        className="px-4"
                      >
                        {checkingStudent ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Check"
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Minimum 3 characters</p>
                  </div>
                  
                  {/* Show rest of form only after student is verified */}
                  {studentVerified && (
                  <>
                  {/* Enrollment Information */}
                  <div className="border-t pt-4 mt-4">
                    <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Enrollment Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="assign-enrollment-year" className="text-sm font-medium">Enrollment Year <span className="text-red-500">*</span></Label>
                        <Select onValueChange={v => setAssignStudentForm(prev => ({ ...prev, enrollmentYear: v }))} value={assignStudentForm.enrollmentYear}>
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
                        <Select onValueChange={v => setAssignStudentForm(prev => ({ ...prev, enrollmentMonth: v }))} value={assignStudentForm.enrollmentMonth}>
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
                        <span className="text-sm text-muted-foreground">{assignStudentForm.enrollmentMonth} {assignStudentForm.enrollmentYear}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Semester Type</Label>
                        <div className="h-10 px-3 py-2 rounded-md border border-input bg-muted flex items-center">
                          <span className="text-sm font-semibold text-primary">{assignStudentEnrollmentInfo.semesterType}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Completion Date</Label>
                        <div className="h-10 px-3 py-2 rounded-md border border-input bg-muted flex items-center">
                          <span className="text-sm text-muted-foreground">{assignStudentEnrollmentInfo.completionMonth} {assignStudentEnrollmentInfo.completionYear}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="assign-semester" className="text-sm font-medium">Semester <span className="text-red-500">*</span></Label>
                      <Select onValueChange={v => setAssignStudentForm(prev => ({ ...prev, semester: v }))} value={assignStudentForm.semester}>
                        <SelectTrigger id="assign-semester" className="h-10">
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
                      <Label htmlFor="assign-section" className="text-sm font-medium">Section <span className="text-red-500">*</span></Label>
                      <Select onValueChange={v => setAssignStudentForm(prev => ({ ...prev, sectionId: v }))} value={assignStudentForm.sectionId}>
                        <SelectTrigger id="assign-section" className="h-10">
                          <SelectValue placeholder="Select Section" />
                        </SelectTrigger>
                        <SelectContent>
                          {SECTIONS.map(sec => (
                            <SelectItem key={sec} value={sec}>Section {sec}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="assign-department" className="text-sm font-medium">Department (Locked) <span className="text-red-500">*</span></Label>
                    <Select onValueChange={v => setAssignStudentForm(prev => ({ ...prev, department: v }))} value={assignStudentForm.department}>
                      <SelectTrigger id="assign-department" className="h-10" disabled>
                        <SelectValue placeholder="Select Department" />
                      </SelectTrigger>
                      <SelectContent>
                        {DEPARTMENTS.map(dept => (
                          <SelectItem key={dept} value={dept}>
                            {dept === "CS" ? "Computer Science (CSE)" : "Information Science (ISE)"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Department is locked and auto-assigned based on student record</p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Subjects (Auto-assigned)</Label>
                    <div className="bg-muted/30 p-3 rounded-lg border space-y-2">
                      {filteredAssignStudentSubjects.length === 0 ? (
                        <div className="text-sm text-muted-foreground">No subjects available</div>
                      ) : (
                        filteredAssignStudentSubjects.map(subject => (
                          <div key={subject} className="flex items-center space-x-2">
                            <Checkbox
                              id={`assign-subject-${subject}`}
                              checked={true}
                              disabled={true}
                            />
                            <Label htmlFor={`assign-subject-${subject}`} className="text-sm cursor-default">
                              {subject}
                            </Label>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  </>
                  )}

                  {/* Show message if not verified yet */}
                  {!studentVerified && !checkingStudent && (
                    <div className="text-center py-8 text-muted-foreground">
                      <UserPlus className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>Enter a Student ID and click "Check" to verify and continue</p>
                    </div>
                  )}

                  <div className="flex justify-end gap-3 pt-6 border-t">
                    <Button 
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setAssignStudentForm({
                          usn: "",
                          sectionId: "",
                          semester: "",
                          department: "",
                          subjects: [],
                          enrollmentYear: new Date().getFullYear().toString(),
                          enrollmentMonth: "August"
                        });
                        setStudentVerified(false);
                      }}
                      disabled={studentRegistering}
                    >
                      Cancel
                    </Button>
                    <Button size="lg" className="gap-2" onClick={handleAssignStudentSubmit} disabled={studentRegistering}>
                      {studentRegistering ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Assigning...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4" /> Assign Semester to Student
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Edit Students Tab */}
        <TabsContent value="edit" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Edit Student Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Informational Note at Top */}
              <div className="mb-6 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                      How to Edit Student Information
                    </p>
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      Enter the student's USN and click "Fetch Details" to load their current information. You can then update their personal details, change their password, or update their photo. All changes are saved to the database and will be reflected immediately.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                {/* Fetch Student Section */}
                <div className="space-y-4 pb-6 border-b">
                  <div className="space-y-2">
                    <Label htmlFor="edit-usn">Student USN</Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Hash className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="edit-usn"
                          placeholder="Enter registered student USN"
                          className="pl-9"
                          value={editStudentUSN}
                          onChange={(e) => {
                            setEditStudentUSN(e.target.value);
                            setEditStudentData(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              if (editStudentUSN.trim()) {
                                handleSearchStudent();
                              }
                            }
                          }}
                          disabled={searchingStudent || editStudentData !== null}
                        />
                      </div>
                      <Button
                        type="button"
                        onClick={() => handleSearchStudent()}
                        disabled={searchingStudent || !editStudentUSN.trim()}
                      >
                        {searchingStudent ? (
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

                {/* Student Info Display - Only show after fetching */}
                {editStudentData && (
                  <>
                    {/* Current Student Information (Read-only) */}
                    <div className="space-y-4 pb-6 border-b">
                      <h3 className="text-lg font-semibold text-foreground">Current Student Information</h3>
                      <div className="bg-muted/30 p-4 rounded-lg border">
                        <div className="flex flex-col md:flex-row gap-6">
                          {/* Left Side - Student Image */}
                          <div className="flex-shrink-0">
                            <Label className="text-xs text-muted-foreground mb-2 block">Current Photo</Label>
                            <div className="relative w-48 h-48 rounded-lg overflow-hidden border-2 border-primary/20">
                              {editStudentData.captured_image_path ? (
                                <img 
                                  src={`/uploads/students/${editStudentData.captured_image_path.split(/[/\\]/).pop()}`}
                                  alt={editStudentData.name}
                                  className="w-full h-full object-cover"
                                  onLoad={() => console.log('✅ Image loaded successfully:', editStudentData.captured_image_path.split(/[/\\]/).pop())}
                                  onError={(e) => {
                                    const filename = editStudentData.captured_image_path.split(/[/\\]/).pop();
                                    console.error('❌ Image load error');
                                    console.error('Attempted URL:', `/uploads/students/${filename}`);
                                    console.error('Filename:', filename);
                                    console.error('Full path from DB:', editStudentData.captured_image_path);
                                    e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23ddd" width="200" height="200"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3ENo Image%3C/text%3E%3C/svg%3E';
                                  }}
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-muted">
                                  <span className="text-muted-foreground text-sm">No photo</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Right Side - Student Details */}
                          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">USN</Label>
                              <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md border">
                                <Info className="h-4 w-4 text-muted-foreground" />
                                <span className="font-mono font-semibold">{editStudentData.usn}</span>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Full Name</Label>
                              <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md border">
                                <UserPlus className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{editStudentData.name}</span>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Department</Label>
                              <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md border">
                                <Info className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{editStudentData.department}</span>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Email</Label>
                              <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md border">
                                <Info className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{editStudentData.email || 'Not provided'}</span>
                              </div>
                            </div>
                            <div className="space-y-1 md:col-span-2">
                              <Label className="text-xs text-muted-foreground">Phone Number</Label>
                              <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md border">
                                <Info className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{editStudentData.phone_no || 'Not provided'}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Update Information Section */}
                    <div className="space-y-4 pb-6 border-b">
                      <h3 className="text-lg font-semibold text-foreground">Update Information</h3>
                      
                      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg p-3">
                        <p className="text-sm text-blue-900 dark:text-blue-100">
                          <strong>Note:</strong> USN cannot be changed. Modify the fields below to update student information.
                        </p>
                      </div>

                      {/* Name */}
                      <div className="space-y-2">
                        <Label htmlFor="edit-student-name">Full Name <span className="text-red-500">*</span></Label>
                        <div className="relative">
                          <UserPlus className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="edit-student-name"
                            placeholder="Enter full name"
                            className="pl-9"
                            value={editStudentFormData.name}
                            onChange={(e) => setEditStudentFormData({ ...editStudentFormData, name: e.target.value })}
                            required
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">Minimum 3 characters</p>
                      </div>

                      {/* Email */}
                      <div className="space-y-2">
                        <Label htmlFor="edit-student-email">Email <span className="text-red-500">*</span></Label>
                        <div className="relative">
                          <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          <Input
                            id="edit-student-email"
                            type="email"
                            placeholder="student@example.com"
                            className="pl-9"
                            value={editStudentFormData.email || ''}
                            onChange={(e) => setEditStudentFormData({ ...editStudentFormData, email: e.target.value })}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">Valid email format required</p>
                      </div>

                      {/* Phone Number */}
                      <div className="space-y-2">
                        <Label htmlFor="edit-student-phone">Phone Number <span className="text-red-500">*</span></Label>
                        <div className="relative">
                          <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          <Input
                            id="edit-student-phone"
                            type="tel"
                            placeholder="9876543210"
                            maxLength={10}
                            className="pl-9"
                            value={editStudentFormData.phone_no || ''}
                            onChange={(e) => setEditStudentFormData({ ...editStudentFormData, phone_no: e.target.value.replace(/\D/g, '') })}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">Exactly 10 digits</p>
                      </div>

                      {/* Security Note - Above Password Fields */}
                      <div className="flex items-start gap-2 text-sm text-muted-foreground bg-amber-50 dark:bg-amber-900/20 p-3 rounded-md border border-amber-200 dark:border-amber-800">
                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                        <span className="text-amber-700 dark:text-amber-300 font-medium">
                          <strong>Note:</strong> This password should be entered by the student themselves for security purposes. Keep your password secure, do not share it with anyone, and do not forget it.
                        </span>
                      </div>

                      {/* Password */}
                      <div className="space-y-2">
                        <Label htmlFor="edit-student-password">New Password (Optional)</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="edit-student-password"
                            type={showEditPassword ? "text" : "password"}
                            placeholder="Leave blank to keep current password"
                            className="pl-9 pr-10"
                            value={editStudentFormData.password || ''}
                            onChange={(e) => setEditStudentFormData({ ...editStudentFormData, password: e.target.value })}
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
                        <Label htmlFor="edit-student-confirm-password">Confirm New Password</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="edit-student-confirm-password"
                            type={showEditConfirmPassword ? "text" : "password"}
                            placeholder="Re-enter new password"
                            className="pl-9 pr-10"
                            value={editStudentFormData.confirmPassword || ''}
                            onChange={(e) => setEditStudentFormData({ ...editStudentFormData, confirmPassword: e.target.value })}
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
                      <div className="flex justify-end gap-2 pt-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setEditStudentData(null);
                            setEditStudentFormData(null);
                            setEditStudentUSN("");
                            setShowEditPassword(false);
                            setShowEditConfirmPassword(false);
                            setEditCapturedImages([]);
                            setIsEditCameraOpen(false);
                          }}
                          disabled={updatingStudent}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          onClick={handleUpdateStudent}
                          disabled={updatingStudent}
                        >
                          {updatingStudent ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Updating...
                            </>
                          ) : (
                            <>
                              <Save className="h-4 w-4 mr-2" />
                              Update Student
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Update Student Photo Section */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-foreground">Update Student Photo</h3>
                      
                      <Card>
                        <CardHeader>
                          <CardTitle>Face Capture</CardTitle>
                          <CardDescription className="flex items-start gap-2 font-medium bg-primary/5 p-3 rounded-md">
                            <Info className="h-4 w-4 shrink-0 mt-0.5 text-green-700" />
                            <span className="text-foreground">
                              📸 <strong>Capture Requirements:</strong><br/>
                              • <strong>One high-quality image</strong> is required<br/>
                              • <strong>Face the camera directly</strong> with <strong>good lighting</strong><br/>
                              • Ensure <strong>clear visibility of facial features</strong><br/>
                              • Remove <strong>sunglasses/dark glasses, cap, hat, or mask</strong><br/>
                              • Avoid <strong>reflective glare</strong> on regular glasses<br/>
                              • Maintain <strong>neutral expression</strong><br/>
                              • Use camera for live capture or upload existing photo
                            </span>
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {isEditCameraOpen && (
                            <div className="relative rounded-lg overflow-hidden bg-black aspect-video border-2 border-primary">
                              <Webcam 
                                ref={editWebcamRef}
                                className="w-full h-full object-cover"
                                audio={false}
                                screenshotFormat="image/jpeg"
                              />
                              <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                                <Button 
                                  onClick={editCapture} 
                                  size="icon" 
                                  className="h-12 w-12 rounded-full border-4 border-white shadow-lg bg-green-500 hover:bg-green-600 transition-all"
                                >
                                  <Camera className="h-6 w-6 text-white" />
                                </Button>
                              </div>
                            </div>
                          )}
                          <div className="grid grid-cols-1 gap-4">
                            {editCapturedImages.map((img, idx) => (
                              <div key={idx} className="flex flex-col gap-2">
                                {/* Image container */}
                                <div className="relative rounded-md border bg-gray-100 h-[600px]">
                                  <img src={img} className="w-full h-full object-contain rounded-md" />
                                  
                                  {/* Delete button - top-right */}
                                  <button 
                                    onClick={() => removeEditImage(idx)} 
                                    className="absolute bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors shadow-lg"
                                    style={{ 
                                      top: '8px', 
                                      right: '8px',
                                      padding: '4px',
                                      zIndex: 10,
                                      position: 'absolute'
                                    }}
                                    title="Delete Image"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                                
                                {/* Action buttons - always visible below image */}
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => handleEditEnhanceImage(idx)}
                                    className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-2 py-1.5 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1 shadow-sm"
                                    title="Enhance Image"
                                  >
                                    <span>{editEnhancementModes[idx] === 0 ? '✨' : editEnhancementModes[idx] === 1 ? '🌙' : editEnhancementModes[idx] === 2 ? '🔥' : editEnhancementModes[idx] === 3 ? '🎨' : '✨'}</span>
                                    <span>{editEnhancementModes[idx] === -1 || editEnhancementModes[idx] === undefined ? 'Enhance' : editEnhancementModes[idx] === 0 ? 'Balanced' : editEnhancementModes[idx] === 1 ? 'Low Light' : editEnhancementModes[idx] === 2 ? 'Warm' : 'Vibrant'}</span>
                                  </button>
                                  <button
                                    onClick={() => handleEditResetImage(idx)}
                                    className="flex-1 bg-orange-500 hover:bg-orange-600 text-white px-2 py-1.5 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1 shadow-sm"
                                    title="Reset to Original"
                                  >
                                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    Reset
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                          
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => setIsEditCameraOpen(!isEditCameraOpen)}
                              className="bg-green-600 hover:bg-green-700 text-white"
                            >
                              <Camera className="h-3.5 w-3.5 mr-1.5" />
                              {isEditCameraOpen ? "Close Camera" : "Open Camera"}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => document.getElementById('edit-image-upload')?.click()}
                              className="bg-green-600 hover:bg-green-700 text-white"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              Upload Photo
                            </Button>
                            <input
                              id="edit-image-upload"
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    setEditCapturedImages([reader.result as string]);
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                          </div>

                          <div className="flex justify-end pt-4 border-t">
                            <Button
                              type="button"
                              onClick={handleUpdateImage}
                              disabled={updatingImage || editCapturedImages.length === 0}
                            >
                              {updatingImage ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Updating...
                                </>
                              ) : (
                                <>
                                  <Save className="h-4 w-4 mr-2" />
                                  Submit New Photo
                                </>
                              )}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </>
                )}

                {/* Empty State - Show when no student is fetched */}
                {!editStudentData && !searchingStudent && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Info className="h-8 w-8 mx-auto mb-2" />
                    <p>Search for a student to edit their information</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
