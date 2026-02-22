import { useState, useRef, useCallback, useEffect } from "react";
import Webcam from "react-webcam";
import { useStore, Student, AttendanceStatus } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, Video, UserX, UserCheck, Upload, Loader2, CheckCircle2, Calendar as CalendarIcon, ChevronLeft, ChevronRight, FileText, Shield, AlertTriangle, Edit, Trash2, Clock } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { SEMESTERS, DEPARTMENTS, SECTIONS, ALL_SUBJECTS, API_BASE_URL, getSubjectsByDepartments, getSubjectsForDepartment } from "@/lib/constants";
import FaceDetectionCamera from "@/components/FaceDetectionCamera";
import TimetableDisplay from "@/components/TimetableDisplay";

const captureImageAndRecognizeFaces = async (students: Student[], sessionData: any, webcamRef: React.RefObject<Webcam>): Promise<{recognizedStudents: string[], capturedImageUrl: string, boundingBoxes: any[]}> => {
  return new Promise((resolve, reject) => {
    // Create a canvas to capture the current webcam frame
    const video = webcamRef.current?.video;
    if (!video) {
      reject(new Error('Camera not available'));
      return;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Canvas not available'));
      return;
    }

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw current frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert canvas to blob
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error('Failed to capture image'));
        return;
      }

      try {
        // Create FormData for API call
        const formData = new FormData();
        formData.append('capturedImage', blob, 'attendance-capture.jpg');
        formData.append('sessionId', sessionData.sessionId);
        formData.append('semester', sessionData.semester);
        formData.append('department', sessionData.department);
        formData.append('section', sessionData.section);
        formData.append('subject', sessionData.subject);
        formData.append('captureMode', sessionData.captureMode);
        formData.append('captureTime', new Date().toISOString());

        // Call the attendance capture API
        const response = await fetch(`${API_BASE_URL}/attendance/capture`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: formData
        });

        if (!response.ok) {
          throw new Error(`API call failed: ${response.statusText}`);
        }

        const result = await response.json();
        
        // Return the recognition results with proper image URL
        resolve({
          recognizedStudents: result.recognizedStudents?.map((r: any) => r.studentId || r) || [],
          capturedImageUrl: result.capturedImageUrl ? `/api${result.capturedImageUrl}` : '',
          boundingBoxes: result.boundingBoxes || []
        });

      } catch (error) {
        console.error('Face recognition API error:', error);
        // Reject with a clear error message instead of falling back to mock data
        reject(new Error('Face recognition service is not available. Please ensure the Python server is running.'));
      }
    }, 'image/jpeg', 0.8);
  });
};

