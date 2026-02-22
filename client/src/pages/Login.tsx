import { useState } from "react";
import { useLocation } from "wouter";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GraduationCap, Lock, User, AlertCircle, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const [, setLocation] = useLocation();
  const { login, currentUser, logout } = useStore();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("admin");

  // If user is already logged in, show continue option
  if (currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md border-t-4 border-t-primary shadow-xl">
          <CardHeader className="text-center space-y-4 pb-2">
            <div className="mx-auto w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center overflow-hidden border-2 border-primary/20">
               <img src="/src/assets/logo.png" className="w-full h-full object-contain" alt="Logo" />
            </div>
            <div>
              <CardTitle className="text-2xl font-serif font-bold text-primary">Welcome Back!</CardTitle>
              <CardDescription>You are already logged in as {currentUser.name}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">Logged in as:</p>
              <p className="font-semibold">{currentUser.name}</p>
              <p className="text-sm text-muted-foreground capitalize">({currentUser.role})</p>
            </div>
            <div className="space-y-2">
              <Button 
                onClick={() => setLocation("/dashboard")} 
                className="w-full"
                size="lg"
              >
                Continue to Dashboard
              </Button>
              <Button 
                onClick={() => {
                  logout();
                  toast({
                    title: "Logged Out",
                    description: "You have been logged out successfully.",
                  });
                }} 
                variant="outline" 
                className="w-full"
              >
                Logout & Login as Different User
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleLogin = async (role: 'admin' | 'teacher' | 'student') => {
    if (!username || !password) {
      setError("Please enter both username and password.");
      return;
    }
    
    setIsLoading(true);
    setError("");

    try {
      const success = await login(username, password, role);
      
      if (success) {
        toast({
          title: "Login Successful",
          description: `Welcome back!`,
        });
        setLocation("/dashboard");
      } else {
        setError("Invalid credentials. Please try again.");
      }
    } catch (error) {
      console.error('Login error:', error);
      setError("Network error. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setUsername("");
    setPassword("");
    setError("");
    setShowPassword(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md border-t-4 border-t-primary shadow-xl">
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="mx-auto w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center overflow-hidden border-2 border-primary/20">
             <img src="/src/assets/logo.png" className="w-full h-full object-contain" alt="Logo" />
          </div>
          <div>
            <CardTitle className="text-2xl font-serif font-bold text-primary">SKIT Portal</CardTitle>
            <CardDescription>Smart Attendance & Academic Portal</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="admin" className="w-full" onValueChange={handleTabChange}>
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="admin">Admin</TabsTrigger>
              <TabsTrigger value="teacher">Teacher</TabsTrigger>
              <TabsTrigger value="student">Student</TabsTrigger>
            </TabsList>

            <TabsContent value="admin">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="a-username">Admin ID</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="a-username" 
                      placeholder="Enter Admin ID" 
                      className="pl-9"
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value);
                        setError("");
                      }}
                      disabled={isLoading}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="a-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="a-password" 
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••" 
                      className="pl-9 pr-10"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setError("");
                      }}
                      disabled={isLoading}
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-gray-400 hover:text-gray-600 focus:outline-none"
                        disabled={isLoading}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
                
                {error && (
                  <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                    <AlertCircle className="h-4 w-4" />
                    {error}
                  </div>
                )}

                <Button 
                  className="w-full" 
                  size="lg" 
                  onClick={() => handleLogin('admin')}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Logging in...
                    </>
                  ) : (
                    'Login as Admin'
                  )}
                </Button>

                {/* Admin info */}
                <div className="flex items-start gap-2 text-sm text-muted-foreground bg-amber-50 dark:bg-amber-900/20 p-3 rounded-md border border-amber-200 dark:border-amber-800 mt-4">
                  <Lock className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                  <div>
                    <p className="font-medium text-amber-800 dark:text-amber-200">Admin Access</p>
                    <p className="text-amber-700 dark:text-amber-300 text-xs">Default: admin / admin123</p>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="teacher">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="t-username">Teacher ID</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="t-username" 
                      placeholder="Enter Teacher ID" 
                      className="pl-9"
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value);
                        setError("");
                      }}
                      disabled={isLoading}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="t-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="t-password" 
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••" 
                      className="pl-9 pr-10"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setError("");
                      }}
                      disabled={isLoading}
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-gray-400 hover:text-gray-600 focus:outline-none"
                        disabled={isLoading}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
                
                {error && (
                  <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                    <AlertCircle className="h-4 w-4" />
                    {error}
                  </div>
                )}

                <Button 
                  className="w-full" 
                  size="lg" 
                  onClick={() => handleLogin('teacher')}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Logging in...
                    </>
                  ) : (
                    'Login as Teacher'
                  )}
                </Button>

                {/* Note about teacher registration */}
                <div className="flex items-start gap-2 text-sm text-muted-foreground bg-purple-50 dark:bg-purple-900/20 p-3 rounded-md border border-purple-200 dark:border-purple-800 mt-4">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-purple-600 dark:text-purple-400" />
                  <div>
                    <p className="font-medium text-purple-800 dark:text-purple-200">New Teacher?</p>
                    <p className="text-purple-700 dark:text-purple-300">Teacher registration is managed by the admin. Please contact the administrator to create your account.</p>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="student">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="s-username">Student ID</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="s-username" 
                      placeholder="Enter Student ID" 
                      className="pl-9" 
                      value={username}
                      onChange={(e) => {
                         setUsername(e.target.value);
                         setError("");
                      }}
                      disabled={isLoading}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="s-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="s-password" 
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••" 
                      className="pl-9 pr-10"
                      value={password}
                      onChange={(e) => {
                         setPassword(e.target.value);
                         setError("");
                      }}
                      disabled={isLoading}
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-gray-400 hover:text-gray-600 focus:outline-none"
                        disabled={isLoading}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                    <AlertCircle className="h-4 w-4" />
                    {error}
                  </div>
                )}

                <Button 
                  className="w-full" 
                  size="lg" 
                  onClick={() => handleLogin('student')}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Logging in...
                    </>
                  ) : (
                    'Login as Student'
                  )}
                </Button>

                {/* Note about student registration */}
                <div className="flex items-start gap-2 text-sm text-muted-foreground bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md border border-blue-200 dark:border-blue-800 mt-4">
                  <GraduationCap className="h-4 w-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
                  <div>
                    <p className="font-medium text-blue-800 dark:text-blue-200">New Student?</p>
                    <p className="text-blue-700 dark:text-blue-300">Student registration is managed by the admin. Please contact the administrator to create your account.</p>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter className="flex justify-center border-t py-4 bg-muted/20">
           <p className="text-xs text-muted-foreground">© 2026 Smart Attendance Portal. Offline Ready.</p>
        </CardFooter>
      </Card>
    </div>
  );
}
