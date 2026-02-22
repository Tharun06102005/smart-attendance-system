import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, User, Lock, GraduationCap, BookOpen, Users, Hash, Eye, EyeOff, CheckCircle2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SEMESTERS, DEPARTMENTS, SECTIONS, SUBJECTS_BY_DEPT_SEMESTER, API_BASE_URL } from "@/lib/constants";

export default function TeacherSignup() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    teacherId: "",
    email: "",
    phone_no: "",
    password: "",
    confirmPassword: "",
    semesters: [] as string[],
    departments: [] as string[],
    sections: [] as string[],
    subjects: [] as string[]
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  // Available options - VTU Standard (from centralized constants)
  const semesterOptions = SEMESTERS;
  const departmentOptions = DEPARTMENTS;
  const sectionOptions = SECTIONS;
  
  // Create subject groups for display (convert from SUBJECTS_BY_DEPT_SEMESTER)
  const subjectGroups = {
    "Semester 1": [
      ...SUBJECTS_BY_DEPT_SEMESTER.CS["1"],
      ...SUBJECTS_BY_DEPT_SEMESTER.IS["1"]
    ],
    "Semester 2": [
      ...SUBJECTS_BY_DEPT_SEMESTER.CS["2"],
      ...SUBJECTS_BY_DEPT_SEMESTER.IS["2"]
    ],
    "Semester 3": [
      ...SUBJECTS_BY_DEPT_SEMESTER.CS["3"],
      ...SUBJECTS_BY_DEPT_SEMESTER.IS["3"]
    ],
    "Semester 4": [
      ...SUBJECTS_BY_DEPT_SEMESTER.CS["4"],
      ...SUBJECTS_BY_DEPT_SEMESTER.IS["4"]
    ],
    "Semester 5": [
      ...SUBJECTS_BY_DEPT_SEMESTER.CS["5"],
      ...SUBJECTS_BY_DEPT_SEMESTER.IS["5"]
    ],
    "Semester 6": [
      ...SUBJECTS_BY_DEPT_SEMESTER.CS["6"],
      ...SUBJECTS_BY_DEPT_SEMESTER.IS["6"]
    ],
    "Semester 7": [
      ...SUBJECTS_BY_DEPT_SEMESTER.CS["7"],
      ...SUBJECTS_BY_DEPT_SEMESTER.IS["7"]
    ],
    "Semester 8": [
      ...SUBJECTS_BY_DEPT_SEMESTER.CS["8"],
      ...SUBJECTS_BY_DEPT_SEMESTER.IS["8"]
    ]
  };

  // Get all subjects as flat array for form handling
  const subjectOptions = Object.values(subjectGroups).flat();

  const handleNextStep = () => {
    // Validate personal information before proceeding
    if (!formData.name || !formData.teacherId || !formData.email || !formData.phone_no || !formData.password || !formData.confirmPassword) {
      toast({
        title: "Error",
        description: "Please fill in all personal information fields.",
        variant: "destructive"
      });
      return;
    }

    // Validate email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address.",
        variant: "destructive"
      });
      return;
    }

    // Validate phone number
    if (!/^\d{10}$/.test(formData.phone_no)) {
      toast({
        title: "Invalid Phone Number",
        description: "Phone number must be exactly 10 digits.",
        variant: "destructive"
      });
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Error", 
        description: "Passwords do not match.",
        variant: "destructive"
      });
      return;
    }

    if (formData.password.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters long.",
        variant: "destructive"
      });
      return;
    }

    setCurrentStep(2);
  };

  const handlePreviousStep = () => {
    setCurrentStep(1);
  };

  const handleMultiSelect = (field: keyof typeof formData, value: string) => {
    setFormData(prev => {
      const currentValue = prev[field];
      if (Array.isArray(currentValue)) {
        return {
          ...prev,
          [field]: currentValue.includes(value) 
            ? currentValue.filter((item: string) => item !== value)
            : [...currentValue, value]
        };
      }
      return prev;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation for teaching information
    if (formData.semesters.length === 0 || formData.departments.length === 0 || 
        formData.sections.length === 0 || formData.subjects.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one option for semesters, departments, sections, and subjects.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register/teacher`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          teacherId: formData.teacherId,
          email: formData.email,
          phone_no: formData.phone_no,
          password: formData.password,
          semesters: formData.semesters,
          departments: formData.departments,
          sections: formData.sections,
          subjects: formData.subjects
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Success!",
          description: "Teacher account created successfully. You can now login.",
        });
        setLocation("/");
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
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 p-4">
      <div className="max-w-4xl mx-auto">
        <Card className="border-t-4 border-t-primary shadow-xl relative">
          <CardHeader className="text-center space-y-4 pb-6">
            {/* Back to Main Button - Inside Box, Top Right Corner */}
            <div className="absolute top-4 right-4">
              <button
                type="button"
                onClick={() => setLocation("/")}
                className="flex items-center gap-2 px-3 py-2 text-xs border border-border rounded-md bg-background hover:bg-muted transition-colors focus:outline-none"
              >
                <ArrowLeft className="h-3 w-3" />
                Back to Main
              </button>
            </div>

            <div className="mx-auto w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center border-2 border-primary/20">
              <GraduationCap className="w-10 h-10 text-primary" />
            </div>
            <div>
              <CardTitle className="text-2xl font-serif font-bold text-primary">Teacher Registration</CardTitle>
              <CardDescription>
                {currentStep === 1 
                  ? "Step 1 of 2: Enter your personal information" 
                  : "Step 2 of 2: Select your teaching information"
                }
              </CardDescription>
            </div>

            {/* Step Indicator */}
            <div className="flex items-center justify-center gap-4 mt-4">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                currentStep >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}>
                1
              </div>
              <div className={`h-1 w-12 ${currentStep >= 2 ? 'bg-primary' : 'bg-muted'}`}></div>
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                currentStep >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}>
                2
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={currentStep === 1 ? (e) => { e.preventDefault(); handleNextStep(); } : handleSubmit} className="space-y-6">
              {currentStep === 1 && (
                /* Personal Information - Step 1 */
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-foreground border-b pb-2">Personal Information</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-sm font-medium">Full Name *</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="name"
                          placeholder="Enter your full name"
                          className="pl-9 h-10"
                          value={formData.name}
                          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="teacherId" className="text-sm font-medium">Teacher ID *</Label>
                      <div className="relative">
                        <Hash className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="teacherId"
                          placeholder="Enter unique teacher ID"
                          className="pl-9 h-10"
                          value={formData.teacherId}
                          onChange={(e) => setFormData(prev => ({ ...prev, teacherId: e.target.value }))}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-medium">Email *</Label>
                      <div className="relative">
                        <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <Input
                          id="email"
                          type="email"
                          placeholder="teacher@example.com"
                          className="pl-9 h-10"
                          value={formData.email}
                          onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone_no" className="text-sm font-medium">Phone Number *</Label>
                      <div className="relative">
                        <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        <Input
                          id="phone_no"
                          type="tel"
                          placeholder="9876543210"
                          maxLength={10}
                          className="pl-9 h-10"
                          value={formData.phone_no}
                          onChange={(e) => setFormData(prev => ({ ...prev, phone_no: e.target.value }))}
                          required
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">Enter 10-digit mobile number</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-sm font-medium">Password *</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Create a strong password"
                          className="pl-9 pr-10 h-10"
                          value={formData.password}
                          onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                          required
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="text-gray-400 hover:text-gray-600 focus:outline-none"
                          >
                            {showPassword ? (
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
                      <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirm Password *</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="confirmPassword"
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="Confirm your password"
                          className="pl-9 pr-10 h-10"
                          value={formData.confirmPassword}
                          onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                          required
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="text-gray-400 hover:text-gray-600 focus:outline-none"
                          >
                            {showConfirmPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 text-sm text-muted-foreground bg-amber-50 dark:bg-amber-900/20 p-3 rounded-md border border-amber-200 dark:border-amber-800">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                    <span className="text-amber-700 dark:text-amber-300 font-medium">
                      <strong>Note:</strong> Keep your password secure and do not share it with anyone.
                    </span>
                  </div>

                  {/* Next Button */}
                  <div className="flex justify-end pt-6">
                    <Button type="submit" size="lg" className="px-8">
                      Next Step
                      <ArrowLeft className="w-4 h-4 ml-2 rotate-180" />
                    </Button>
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                /* Teaching Information - Step 2 - VTU Academic System */
                <div className="space-y-8">
                  <h3 className="text-lg font-bold text-foreground border-b-2 border-primary/20 pb-3 mb-6">Teaching Information</h3>
                  
                  {/* Semesters - Clean Row Layout */}
                  <div className="space-y-4">
                    <Label className="text-base font-semibold text-foreground">Semesters *</Label>
                    <div className="bg-muted/30 p-4 rounded-lg border">
                      <div className="grid grid-cols-4 gap-6">
                        {semesterOptions.map((sem) => (
                          <div key={sem} className="flex items-center space-x-3">
                            <Checkbox
                              id={`sem-${sem}`}
                              checked={formData.semesters.includes(sem)}
                              onCheckedChange={() => handleMultiSelect('semesters', sem)}
                              className="h-4 w-4"
                            />
                            <Label htmlFor={`sem-${sem}`} className="text-sm font-medium cursor-pointer whitespace-nowrap">
                              Sem {sem}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Departments - VTU Standard */}
                  <div className="space-y-4">
                    <Label className="text-base font-semibold text-foreground">Departments *</Label>
                    <div className="bg-muted/30 p-4 rounded-lg border">
                      <div className="grid grid-cols-4 gap-8">
                        {departmentOptions.map((dept) => (
                          <div key={dept} className="flex items-center space-x-3">
                            <Checkbox
                              id={`dept-${dept}`}
                              checked={formData.departments.includes(dept)}
                              onCheckedChange={() => handleMultiSelect('departments', dept)}
                              className="h-4 w-4"
                            />
                            <Label htmlFor={`dept-${dept}`} className="text-sm font-medium cursor-pointer whitespace-nowrap">
                              {dept}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Sections - Clean Alignment */}
                  <div className="space-y-4">
                    <Label className="text-base font-semibold text-foreground">Sections *</Label>
                    <div className="bg-muted/30 p-4 rounded-lg border">
                      <div className="grid grid-cols-4 gap-8">
                        {sectionOptions.map((sec) => (
                          <div key={sec} className="flex items-center space-x-3">
                            <Checkbox
                              id={`section-${sec}`}
                              checked={formData.sections.includes(sec)}
                              onCheckedChange={() => handleMultiSelect('sections', sec)}
                              className="h-4 w-4"
                            />
                            <Label htmlFor={`section-${sec}`} className="text-sm font-medium cursor-pointer whitespace-nowrap">
                              Section {sec}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Subjects - VTU Scheme-22 Grouped */}
                  <div className="space-y-4">
                    <Label className="text-base font-semibold text-foreground">Subjects * <span className="text-xs font-normal text-muted-foreground">(VTU Scheme-22 CSE)</span></Label>
                    <div className="bg-muted/30 p-6 rounded-lg border">
                      <div className="space-y-6">
                        {Object.entries(subjectGroups).map(([groupName, subjects]) => (
                          <div key={groupName} className="space-y-3">
                            {/* Group Header */}
                            <div className="border-b border-border/50 pb-2">
                              <h4 className="text-sm font-semibold text-primary uppercase tracking-wide">
                                {groupName}
                              </h4>
                            </div>
                            
                            {/* Subjects Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-2">
                              {subjects.map((subject) => (
                                <div key={subject} className="flex items-center space-x-3">
                                  <Checkbox
                                    id={`subject-${subject}`}
                                    checked={formData.subjects.includes(subject)}
                                    onCheckedChange={() => handleMultiSelect('subjects', subject)}
                                    className="h-4 w-4"
                                  />
                                  <Label htmlFor={`subject-${subject}`} className="text-sm font-medium cursor-pointer leading-tight">
                                    {subject}
                                  </Label>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Navigation Buttons */}
                  <div className="flex justify-between pt-8 border-t border-border/30">
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="lg" 
                      onClick={handlePreviousStep}
                      className="px-8 font-medium"
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Previous Step
                    </Button>
                    
                    <Button 
                      type="submit" 
                      size="lg" 
                      className="px-8 font-medium"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Creating Account...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Create Teacher Account
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}