export default function TakeAttendance() {
  const { students, createSession, submitSession, currentUser, editAttendance, fetchStudents, initializeUser } = useStore();
  const { toast } = useToast();
  const webcamRef = useRef<Webcam>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // All state declarations MUST come before useEffect hooks
  const [filterDept, setFilterDept] = useState("");
  const [filterSection, setFilterSection] = useState("");
  const [filterSemester, setFilterSemester] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [date, setDate] = useState<Date>(new Date());

  // Authorization state
  const [authError, setAuthError] = useState("");
  const [hasValidFilters, setHasValidFilters] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);

  const [step, setStep] = useState<'filter' | 'capture' | 'review' | 'submitted'>('filter');
  const [mode, setMode] = useState<'photo' | 'video'>('photo');
  const [processing, setProcessing] = useState(false);
  const [attendanceList, setAttendanceList] = useState<{id: string, name: string, status: AttendanceStatus | 'excused', confidence: number | null, emotion?: string | null, attentiveness?: string | null, reason: string, reasonType?: string, permissionFile?: File, markedBy?: 'system' | 'manual'}[]>([]);
  const [capturedImageUrl, setCapturedImageUrl] = useState<string>('');
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [originalImages, setOriginalImages] = useState<string[]>([]);
  const [imageSizes, setImageSizes] = useState<number[]>([]);
  const [enhancementModes, setEnhancementModes] = useState<number[]>([]);
  const [annotatedImages, setAnnotatedImages] = useState<string[]>([]);
  const [savedImagePath, setSavedImagePath] = useState<string>(''); // NEW: Path to saved annotated image
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [boundingBoxes, setBoundingBoxes] = useState<any[]>([]);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [captureTime, setCaptureTime] = useState<Date | null>(null);

  // Feature 1: Timetable-Based Attendance Control
  const [teacherSchedule, setTeacherSchedule] = useState<any[]>([]);
  const [currentPeriod, setCurrentPeriod] = useState<any>(null);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [scheduleFetched, setScheduleFetched] = useState(false); // Track if schedule was fetched
  const [timeWindowStatus, setTimeWindowStatus] = useState<{ allowed: boolean; message: string } | null>(null);

  // Ensure user data is loaded when component mounts
  useEffect(() => {
    if (!currentUser) {
      initializeUser();
    }
  }, []);

  // Feature 1: Fetch class schedule when first 3 filters are selected
  useEffect(() => {
    const fetchClassSchedule = async () => {
      // Only fetch if all 3 filters are selected
      if (!filterSemester || !filterDept || !filterSection) {
        setTeacherSchedule([]);
        setCurrentPeriod(null);
        setScheduleFetched(false);
        return;
      }

      if (!currentUser || currentUser.role !== 'teacher') return;

      setLoadingSchedule(true);
      setScheduleFetched(false);
      try {
        const token = localStorage.getItem('token');
        if (!token) return;

        const dateStr = format(date, 'yyyy-MM-dd');
        const response = await fetch(
          `${API_BASE_URL}/timetable/class/schedule?date=${dateStr}&semester=${filterSemester}&department=${filterDept}&section=${filterSection}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (response.ok) {
          const data = await response.json();
          console.log('📅 Class schedule loaded:', data);
          setTeacherSchedule(data.schedule || []);
          setCurrentPeriod(data.current_period);
          setScheduleFetched(true); // Mark as fetched

          // Auto-fill subject if there's a current period
          if (data.current_period) {
            console.log('✅ Auto-filling subject from current period:', data.current_period.subject);
            setFilterSubject(data.current_period.subject);
          } else {
            console.log('ℹ️ No current period - subject remains empty');
            setFilterSubject('');
          }
        } else {
          console.error('❌ Failed to fetch schedule:', response.status, response.statusText);
          setScheduleFetched(true); // Mark as fetched even on error
        }
      } catch (error) {
        console.error('❌ Error fetching class schedule:', error);
        setScheduleFetched(true); // Mark as fetched even on error
      } finally {
        setLoadingSchedule(false);
      }
    };

    fetchClassSchedule();
  }, [currentUser, date, filterSemester, filterDept, filterSection]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const { scrollLeft, clientWidth } = scrollContainerRef.current;
      const scrollTo = direction === 'left' ? scrollLeft - 300 : scrollLeft + 300;
      scrollContainerRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  };

  const isTeacher = currentUser?.role === 'teacher';

  const filteredStudents = students.filter(s => s.dept === filterDept && s.sectionId === filterSection);

  // Helper function to check if current time is within allowed attendance window
  // Allowed: 15 minutes before start time to 15 minutes after end time
  const isWithinAttendanceWindow = (startTime: string, endTime: string): { allowed: boolean; message: string } => {
    const now = new Date();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTimeInMinutes = currentHours * 60 + currentMinutes;

    // Parse start time (format: "HH:MM" or "HH:MM:SS")
    const [startHour, startMin] = startTime.split(':').map(Number);
    const startTimeInMinutes = startHour * 60 + startMin;
    const windowStartInMinutes = startTimeInMinutes - 15; // 15 min before

    // Parse end time
    const [endHour, endMin] = endTime.split(':').map(Number);
    const endTimeInMinutes = endHour * 60 + endMin;
    const windowEndInMinutes = endTimeInMinutes + 15; // 15 min after

    if (currentTimeInMinutes < windowStartInMinutes) {
      // Too early
      const minutesUntilStart = windowStartInMinutes - currentTimeInMinutes;
      const hoursUntil = Math.floor(minutesUntilStart / 60);
      const minsUntil = minutesUntilStart % 60;
      
      let timeMessage = '';
      if (hoursUntil > 0) {
        timeMessage = `${hoursUntil} hour${hoursUntil > 1 ? 's' : ''} and ${minsUntil} minute${minsUntil !== 1 ? 's' : ''}`;
      } else {
        timeMessage = `${minsUntil} minute${minsUntil !== 1 ? 's' : ''}`;
      }
      
      return {
        allowed: false,
        message: `The class period has not started yet. You can take attendance ${timeMessage} before the class begins (at ${startTime}).`
      };
    } else if (currentTimeInMinutes > windowEndInMinutes) {
      // Too late
      return {
        allowed: false,
        message: `The attendance window has closed. Attendance must be taken within 15 minutes after the class ends (${endTime}).`
      };
    } else {
      // Within window
      return {
        allowed: true,
        message: 'You are within the attendance window.'
      };
    }
  };

  // Helper function to calculate base64 image size in KB
  const getImageSize = (base64String: string): number => {
    // Remove data URL prefix if present
    const base64 = base64String.includes(',') ? base64String.split(',')[1] : base64String;
    // Calculate size: base64 length * 0.75 (base64 encoding overhead) / 1024 (convert to KB)
    const sizeInKB = (base64.length * 0.75) / 1024;
    return Math.round(sizeInKB);
  };

  // Helper function to format file size
  const formatFileSize = (sizeInKB: number): string => {
    if (sizeInKB < 1024) {
      return `${sizeInKB} KB`;
    } else {
      return `${(sizeInKB / 1024).toFixed(2)} MB`;
    }
  };

  // Helper function to remove image from gallery
  const removeImage = (index: number) => {
    setCapturedImages(prev => prev.filter((_, i) => i !== index));
    setOriginalImages(prev => prev.filter((_, i) => i !== index));
    setImageSizes(prev => prev.filter((_, i) => i !== index));
    setEnhancementModes(prev => prev.filter((_, i) => i !== index));
  };

  // Helper function to enhance image with 4 different modes (cycles through)
  const enhanceImage = (index: number) => {
    const img = new Image();
    img.src = originalImages[index]; // Always enhance from original
    
    // Get current mode and cycle to next (0 -> 1 -> 2 -> 3 -> 0)
    const currentMode = enhancementModes[index] || 0;
    const nextMode = (currentMode + 1) % 4;
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // Apply enhancement based on mode
      let enhancedData: ImageData;
      let modeName = '';
      
      switch (nextMode) {
        case 0:
          enhancedData = applyBalancedEnhancement(imageData, canvas.width, canvas.height);
          modeName = 'Balanced';
          break;
        case 1:
          enhancedData = applyLowLightBoost(imageData, canvas.width, canvas.height);
          modeName = 'Low Light';
          break;
        case 2:
          enhancedData = applyClaritySharpness(imageData, canvas.width, canvas.height);
          modeName = 'Warm & Natural';
          break;
        case 3:
          enhancedData = applyColorVibrance(imageData, canvas.width, canvas.height);
          modeName = 'Vibrant';
          break;
        default:
          enhancedData = imageData;
          modeName = 'Original';
      }

      ctx.putImageData(enhancedData, 0, 0);
      const enhancedImage = canvas.toDataURL('image/jpeg', 0.92);

      setCapturedImages(prev => {
        const newImages = [...prev];
        newImages[index] = enhancedImage;
        return newImages;
      });

      setImageSizes(prev => {
        const newSizes = [...prev];
        newSizes[index] = getImageSize(enhancedImage);
        return newSizes;
      });

      setEnhancementModes(prev => {
        const newModes = [...prev];
        newModes[index] = nextMode;
        return newModes;
      });

      toast({
        title: `${modeName} Enhancement Applied`,
        description: `Mode ${nextMode + 1} of 4 - Click again to try next mode`
      });
    };
  };

  // Helper function to detect skin tone pixels (improved for low light)
  const detectSkinTone = (r: number, g: number, b: number): boolean => {
    // Multiple skin tone detection methods for better accuracy in low light
    
    // Method 1: RGB-based skin detection (relaxed thresholds for dark images)
    const rgbCondition = (
      r > 60 && g > 30 && b > 15 && // Lowered thresholds for dark images
      r > g && r > b &&
      (r - g) > 10 && (r - b) > 10 // Relaxed difference requirements
    );
    
    // Method 2: Normalized RGB for varying lighting (more tolerant)
    const sum = r + g + b;
    if (sum === 0) return false;
    
    const rNorm = r / sum;
    const gNorm = g / sum;
    const bNorm = b / sum;
    
    const normalizedCondition = (
      rNorm > 0.33 && rNorm < 0.50 && // Wider range
      gNorm > 0.25 && gNorm < 0.40 && // Wider range
      bNorm > 0.15 && bNorm < 0.35    // Wider range
    );
    
    // Method 3: HSV-based detection (converted from RGB)
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    
    let h = 0;
    if (delta !== 0) {
      if (max === r) {
        h = 60 * (((g - b) / delta) % 6);
      } else if (max === g) {
        h = 60 * (((b - r) / delta) + 2);
      } else {
        h = 60 * (((r - g) / delta) + 4);
      }
    }
    if (h < 0) h += 360;
    
    const s = max === 0 ? 0 : (delta / max) * 100;
    const v = (max / 255) * 100;
    
    const hsvCondition = (
      (h >= 0 && h <= 60) && // Wider hue range
      s >= 15 && s <= 75 &&  // Wider saturation range
      v >= 20 && v <= 95     // Lower minimum value for dark skin
    );
    
    // Method 4: YCbCr color space (best for skin detection in varying light)
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
    const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
    
    const ycbcrCondition = (
      y > 40 && // Lower threshold for dark images
      cb >= 77 && cb <= 127 &&
      cr >= 133 && cr <= 173
    );
    
    // Return true if any method detects skin tone
    return rgbCondition || normalizedCondition || hsvCondition || ycbcrCondition;
  };

  // Helper function to calculate skin tone confidence (0-1)
  const calculateSkinConfidence = (r: number, g: number, b: number): number => {
    // Calculate how "typical" this skin tone is
    // More typical = higher confidence = more brightening
    
    const sum = r + g + b;
    if (sum === 0) return 0.5; // Default confidence for very dark pixels
    
    const rNorm = r / sum;
    const gNorm = g / sum;
    
    // Ideal skin tone ratios
    const idealRNorm = 0.4;
    const idealGNorm = 0.32;
    
    // Calculate distance from ideal
    const rDist = Math.abs(rNorm - idealRNorm);
    const gDist = Math.abs(gNorm - idealGNorm);
    const totalDist = rDist + gDist;
    
    // Convert distance to confidence (closer = higher confidence)
    const confidence = Math.max(0.3, 1 - (totalDist * 4)); // Minimum 0.3 confidence
    
    return confidence;
  };

  // Mode 1: Balanced Enhancement (Good for most images)
  const applyBalancedEnhancement = (imageData: ImageData, width: number, height: number): ImageData => {
    const data = imageData.data;
    const output = new ImageData(width, height);
    const outData = output.data;

    // Light noise reduction
    const denoised = applyFastBilateralFilter(imageData, width, height);
    
    for (let i = 0; i < denoised.data.length; i += 4) {
      let r = denoised.data[i];
      let g = denoised.data[i + 1];
      let b = denoised.data[i + 2];

      // Moderate brightness (+15)
      r += 15;
      g += 15;
      b += 15;

      // Balanced contrast (1.1x)
      r = (r - 128) * 1.1 + 128;
      g = (g - 128) * 1.1 + 128;
      b = (b - 128) * 1.1 + 128;

      // Skin tone preservation
      const isSkinTone = r > g && g > b && r - g < 50 && g - b < 50;
      if (!isSkinTone) {
        const avg = (r + g + b) / 3;
        r = avg + (r - avg) * 1.05;
        g = avg + (g - avg) * 1.05;
        b = avg + (b - avg) * 1.05;
      }

      outData[i] = Math.min(255, Math.max(0, r));
      outData[i + 1] = Math.min(255, Math.max(0, g));
      outData[i + 2] = Math.min(255, Math.max(0, b));
      outData[i + 3] = denoised.data[i + 3];
    }

    return applyEnhancedSharpening(output, width, height);
  };

  // Mode 2: Low Light Boost - Simple and effective brightening
  const applyLowLightBoost = (imageData: ImageData, width: number, height: number): ImageData => {
    const data = imageData.data;
    const output = new ImageData(width, height);
    const outData = output.data;
    
    // Simple but effective: multiply + add
    for (let i = 0; i < data.length; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];
      
      // Multiply for proportional brightening
      r = r * 2.5;
      g = g * 2.5;
      b = b * 2.5;
      
      // Add flat boost
      r = r + 50;
      g = g + 50;
      b = b + 50;
      
      // Clamp
      outData[i] = Math.min(255, Math.max(0, r));
      outData[i + 1] = Math.min(255, Math.max(0, g));
      outData[i + 2] = Math.min(255, Math.max(0, b));
      outData[i + 3] = data[i + 3];
    }
    
    return output;
  };

  // Light bilateral filter for post-processing
  const applyLightBilateralFilter = (imageData: ImageData, width: number, height: number): ImageData => {
    const data = imageData.data;
    const output = new ImageData(width, height);
    const outData = output.data;
    
    const kernelRadius = 1;
    const rangeSigma = 20;
    const spatialWeights = [
      [0.60, 0.80, 0.60],
      [0.80, 1.00, 0.80],
      [0.60, 0.80, 0.60]
    ];
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const centerIdx = (y * width + x) * 4;
        const centerR = data[centerIdx];
        const centerG = data[centerIdx + 1];
        const centerB = data[centerIdx + 2];
        
        let sumR = 0, sumG = 0, sumB = 0, sumWeight = 0;
        
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const idx = ((y + dy) * width + (x + dx)) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            
            const dr = r - centerR;
            const dg = g - centerG;
            const db = b - centerB;
            const colorDiff = Math.sqrt(dr * dr + dg * dg + db * db);
            
            const rangeWeight = Math.exp(-(colorDiff * colorDiff) / (2 * rangeSigma * rangeSigma));
            const weight = spatialWeights[dy + 1][dx + 1] * rangeWeight;
            
            sumR += r * weight;
            sumG += g * weight;
            sumB += b * weight;
            sumWeight += weight;
          }
        }
        
        outData[centerIdx] = sumR / sumWeight;
        outData[centerIdx + 1] = sumG / sumWeight;
        outData[centerIdx + 2] = sumB / sumWeight;
        outData[centerIdx + 3] = data[centerIdx + 3];
      }
    }
    
    // Copy edges
    for (let x = 0; x < width; x++) {
      const topIdx = x * 4;
      const bottomIdx = ((height - 1) * width + x) * 4;
      for (let c = 0; c < 4; c++) {
        outData[topIdx + c] = data[topIdx + c];
        outData[bottomIdx + c] = data[bottomIdx + c];
      }
    }
    for (let y = 0; y < height; y++) {
      const leftIdx = y * width * 4;
      const rightIdx = (y * width + width - 1) * 4;
      for (let c = 0; c < 4; c++) {
        outData[leftIdx + c] = data[leftIdx + c];
        outData[rightIdx + c] = data[rightIdx + c];
      }
    }
    
    return output;
  };

  // Mode 3: Warm & Natural (For dark images with natural tones)
  const applyClaritySharpness = (imageData: ImageData, width: number, height: number): ImageData => {
    const data = imageData.data;
    const output = new ImageData(width, height);
    const outData = output.data;

    // Apply noise reduction first to avoid grainy appearance
    const denoised = applyFastBilateralFilter(imageData, width, height);

    for (let i = 0; i < denoised.data.length; i += 4) {
      let r = denoised.data[i];
      let g = denoised.data[i + 1];
      let b = denoised.data[i + 2];

      // Moderate brightness (+20)
      r += 20;
      g += 20;
      b += 20;

      // Warm color temperature (reduce blue, boost red/yellow)
      r = r * 1.08; // Boost red slightly
      g = g * 1.04; // Boost green slightly
      b = b * 0.92; // Reduce blue (removes cold tone)

      // Enhanced mid-tones (makes faces more visible)
      const brightness = (r + g + b) / 3;
      if (brightness > 60 && brightness < 180) {
        const midtoneBoost = 1.15;
        r = brightness + (r - brightness) * midtoneBoost;
        g = brightness + (g - brightness) * midtoneBoost;
        b = brightness + (b - brightness) * midtoneBoost;
      }

      // Subtle contrast (1.12x)
      r = (r - 128) * 1.12 + 128;
      g = (g - 128) * 1.12 + 128;
      b = (b - 128) * 1.12 + 128;

      // Skin tone enhancement
      const isSkinTone = r > g && g > b && r - g < 60 && g - b < 60;
      if (isSkinTone) {
        r = r * 1.05; // Slightly boost red in skin tones
        g = g * 1.02;
      }

      outData[i] = Math.min(255, Math.max(0, r));
      outData[i + 1] = Math.min(255, Math.max(0, g));
      outData[i + 2] = Math.min(255, Math.max(0, b));
      outData[i + 3] = denoised.data[i + 3];
    }

    // Light sharpening only (not aggressive)
    return applyEnhancedSharpening(output, width, height);
  };

  // Mode 4: Color & Vibrance (Washed out/Dull images)
  const applyColorVibrance = (imageData: ImageData, width: number, height: number): ImageData => {
    const data = imageData.data;
    const output = new ImageData(width, height);
    const outData = output.data;

    // Light noise reduction to avoid grainy appearance
    const denoised = applyFastBilateralFilter(imageData, width, height);

    for (let i = 0; i < denoised.data.length; i += 4) {
      let r = denoised.data[i];
      let g = denoised.data[i + 1];
      let b = denoised.data[i + 2];

      // Slight brightness reduction (-8)
      r -= 8;
      g -= 8;
      b -= 8;

      // Contrast adjustment (1.12x)
      r = (r - 128) * 1.12 + 128;
      g = (g - 128) * 1.12 + 128;
      b = (b - 128) * 1.12 + 128;

      // Strong saturation boost (1.3x)
      const avg = (r + g + b) / 3;
      r = avg + (r - avg) * 1.3;
      g = avg + (g - avg) * 1.3;
      b = avg + (b - avg) * 1.3;

      // Vibrance (boost less saturated colors more)
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const saturation = max === 0 ? 0 : (max - min) / max;
      
      if (saturation < 0.5) {
        const boost = 1 + (1 - saturation) * 0.3;
        r = avg + (r - avg) * boost;
        g = avg + (g - avg) * boost;
        b = avg + (b - avg) * boost;
      }

      outData[i] = Math.min(255, Math.max(0, r));
      outData[i + 1] = Math.min(255, Math.max(0, g));
      outData[i + 2] = Math.min(255, Math.max(0, b));
      outData[i + 3] = denoised.data[i + 3];
    }

    return applyEnhancedSharpening(output, width, height);
  };

  // Optimized fast bilateral filter for noise reduction (ENHANCED for better clarity)
  const applyFastBilateralFilter = (imageData: ImageData, width: number, height: number): ImageData => {
    const data = imageData.data;
    const output = new ImageData(width, height);
    const outData = output.data;
    
    // Stronger parameters for better noise reduction
    const kernelRadius = 2; // 5x5 kernel for better smoothing
    const rangeSigma = 30; // Increased for more aggressive noise reduction
    const spatialSigma = 2.0; // Increased spatial influence
    
    // Precompute spatial weights for 5x5 kernel
    const spatialWeights = [
      [0.40, 0.60, 0.70, 0.60, 0.40],
      [0.60, 0.80, 0.90, 0.80, 0.60],
      [0.70, 0.90, 1.00, 0.90, 0.70],
      [0.60, 0.80, 0.90, 0.80, 0.60],
      [0.40, 0.60, 0.70, 0.60, 0.40]
    ];
    
    // Process with optimized loop
    for (let y = kernelRadius; y < height - kernelRadius; y++) {
      for (let x = kernelRadius; x < width - kernelRadius; x++) {
        const centerIdx = (y * width + x) * 4;
        const centerR = data[centerIdx];
        const centerG = data[centerIdx + 1];
        const centerB = data[centerIdx + 2];
        
        let sumR = 0, sumG = 0, sumB = 0, sumWeight = 0;
        
        // 5x5 kernel for better smoothing
        for (let dy = -kernelRadius; dy <= kernelRadius; dy++) {
          for (let dx = -kernelRadius; dx <= kernelRadius; dx++) {
            const idx = ((y + dy) * width + (x + dx)) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            
            // Fast color difference
            const dr = r - centerR;
            const dg = g - centerG;
            const db = b - centerB;
            const colorDiff = Math.sqrt(dr * dr + dg * dg + db * db);
            
            // Combined weight
            const rangeWeight = Math.exp(-(colorDiff * colorDiff) / (2 * rangeSigma * rangeSigma));
            const weight = spatialWeights[dy + kernelRadius][dx + kernelRadius] * rangeWeight;
            
            sumR += r * weight;
            sumG += g * weight;
            sumB += b * weight;
            sumWeight += weight;
          }
        }
        
        outData[centerIdx] = sumR / sumWeight;
        outData[centerIdx + 1] = sumG / sumWeight;
        outData[centerIdx + 2] = sumB / sumWeight;
        outData[centerIdx + 3] = data[centerIdx + 3];
      }
    }
    
    // Copy edges
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (y < kernelRadius || y >= height - kernelRadius || x < kernelRadius || x >= width - kernelRadius) {
          const idx = (y * width + x) * 4;
          for (let c = 0; c < 4; c++) {
            outData[idx + c] = data[idx + c];
          }
        }
      }
    }
    
    return output;
  };

  // Enhanced sharpening with edge detection to preserve clarity
  const applyEnhancedSharpening = (imageData: ImageData, width: number, height: number): ImageData => {
    const data = imageData.data;
    const output = new ImageData(width, height);
    const outData = output.data;
    
    // Unsharp mask technique for better clarity
    const kernel = [
      [0, -1, 0],
      [-1, 5, -1],
      [0, -1, 0]
    ];
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const centerIdx = (y * width + x) * 4;
        
        for (let c = 0; c < 3; c++) {
          let sum = 0;
          
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const idx = ((y + dy) * width + (x + dx)) * 4 + c;
              sum += data[idx] * kernel[dy + 1][dx + 1];
            }
          }
          
          // Blend with original for natural look
          const original = data[centerIdx + c];
          outData[centerIdx + c] = Math.min(255, Math.max(0, sum * 0.6 + original * 0.4));
        }
        outData[centerIdx + 3] = data[centerIdx + 3];
      }
    }
    
    // Copy edges
    for (let x = 0; x < width; x++) {
      const topIdx = x * 4;
      const bottomIdx = ((height - 1) * width + x) * 4;
      for (let c = 0; c < 4; c++) {
        outData[topIdx + c] = data[topIdx + c];
        outData[bottomIdx + c] = data[bottomIdx + c];
      }
    }
    for (let y = 0; y < height; y++) {
      const leftIdx = y * width * 4;
      const rightIdx = (y * width + width - 1) * 4;
      for (let c = 0; c < 4; c++) {
        outData[leftIdx + c] = data[leftIdx + c];
        outData[rightIdx + c] = data[rightIdx + c];
      }
    }
    
    return output;
  };

  // Helper function to reset image to original
  const resetImage = (index: number) => {
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
        newModes[index] = -1; // Reset to no enhancement
        return newModes;
      });

      toast({
        title: "Image Reset",
        description: "Restored to original"
      });
    }
  };

  // Helper function to handle image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileCount = files.length;
    let loadedCount = 0;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const imageData = event.target?.result as string;
        setCapturedImages(prev => [...prev, imageData]);
        setOriginalImages(prev => [...prev, imageData]); // Store original
        setImageSizes(prev => [...prev, getImageSize(imageData)]); // Store size
        setEnhancementModes(prev => [...prev, -1]); // Initialize as not enhanced
        loadedCount++;
        
        // Show toast when all images are loaded
        if (loadedCount === fileCount) {
          toast({
            title: "Images Uploaded",
            description: `${fileCount} image${fileCount !== 1 ? 's' : ''} added to gallery`
          });
        }
      };
      reader.readAsDataURL(file);
    });
    
    // Reset input
    e.target.value = '';
  };

  // Check if required filters are selected
  useEffect(() => {
    const valid = filterSemester && filterDept && filterSection;
    setHasValidFilters(!!valid);
    
    if (!valid) {
      setAuthError("Please select Semester, Department, and Section");
      setIsAuthorized(false);
      setFilterSubject(""); // Reset subject when filters change
    } else {
      setAuthError("");
    }
  }, [filterSemester, filterDept, filterSection]);

  // Reset subject when semester or department changes (subjects are different per dept/semester)
  useEffect(() => {
    setFilterSubject(""); // Clear subject selection when semester or dept changes
  }, [filterSemester, filterDept]);

  // Check teacher authorization for selected filters (calls backend API)
  const checkTeacherAuthorization = async () => {
    console.log('🔍 Checking teacher authorization via API...');
    
    if (!currentUser || !hasValidFilters || !filterSubject) {
      console.log('❌ Missing required data');
      return { authorized: false, message: "Please complete all selections" };
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        return { authorized: false, message: "Authentication required" };
      }

      const response = await fetch(`${API_BASE_URL}/timetable/check-authorization`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          semester: parseInt(filterSemester),
          department: filterDept,
          section: filterSection,
          subject: filterSubject,
          date: format(date, 'yyyy-MM-dd') // Send selected date for enrollment validation
        })
      });

      const data = await response.json();
      console.log('Authorization response:', data);

      if (response.ok && data.success) {
        console.log('✅ Authorization check passed');
        return { authorized: data.authorized, message: data.message };
      } else {
        console.log('❌ Authorization check failed');
        return { authorized: false, message: data.message || "Authorization failed" };
      }
    } catch (error) {
      console.error('❌ Error checking authorization:', error);
      return { authorized: false, message: "Failed to verify authorization" };
    }
  };

  // Check authorization when filters change
  useEffect(() => {
    const checkAuth = async () => {
      if (hasValidFilters && filterSubject) {
        const authCheck = await checkTeacherAuthorization();
        setIsAuthorized(authCheck.authorized);
        setAuthError(authCheck.authorized ? "" : (authCheck.message || "Authorization failed"));
      } else {
        setIsAuthorized(false);
        if (hasValidFilters && !filterSubject) {
          setAuthError("Please select a Subject");
        } else {
          setAuthError("");
        }
      }
    };

    checkAuth();
  }, [filterSubject, hasValidFilters, filterSemester, filterDept, filterSection, currentUser, date]);

  // Check time window when subject is selected
  useEffect(() => {
    if (!filterSubject || !teacherSchedule || teacherSchedule.length === 0) {
      setTimeWindowStatus(null);
      return;
    }

    // Find ALL periods for the selected subject (there might be multiple)
    const matchingPeriods = teacherSchedule.filter(period => period.subject === filterSubject);
    
    if (matchingPeriods.length === 0) {
      // Subject not in today's schedule
      setTimeWindowStatus({
        allowed: false,
        message: `${filterSubject} is not scheduled for today. Please select a subject from today's timetable or choose a different date.`
      });
      return;
    }

    // Get current time
    const now = new Date();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTimeInMinutes = currentHours * 60 + currentMinutes;

    // Find the period that's closest to the current time
    let selectedPeriod = null;
    let minTimeDifference = Infinity;

    for (const period of matchingPeriods) {
      const [startHour, startMin] = period.start_time.split(':').map(Number);
      const startTimeInMinutes = startHour * 60 + startMin;
      
      // Calculate time difference (absolute value)
      const timeDifference = Math.abs(currentTimeInMinutes - startTimeInMinutes);
      
      // Select the period closest to current time
      if (timeDifference < minTimeDifference) {
        minTimeDifference = timeDifference;
        selectedPeriod = period;
      }
    }

    if (!selectedPeriod) {
      setTimeWindowStatus({
        allowed: false,
        message: `Unable to determine the current period for ${filterSubject}.`
      });
      return;
    }

    // Check if within time window for the selected period
    const windowCheck = isWithinAttendanceWindow(selectedPeriod.start_time, selectedPeriod.end_time);
    setTimeWindowStatus(windowCheck);

    // Set up interval to recheck every minute
    const interval = setInterval(() => {
      // Recalculate which period is closest to current time
      const now = new Date();
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();
      const currentTimeInMinutes = currentHours * 60 + currentMinutes;

      let closestPeriod = null;
      let minDiff = Infinity;

      for (const period of matchingPeriods) {
        const [startHour, startMin] = period.start_time.split(':').map(Number);
        const startTimeInMinutes = startHour * 60 + startMin;
        const diff = Math.abs(currentTimeInMinutes - startTimeInMinutes);
        
        if (diff < minDiff) {
          minDiff = diff;
          closestPeriod = period;
        }
      }

      if (closestPeriod) {
        const updatedCheck = isWithinAttendanceWindow(closestPeriod.start_time, closestPeriod.end_time);
        setTimeWindowStatus(updatedCheck);
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [filterSubject, teacherSchedule]);

  // Get all options (not filtered by authorization)
  const getAllSemesters = () => SEMESTERS;
  const getAllDepartments = () => DEPARTMENTS;
  const getAllSections = () => SECTIONS;
  const getAllSubjects = () => ALL_SUBJECTS;

  // Get subjects filtered by semester and department (CRITICAL FIX for Feature 1)
  const getFilteredSubjects = () => {
    if (!filterSemester || !filterDept) return [];
    // Use getSubjectsForDepartment to get subjects for ONLY the selected department
    return getSubjectsForDepartment(filterSemester, filterDept);
  };

  // Safety check - if currentUser is not loaded yet, show loading
  if (!currentUser) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading...</p>
          <p className="text-xs text-muted-foreground">If this takes too long, please refresh the page</p>
        </div>
      </div>
    );
  }

  const timetable = [
    { period: 1, time: "9:00 AM", subject: "Mathematics", status: "present" },
    { period: 2, time: "10:00 AM", subject: "Computer Science", status: "present" },
    { period: 3, time: "11:00 AM", subject: "Physics", status: "absent" },
    { period: 4, time: "12:00 PM", subject: "Engineering Mechanics", status: "present" },
    { period: 5, time: "2:00 PM", subject: "Digital Logic", status: "present" },
  ];

  const handleCapture = useCallback(async () => {
    setProcessing(true);
    const captureTimestamp = new Date();
    setCaptureTime(captureTimestamp);
    
    try {
      // Validate required fields
      if (!filterSemester || !filterDept || !filterSection || !filterSubject) {
        toast({
          title: "Missing Information",
          description: "Please select Semester, Department, Section, and Subject before processing attendance.",
          variant: "destructive",
        });
        setProcessing(false);
        return;
      }

      // Check teacher authorization
      const authCheck = await checkTeacherAuthorization();
      if (!authCheck.authorized) {
        toast({
          title: "Authorization Error",
          description: authCheck.message,
          variant: "destructive",
        });
        setProcessing(false);
        return;
      }

      // Validate that images have been captured
      if (capturedImages.length === 0) {
        toast({
          title: "No Images",
          description: "Please capture or upload at least one image before processing attendance.",
          variant: "destructive",
        });
        setProcessing(false);
        return;
      }

      // Send images to ML service for face recognition
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required');
      }

      // Convert base64 images to clean base64 strings (remove data URL prefix)
      const base64Images = capturedImages.map(img => {
        // Remove "data:image/jpeg;base64," prefix if present
        return img.includes(',') ? img.split(',')[1] : img;
      });

      // Create JSON payload with base64 images
      const payload = {
        images: base64Images,
        semester: filterSemester,
        department: filterDept,
        section: filterSection,
        subject: filterSubject
      };

      // Call ML recognition endpoint
      const recognitionResponse = await fetch(`${API_BASE_URL}/attendance/capture`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const recognitionData = await recognitionResponse.json();

      if (!recognitionResponse.ok) {
        // If ML service failed, show error and stop processing
        const errorMessage = recognitionData.message || 'Face recognition service is unavailable. Please ensure the Python server is running.';
        throw new Error(errorMessage);
      }

      // Fetch all enrolled students
      const params = new URLSearchParams({
        subject: filterSubject,
        semester: filterSemester
      });

      const endpoint = `/students/by-class/${filterDept}/${filterSection}?${params}`;
      const studentsResponse = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const studentsData = await studentsResponse.json();

      if (!studentsResponse.ok || !studentsData.students || studentsData.students.length === 0) {
        toast({
          title: "No Students Found",
          description: `No students are registered for ${filterSubject} in ${filterDept} Section ${filterSection}.`,
          variant: "destructive",
        });
        setProcessing(false);
        return;
      }

      // Get recognized student USNs from ML response with confidence, attentiveness, and emotion
      const recognizedMap = new Map(
        (recognitionData.recognizedStudents || []).map((s: any) => [s.usn, { confidence: s.confidence, attentiveness: s.attentiveness, emotion: s.emotion }])
      );

      // Store annotated/processed images separately (don't replace original images)
      if (recognitionData.processedImages && recognitionData.processedImages.length > 0) {
        // Convert base64 to data URLs for display
        const annotatedImgs = recognitionData.processedImages.map((base64: string) => 
          `data:image/jpeg;base64,${base64}`
        );
        setAnnotatedImages(annotatedImgs);
      }

      // Store the saved image path for submission
      if (recognitionData.savedImagePath) {
        setSavedImagePath(recognitionData.savedImagePath);
        console.log('💾 Saved image path:', recognitionData.savedImagePath);
      }

      // Format students for attendance list with ML recognition results, confidence, attentiveness, and emotion
      const formattedStudents = studentsData.students.map((student: any) => {
        const recognitionData = recognizedMap.get(student.usn) as any;
        return {
          id: student.usn,
          name: student.name,
          status: recognitionData ? 'present' as AttendanceStatus : 'absent' as AttendanceStatus,
          confidence: recognitionData?.confidence ? Math.round(recognitionData.confidence * 100) : null,
          attentiveness: recognitionData?.attentiveness || null,
          emotion: recognitionData?.emotion || null,
          reason: "",
          reasonType: "",
          permissionFile: undefined,
          markedBy: 'system' as 'system' | 'manual' // Initially marked by system
        };
      });

      setAttendanceList(formattedStudents);

      // Move to review step
      setStep('review');
      
      const recognizedCount = recognitionData.total_students_recognized || 0;
      const totalFaces = recognitionData.total_faces_detected || 0;
      
      toast({
        title: "Face Recognition Complete",
        description: `Recognized ${recognizedCount} students from ${totalFaces} faces detected in ${capturedImages.length} image(s). Please review and submit.`,
      });
      
    } catch (error) {
      console.error('Process error:', error);
      toast({
        title: "Processing Failed",
        description: error instanceof Error ? error.message : "Failed to process attendance. Please try again.",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  }, [filterSemester, filterDept, filterSection, filterSubject, toast, capturedImages, checkTeacherAuthorization]);

  const AcademicInfo = () => (
    <Card className="mb-6 relative overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Academic Info</h2>
            <div className="flex gap-12">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Department</p>
                <p className="text-xl font-bold">Computer Science</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Dept</p>
                <p className="text-xl font-bold">CS - A Section</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Semester</p>
                <p className="text-xl font-bold">6th Semester</p>
              </div>
            </div>
          </div>
          {isTeacher && (
            <Link href="/timetable">
              <Button variant="outline" className="gap-2 font-bold uppercase text-xs border-2">
                <CalendarIcon className="h-4 w-4" />
                View Timetable
              </Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (step === 'submitted') return (
    <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
      <div className="w-24 h-24 bg-success/10 rounded-full flex items-center justify-center"><CheckCircle2 className="w-12 h-12 text-success" /></div>
      <h2 className="text-2xl font-bold">Attendance Submitted Successfully</h2>
      <p className="text-muted-foreground">All attendance records have been saved to the database.</p>
      <Button onClick={() => {
        setStep('filter');
        setAttendanceList([]);
        setCapturedImageUrl('');
        setCapturedImages([]);
        setOriginalImages([]);
        setImageSizes([]);
        setEnhancementModes([]);
        setAnnotatedImages([]);
        setFilterSemester('');
        setFilterDept('');
        setFilterSection('');
        setFilterSubject('');
      }} className="gap-2 px-8 bg-green-600 hover:bg-green-700">
        <ChevronLeft className="h-4 w-4" />
        Back to Main
      </Button>
    </div>
  );

  // Student specific view as per the requested image
  if (!isTeacher) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <AcademicInfo />

        <Card className="mb-4">
          <CardContent className="p-4 flex flex-wrap gap-4 items-end">
            <div className="space-y-1 flex-1 min-w-[120px]">
              <label className="text-xs font-bold text-muted-foreground uppercase">Semester</label>
              <Select value={filterSemester} onValueChange={setFilterSemester}>
                <SelectTrigger><SelectValue placeholder="Semester" /></SelectTrigger>
                <SelectContent>
                  {SEMESTERS.map(s => (
                    <SelectItem key={s} value={s}>Sem {s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 flex-1 min-w-[200px]">
              <label className="text-xs font-bold text-muted-foreground uppercase">Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal border-2">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <div className="p-4 space-y-4">
                    {/* Year and Month Selectors */}
                    <div className="flex gap-2 items-center justify-center">
                      <Select 
                        value={date.getFullYear().toString()} 
                        onValueChange={(year) => {
                          const newDate = new Date(date);
                          newDate.setFullYear(parseInt(year));
                          setDate(newDate);
                        }}
                      >
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="max-h-48">
                          {Array.from({ length: 50 }, (_, i) => {
                            const year = new Date().getFullYear() - 25 + i;
                            return (
                              <SelectItem key={year} value={year.toString()}>
                                {year}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      
                      <Select 
                        value={date.getMonth().toString()} 
                        onValueChange={(month) => {
                          const newDate = new Date(date);
                          newDate.setMonth(parseInt(month));
                          setDate(newDate);
                        }}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 12 }, (_, i) => {
                            const monthName = new Date(2024, i, 1).toLocaleString('default', { month: 'long' });
                            return (
                              <SelectItem key={i} value={i.toString()}>
                                {monthName}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Calendar Component */}
                    <CalendarComponent 
                      mode="single" 
                      selected={date} 
                      onSelect={(d) => d && setDate(d)} 
                      initialFocus 
                      month={date}
                      onMonthChange={setDate}
                    />
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </CardContent>
        </Card>

        <div className="mb-6 relative">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Daily Timetable</h2>
            <div className="flex items-center gap-3">
              <div className="text-sm text-gray-500">
                {format(date, "EEEE, MMM dd")}
              </div>
              <div className="flex gap-1">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-10 w-10 hover:scale-110 active:scale-95 transition-all duration-200 hover:bg-blue-50 hover:text-blue-600 rounded-full shadow-sm cursor-default" 
                  onClick={() => scroll('left')}
                >
                  <ChevronLeft className="h-6 w-6"/>
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-10 w-10 hover:scale-110 active:scale-95 transition-all duration-200 hover:bg-blue-50 hover:text-blue-600 rounded-full shadow-sm cursor-default" 
                  onClick={() => scroll('right')}
                >
                  <ChevronRight className="h-6 w-6"/>
                </Button>
              </div>
            </div>
          </div>
          
          <div 
            ref={scrollContainerRef} 
            className="flex gap-4 overflow-x-auto pb-4 snap-x scroll-smooth"
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
          >
            {timetable.map((item, i) => (
              <Card 
                key={i} 
                className="min-w-[280px] shrink-0 snap-start relative overflow-hidden border-0 shadow-lg bg-white transition-all duration-300"
                style={{
                  background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.1)'
                }}
              >
                {/* Animated top border */}
                <div className={cn(
                  "absolute top-0 left-0 w-full h-1",
                  item.status === 'present' 
                    ? "bg-gradient-to-r from-green-400 to-green-600" 
                    : "bg-gradient-to-r from-red-400 to-red-600"
                )} />
                
                <CardContent className="p-6 relative z-10">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full uppercase tracking-wider">
                        PERIOD {item.period}
                      </span>
                    </div>
                    <div className={cn(
                      "w-4 h-4 rounded-full flex-shrink-0",
                      item.status === 'present' 
                        ? "bg-green-500 shadow-lg" 
                        : "bg-red-500 shadow-lg"
                    )} />
                  </div>
                  
                  <h3 className="font-bold text-gray-900 text-xl mb-3 leading-tight font-serif">
                    {item.subject}
                  </h3>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 font-semibold bg-gray-50 px-3 py-1 rounded-full">
                      {item.time}
                    </span>
                    <span className={cn(
                      "text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full",
                      item.status === 'present' 
                        ? "text-green-700 bg-green-100" 
                        : "text-red-700 bg-red-100"
                    )}>
                      {item.status}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          
          {/* Custom scrollbar styling - Hidden */}
          <style dangerouslySetInnerHTML={{
            __html: `
              div::-webkit-scrollbar {
                display: none;
              }
            `
          }} />
        </div>
      </div>
    );
  }

  // Teacher View (Original Functionality Restored)
  return (
    <div className="space-y-6">
      {step === 'filter' && (
        <>
          {/* Feature 1: Display teacher's schedule */}
          {isTeacher && teacherSchedule && teacherSchedule.length > 0 && date && (
            <TimetableDisplay 
              schedule={teacherSchedule} 
              currentDate={format(date, 'yyyy-MM-dd')} 
            />
          )}

          {/* Show message when no timetable is assigned for selected filters */}
          {isTeacher && hasValidFilters && scheduleFetched && (!teacherSchedule || teacherSchedule.length === 0) && (
            <Card className="mb-6 border-orange-200 bg-orange-50 dark:bg-orange-950/20">
              <CardContent className="p-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-orange-600 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-orange-900 dark:text-orange-100 mb-1">No Timetable Assigned</h3>
                    <p className="text-sm text-orange-800 dark:text-orange-200">
                      No timetable is configured for <span className="font-semibold">Semester {filterSemester}, {filterDept} Department, Section {filterSection}</span> on {format(date, 'EEEE, MMMM d, yyyy')}.
                    </p>
                    <p className="text-sm text-orange-700 dark:text-orange-300 mt-2">
                      Please contact the administrator to set up the timetable, or select a different class/date.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="bg-card p-4 border-b rounded-lg space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Select 
                value={filterSemester} 
                onValueChange={(value) => {
                  setFilterSemester(value);
                  setFilterSubject(''); // Reset subject when changing filters
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Semester"/>
                </SelectTrigger>
                <SelectContent>
                  {getAllSemesters().map(s => (
                    <SelectItem key={s} value={s}>Sem {s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select 
                value={filterDept} 
                onValueChange={(value) => {
                  setFilterDept(value);
                  setFilterSubject(''); // Reset subject when changing filters
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Dept"/>
                </SelectTrigger>
                <SelectContent>
                  {getAllDepartments().map(cls => (
                    <SelectItem key={cls} value={cls}>{cls}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select 
                value={filterSection} 
                onValueChange={(value) => {
                  setFilterSection(value);
                  setFilterSubject(''); // Reset subject when changing filters
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Section"/>
                </SelectTrigger>
                <SelectContent>
                  {getAllSections().map(sec => (
                    <SelectItem key={sec} value={sec}>Section {sec}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select 
                value={filterSubject} 
                onValueChange={setFilterSubject}
                disabled={!hasValidFilters}
              >
                <SelectTrigger 
                  className={cn(
                    !hasValidFilters && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <SelectValue placeholder={hasValidFilters ? "Select Subject" : "Select Semester, Dept & Section first"} />
                </SelectTrigger>
                <SelectContent>
                  {getFilteredSubjects().map(subject => (
                    <SelectItem key={subject} value={subject}>{subject}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Authorization Status */}
            {authError && !isAuthorized && (
              <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md border border-destructive/20">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{authError}</span>
              </div>
            )}
            
            {isAuthorized && hasValidFilters && filterSubject && (
              <div className="flex items-start gap-2 text-sm text-green-700 bg-green-50 dark:bg-green-900/20 p-3 rounded-md border border-green-200 dark:border-green-800">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-green-600" />
                <span>
                  ✅ You are authorized to take attendance for this class.
                </span>
              </div>
            )}

            {/* Time Window Status */}
            {timeWindowStatus && !timeWindowStatus.allowed && isAuthorized && (
              <div className="flex items-start gap-2 text-sm text-orange-700 bg-orange-50 dark:bg-orange-900/20 p-3 rounded-md border border-orange-200 dark:border-orange-800">
                <Clock className="h-4 w-4 shrink-0 mt-0.5 text-orange-600" />
                <span>{timeWindowStatus.message}</span>
              </div>
            )}

            {timeWindowStatus && timeWindowStatus.allowed && isAuthorized && (
              <div className="flex items-start gap-2 text-sm text-blue-700 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md border border-blue-200 dark:border-blue-800">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-blue-600" />
                <span>✅ You are within the attendance window. You can start the session now.</span>
              </div>
            )}
          </div>
          
          <div className="flex justify-center gap-4">
            <Button 
              size="lg" 
              onClick={async () => {
                console.log('🔘 Start Session button clicked');
                
                // Validate filters
                if (!hasValidFilters || !filterSubject) {
                  toast({
                    title: "Missing Filters",
                    description: "Please select all filters before starting session",
                    variant: "destructive"
                  });
                  return;
                }

                // Check authorization
                if (!isAuthorized) {
                  toast({
                    title: "Not Authorized", 
                    description: authError || "You are not authorized to take attendance for this class",
                    variant: "destructive"
                  });
                  return;
                }

                // Check time window
                if (timeWindowStatus && !timeWindowStatus.allowed) {
                  toast({
                    title: "Outside Attendance Window",
                    description: timeWindowStatus.message,
                    variant: "destructive"
                  });
                  return;
                }

                // Check if session already exists
                try {
                  const token = localStorage.getItem('token');
                  const dateStr = format(date, 'yyyy-MM-dd');
                  const response = await fetch(
                    `${API_BASE_URL}/timetable/check-existing-session?date=${dateStr}&semester=${filterSemester}&department=${filterDept}&section=${filterSection}&subject=${encodeURIComponent(filterSubject)}`,
                    {
                      headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                      }
                    }
                  );

                  if (response.ok) {
                    const data = await response.json();
                    if (data.session_exists) {
                      toast({
                        title: "Session Already Exists",
                        description: "Attendance has already been taken for this class today. You cannot take it again.",
                        variant: "destructive"
                      });
                      return;
                    }
                  }
                } catch (error) {
                  console.error('Error checking existing session:', error);
                }

                // Proceed to capture
                console.log('✅ Proceeding to capture step');
                
                // Clear previous images when starting new session
                setCapturedImages([]);
                setOriginalImages([]);
                setImageSizes([]);
                setEnhancementModes([]);
                setAnnotatedImages([]);
                setCapturedImageUrl('');
                
                setStep('capture');
              }} 
              disabled={
                !isAuthorized || 
                !hasValidFilters || 
                !filterSubject || 
                (!teacherSchedule || teacherSchedule.length === 0) ||
                (timeWindowStatus ? !timeWindowStatus.allowed : false)
              }
              className={
                (!isAuthorized || 
                 (!teacherSchedule || teacherSchedule.length === 0) || 
                 (timeWindowStatus ? !timeWindowStatus.allowed : false)) 
                  ? "opacity-50 cursor-not-allowed" 
                  : ""
              }
            >
              {(!teacherSchedule || teacherSchedule.length === 0) ? (
                <>
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  No Timetable Available
                </>
              ) : !isAuthorized ? (
                <>
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Not Authorized
                </>
              ) : (timeWindowStatus && !timeWindowStatus.allowed) ? (
                <>
                  <Clock className="h-4 w-4 mr-2" />
                  {timeWindowStatus.message.includes('not scheduled') ? 'Not Scheduled Today' : 'Outside Time Window'}
                </>
              ) : (timeWindowStatus && timeWindowStatus.allowed) ? (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Start Session
                </>
              ) : (
                "Start Session"
              )}
            </Button>
          </div>
        </>
      )}

      {/* TEST SECTION - No Logic, Always Enabled */}
      {step === 'filter' && (
        <>
          <Card className="border-4 border-orange-500 bg-orange-50/50">
            <CardHeader>
              <CardTitle className="text-orange-700 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                TEST SECTION (No Validation)
              </CardTitle>
              <CardDescription className="text-orange-600">
                This section has no logic checks - for testing purposes only
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Display current filter values */}
              <div className="bg-white p-4 rounded-lg border-2 border-orange-300">
                <h3 className="font-semibold text-sm mb-3 text-orange-700">Current Selection:</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Semester:</span>
                    <p className="font-bold">{filterSemester || 'Not selected'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Department:</span>
                    <p className="font-bold">{filterDept || 'Not selected'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Section:</span>
                    <p className="font-bold">{filterSection || 'Not selected'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Subject:</span>
                    <p className="font-bold">{filterSubject || 'Not selected'}</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-center">
                <Button 
                  size="lg" 
                  onClick={() => {
                    // Clear previous images when starting new session
                    setCapturedImages([]);
                    setOriginalImages([]);
                    setImageSizes([]);
                    setEnhancementModes([]);
                    setAnnotatedImages([]);
                    setCapturedImageUrl('');
                    setSavedImagePath('');
                    
                    setStep('capture');
                    
                    toast({
                      title: "Test Session Started",
                      description: "No validation checks applied - for testing only",
                    });
                  }}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Start Test Session (No Checks)
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {step === 'capture' && (
        <Card className="max-w-4xl mx-auto">
          <CardContent className="p-6 space-y-6">
            {/* Back Button */}
            <div className="flex justify-start">
              <Button 
                variant="outline" 
                onClick={() => {
                  setCapturedImages([]);
                  setOriginalImages([]);
                  setImageSizes([]);
                  setEnhancementModes([]);
                  setAnnotatedImages([]);
                  setIsCameraOpen(false);
                  setStep('filter');
                }}
                className="gap-2"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
            </div>
            
            {/* Simple Status */}
            <div className="flex items-center justify-center gap-2 text-sm">
              <div className="w-2 h-2 rounded-full bg-green-400"></div>
              <span className="text-green-600 font-medium">Camera Ready - Capture or upload group photos</span>
            </div>

            {/* Camera View */}
            {isCameraOpen && (
              <div className="space-y-4">
                <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden border-4 border-green-500">
                  <Webcam 
                    ref={webcamRef}
                    className="w-full h-full object-cover"
                    screenshotFormat="image/jpeg"
                  />
                  {processing && <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white"><Loader2 className="animate-spin mb-2 h-8 w-8"/>Capturing...</div>}
                </div>
                
                {/* Capture from Camera Button */}
                <Button 
                  size="lg" 
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3"
                  onClick={() => {
                    try {
                      const imageSrc = webcamRef.current?.getScreenshot();
                      if (imageSrc) {
                        setCapturedImages(prev => [...prev, imageSrc]);
                        setOriginalImages(prev => [...prev, imageSrc]); // Store original
                        setImageSizes(prev => [...prev, getImageSize(imageSrc)]); // Store size
                        setEnhancementModes(prev => [...prev, -1]); // Initialize as not enhanced
                        toast({
                          title: "Image Captured",
                          description: "Image added to gallery"
                        });
                      } else {
                        toast({
                          title: "Capture Failed",
                          description: "Unable to capture image from camera",
                          variant: "destructive"
                        });
                      }
                    } catch (error) {
                      console.error('Capture photo error:', error);
                      toast({
                        title: "Error",
                        description: "Failed to capture photo. Please try again.",
                        variant: "destructive"
                      });
                    }
                  }}
                  disabled={processing}
                >
                  <Camera className="h-5 w-5 mr-2" />
                  Capture Photo
                </Button>
              </div>
            )}

            {/* Image Gallery */}
            {capturedImages.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Captured Images ({capturedImages.length})</Label>
                <div className="grid grid-cols-1 gap-4">
                  {capturedImages.map((img, idx) => (
                    <div key={idx} className="flex flex-col gap-2">
                      {/* Image container */}
                      <div className="relative rounded-md border bg-gray-100 h-[600px]">
                        <img src={img} className="w-full h-full object-contain rounded-md" alt={`Capture ${idx + 1}`} />
                        
                        {/* Image size badge - top-left */}
                        <div className="absolute top-1 left-1 bg-black/70 text-white px-2 py-0.5 rounded text-xs font-semibold z-10">
                          {formatFileSize(imageSizes[idx] || 0)}
                        </div>
                        
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
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                      </div>
                      
                      {/* Action buttons - always visible below image */}
                      <div className="flex gap-1">
                        <button
                          onClick={() => enhanceImage(idx)}
                          className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-2 py-1.5 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1 shadow-sm"
                          title="Cycle through 4 enhancement modes"
                        >
                          {(() => {
                            const mode = enhancementModes[idx] ?? -1;
                            const icons = ['✨', '🌙', '🔥', '🎨'];
                            const labels = ['Balanced', 'Low Light', 'Warm', 'Vibrant'];
                            
                            // Show current mode if enhanced, otherwise show "Enhance"
                            if (mode >= 0 && mode < 4) {
                              return (
                                <>
                                  <span>{icons[mode]}</span>
                                  <span>{labels[mode]}</span>
                                </>
                              );
                            } else {
                              return (
                                <>
                                  <span>✨</span>
                                  <span>Enhance</span>
                                </>
                              );
                            }
                          })()}
                        </button>
                        <button
                          onClick={() => resetImage(idx)}
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
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4 w-full">
              <Button 
                variant={isCameraOpen ? "outline" : "default"} 
                onClick={() => {
                  setIsCameraOpen(!isCameraOpen);
                }} 
                className="flex-1"
              >
                {isCameraOpen ? "Close Camera" : "Open Camera"}
              </Button>
              <Button 
                variant="outline"
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'image/*';
                  input.multiple = true;
                  input.onchange = (e) => handleImageUpload(e as any);
                  input.click();
                }}
                className="flex-1"
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload Images
              </Button>
            </div>

            {/* Capture Button */}
            <Button 
              size="lg" 
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-4 px-8 rounded-lg" 
              onClick={handleCapture} 
              disabled={processing || capturedImages.length === 0}
            >
              {processing ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Camera className="h-5 w-5 mr-2" />
                  <span>Process Attendance ({capturedImages.length} image{capturedImages.length !== 1 ? 's' : ''})</span>
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 'review' && (
        <div className="space-y-6 max-w-6xl mx-auto">
          {/* Teacher Info Box */}
          <Card className="border-2 border-green-500 bg-gradient-to-r from-green-50 to-green-100">
            <CardContent className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Teacher ID</p>
                  <p className="text-lg font-bold text-foreground">{currentUser?.username || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Semester</p>
                  <p className="text-lg font-bold text-foreground">{filterSemester}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Department</p>
                  <p className="text-lg font-bold text-foreground">{filterDept}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Section</p>
                  <p className="text-lg font-bold text-foreground">{filterSection}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Subject</p>
                  <p className="text-lg font-bold text-foreground">{filterSubject}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Date</p>
                  <p className="text-lg font-bold text-foreground">{format(new Date(), 'dd/MM/yyyy')}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Time</p>
                  <p className="text-lg font-bold text-foreground">{format(new Date(), 'HH:mm:ss')}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Captured Images with Annotations */}
          {annotatedImages.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Captured Images with Face Detection</CardTitle>
                <CardDescription>Green boxes = Recognized students, Red boxes = Unrecognized faces</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {annotatedImages.map((img, idx) => (
                    <div key={idx} className="flex flex-col items-center">
                      <img 
                        src={img} 
                        alt={`Annotated image ${idx + 1}`} 
                        className="max-w-full h-auto rounded-lg border-2 border-gray-300"
                        style={{ maxHeight: '500px', maxWidth: '100%' }}
                      />
                      <p className="text-sm text-muted-foreground mt-2">Image {idx + 1}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Statistics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="p-4">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Total Students</div>
                <div className="text-3xl font-bold text-blue-600">{attendanceList.length}</div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-green-500">
              <CardContent className="p-4">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Present</div>
                <div className="text-3xl font-bold text-green-600">{attendanceList.filter(s => s.status === 'present').length}</div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-red-500">
              <CardContent className="p-4">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Absent</div>
                <div className="text-3xl font-bold text-red-600">{attendanceList.filter(s => s.status === 'absent').length}</div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-purple-500">
              <CardContent className="p-4">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Recognition Accuracy</div>
                <div className="text-3xl font-bold text-purple-600">95.2%</div>
              </CardContent>
            </Card>
          </div>

          {/* Student List */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Student Records</CardTitle>
              <CardDescription>Students enrolled in {filterSubject} - Click to mark Present/Absent</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-gray-300">
                      <th className="text-left p-3 font-bold">USN</th>
                      <th className="text-left p-3 font-bold">Name</th>
                      <th className="text-left p-3 font-bold">Department</th>
                      <th className="text-left p-3 font-bold">Section</th>
                      <th className="text-left p-3 font-bold">Status</th>
                      <th className="text-left p-3 font-bold">Confidence</th>
                      <th className="text-left p-3 font-bold">Emotion</th>
                      <th className="text-left p-3 font-bold">Attentiveness</th>
                      <th className="text-left p-3 font-bold">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceList.map((student, idx) => (
                      <tr key={student.id} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-mono font-semibold text-primary">{student.id}</td>
                        <td className="p-3 font-medium">{student.name}</td>
                        <td className="p-3">{filterDept}</td>
                        <td className="p-3">{filterSection}</td>
                        <td className="p-3">
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant={student.status === 'absent' ? 'default' : 'outline'}
                              className={cn(
                                "text-xs font-bold",
                                student.status === 'absent'
                                  ? "bg-red-600 hover:bg-red-700 text-white"
                                  : "border-red-300 text-red-600 hover:bg-red-50"
                              )}
                              onClick={() => {
                                const updated = [...attendanceList];
                                updated[idx].status = 'absent';
                                updated[idx].markedBy = 'manual'; // Mark as manual change
                                setAttendanceList(updated);
                              }}
                            >
                              Absent
                            </Button>
                            <Button
                              size="sm"
                              variant={student.status === 'present' ? 'default' : 'outline'}
                              className={cn(
                                "text-xs font-bold",
                                student.status === 'present'
                                  ? "bg-green-600 hover:bg-green-700 text-white"
                                  : "border-green-300 text-green-600 hover:bg-green-50"
                              )}
                              onClick={() => {
                                const updated = [...attendanceList];
                                updated[idx].status = 'present';
                                updated[idx].markedBy = 'manual'; // Mark as manual change
                                setAttendanceList(updated);
                              }}
                            >
                              Present
                            </Button>
                          </div>
                        </td>
                        <td className="p-3">
                          {student.confidence !== null ? (
                            <span className={cn(
                              "text-xs font-semibold px-2 py-1 rounded",
                              student.confidence >= 80 ? "bg-green-100 text-green-700" :
                              student.confidence >= 60 ? "bg-yellow-100 text-yellow-700" :
                              "bg-orange-100 text-orange-700"
                            )}>
                              {student.confidence}%
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="p-3">
                          {student.emotion ? (
                            <span className="text-xs font-medium px-2 py-1 rounded bg-blue-100 text-blue-700 capitalize">
                              {student.emotion}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="p-3">
                          {student.attentiveness ? (
                            <span className={cn(
                              "text-xs font-semibold px-2 py-1 rounded capitalize",
                              student.attentiveness === 'High' ? "bg-green-100 text-green-700" :
                              student.attentiveness === 'Medium' ? "bg-yellow-100 text-yellow-700" :
                              "bg-orange-100 text-orange-700"
                            )}>
                              {student.attentiveness}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="p-3">
                          {student.status === 'absent' ? (
                            <Select value={student.reasonType || ''} onValueChange={(value) => {
                              const updated = [...attendanceList];
                              updated[idx].reasonType = value;
                              setAttendanceList(updated);
                            }}>
                              <SelectTrigger className="w-40 text-xs">
                                <SelectValue placeholder="Select reason" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem key={`${student.id}-medical`} value="medical">Medical Emergency</SelectItem>
                                <SelectItem key={`${student.id}-family`} value="family">Family Emergency</SelectItem>
                                <SelectItem key={`${student.id}-academic`} value="academic">Academic Activity</SelectItem>
                                <SelectItem key={`${student.id}-sports`} value="sports">Sports/NCC/NSS</SelectItem>
                                <SelectItem key={`${student.id}-internship`} value="internship">Internship/Interview</SelectItem>
                                <SelectItem key={`${student.id}-other`} value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-between items-center pt-6 border-t">
            <Button 
              variant="outline" 
              onClick={() => setStep('capture')}
              className="gap-2"
            >
              <Camera className="h-4 w-4" />
              Retake Photo
            </Button>
            <div className="flex gap-4">
              <Button 
                size="lg" 
                variant="outline"
                onClick={() => setStep('filter')}
                className="gap-2 px-6"
              >
                Cancel
              </Button>
              <Button 
                size="lg" 
                onClick={() => setShowSubmitConfirm(true)}
                disabled={processing}
                className="gap-2 px-8 bg-green-600 hover:bg-green-700"
              >
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Submit</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      <AlertDialog open={showSubmitConfirm} onOpenChange={setShowSubmitConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit Attendance?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogDescription>
            This will save attendance for {attendanceList.length} students. This action cannot be undone.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              try {
                setProcessing(true);
                const token = localStorage.getItem('token');
                if (!token) {
                  throw new Error('Authentication required');
                }

                // Prepare attendance records
                const attendanceRecords = attendanceList.map(student => ({
                  studentId: student.id,
                  status: student.status,
                  confidence: student.confidence,
                  attentiveness: student.attentiveness || null,
                  emotion: student.emotion || null,
                  reasonType: student.reasonType || null,
                  markedBy: student.markedBy || 'system' // Include markedBy field
                }));

                // Send to API
                const response = await fetch(`${API_BASE_URL}/attendance/submit`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                  },
                  body: JSON.stringify({
                    classId: filterDept,
                    sectionId: filterSection,
                    subjectName: filterSubject,
                    semester: filterSemester,
                    sessionDate: format(new Date(), 'yyyy-MM-dd'),
                    sessionTime: format(new Date(), 'HH:mm:ss'),
                    capturedImagePath: savedImagePath || null, // Use saved path instead of base64
                    totalStudents: attendanceList.length,
                    presentCount: attendanceList.filter(s => s.status === 'present').length,
                    absentCount: attendanceList.filter(s => s.status === 'absent').length,
                    recognitionAccuracy: 95.2,
                    attendanceRecords: attendanceRecords
                  })
                });

                const result = await response.json();

                if (!response.ok) {
                  throw new Error(result.message || 'Failed to submit attendance');
                }

                toast({
                  title: "Success",
                  description: "Attendance submitted successfully!",
                });

                setShowSubmitConfirm(false);
                setStep('submitted');
              } catch (error) {
                console.error('Submit error:', error);
                toast({
                  title: "Error",
                  description: error instanceof Error ? error.message : "Failed to submit attendance",
                  variant: "destructive",
                });
              } finally {
                setProcessing(false);
              }
            }}>
              Submit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {(step as string) === 'submitted' && (
        <Card className="max-w-2xl mx-auto">
          <CardContent className="p-12 text-center space-y-6">
            <div className="w-20 h-20 mx-auto bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-green-600 mb-2">Attendance Submitted Successfully!</h2>
              <p className="text-muted-foreground">
                Attendance for {attendanceList.length} students has been recorded.
              </p>
            </div>
            <div className="flex gap-4 justify-center pt-4">
              <Button 
                size="lg"
                onClick={() => {
                  setCapturedImages([]);
                  setOriginalImages([]);
                  setImageSizes([]);
                  setEnhancementModes([]);
                  setAnnotatedImages([]);
                  setAttendanceList([]);
                  setStep('filter');
                }}
              >
                Take Another Attendance
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
