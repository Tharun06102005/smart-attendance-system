import { Link, useLocation } from "wouter";
import { useStore } from "@/lib/store";
import { 
  LayoutDashboard, 
  BarChart3, 
  LogOut, 
  Menu,
  X,
  Calendar,
  Camera,
  Database,
  Users,
  BookOpen,
  CalendarClock,
  CheckCircle2
} from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import DarkModeToggle from "@/components/DarkModeToggle";
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
import { cn } from "@/lib/utils";

// Scroll Indicator Component
function ScrollIndicators() {
  const [showBottomIndicator, setShowBottomIndicator] = useState(false);
  const [showTopIndicator, setShowTopIndicator] = useState(false);
  const [showHorizontalIndicator, setShowHorizontalIndicator] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = document.documentElement.clientHeight;
      
      // Show bottom indicator if there's more content below (very sensitive)
      const canScrollDown = scrollTop + clientHeight < scrollHeight - 5;
      setShowBottomIndicator(canScrollDown);
      
      // Show top indicator if user has scrolled down (very sensitive)
      const canScrollUp = scrollTop > 5;
      setShowTopIndicator(canScrollUp);
    };

    const checkHorizontalScroll = () => {
      const scrollableElements = document.querySelectorAll('.overflow-x-auto, table');
      let hasHorizontalScroll = false;
      
      scrollableElements.forEach(element => {
        if (element.scrollWidth > element.clientWidth + 5) {
          hasHorizontalScroll = true;
        }
      });
      
      setShowHorizontalIndicator(hasHorizontalScroll);
    };

    // Initial checks with multiple attempts to ensure DOM is ready
    const initializeIndicators = () => {
      handleScroll();
      checkHorizontalScroll();
      
      // Force check if page has scrollable content
      const hasVerticalScroll = document.documentElement.scrollHeight > document.documentElement.clientHeight + 5;
      const currentScroll = window.pageYOffset || document.documentElement.scrollTop;
      
      if (hasVerticalScroll) {
        // If at top and can scroll down, show bottom indicator
        if (currentScroll < 5) {
          setShowBottomIndicator(true);
        }
        // If scrolled down, show top indicator
        if (currentScroll > 5) {
          setShowTopIndicator(true);
        }
      }
    };

    // Try multiple times with different delays
    setTimeout(initializeIndicators, 100);
    setTimeout(initializeIndicators, 500);
    setTimeout(initializeIndicators, 1000);
    setTimeout(initializeIndicators, 2000);
    
    // Add listeners
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', () => {
      handleScroll();
      checkHorizontalScroll();
    });
    
    // Check for dynamic content changes
    const observer = new MutationObserver(() => {
      setTimeout(() => {
        handleScroll();
        checkHorizontalScroll();
      }, 100);
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    
    // Cleanup
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
      window.removeEventListener('resize', checkHorizontalScroll);
      observer.disconnect();
    };
  }, []);

  return (
    <>
      {/* Bottom Scroll Indicator - Moving Circle Ball */}
      <div className={cn("scroll-indicator-bottom-unique", showBottomIndicator && "show")}>
        <div className="scroll-visual-bottom"></div>
      </div>
      
      {/* Top Scroll Indicator - Moving Circle Ball */}
      <div className={cn("scroll-indicator-top-unique", showTopIndicator && "show")}>
        <div className="scroll-visual-top"></div>
      </div>
      
      {/* Horizontal Scroll Indicator - Moving Circle Ball */}
      <div className={cn("scroll-indicator-horizontal-unique", showHorizontalIndicator && "show")}>
        <div className="scroll-visual-horizontal"></div>
      </div>
    </>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { currentUser, logout } = useStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!currentUser) return <>{children}</>;

  const handleLogout = () => {
    logout();
    setLocation("/");
  };

  const isTeacher = currentUser.role === 'teacher';
  const isAdmin = currentUser.role === 'admin';
  const isStudent = currentUser.role === 'student';

  const menuItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
    ...(isAdmin ? [
      { icon: Users, label: "Manage Teachers", href: "/admin" },
      { icon: BookOpen, label: "Manage Students", href: "/students" },
      { icon: Calendar, label: "Manage Timetable", href: "/timetable-manage" },
      { icon: Database, label: "DBMS Values", href: "/dbms-values" },
    ] : []),
    ...(isTeacher ? [
      { icon: Camera, label: "Take Attendance", href: "/attendance" },
      { icon: BookOpen, label: "View/Edit Attendance", href: "/attendance-records" },
      { icon: BarChart3, label: "Attendance Analysis", href: "/analysis" },
      { icon: Calendar, label: "Timetable", href: "/timetable" },
    ] : []),
    ...(isStudent ? [
      { icon: Calendar, label: "Timetable", href: "/timetable" },
      { icon: CheckCircle2, label: "View Attendance", href: "/student-attendance" },
      { icon: BarChart3, label: "Attendance Analysis", href: "/analysis" },
    ] : []),
  ];

  const toggleSidebar = () => {
    if (window.innerWidth < 768) {
      setIsSidebarOpen(!isSidebarOpen);
    } else {
      setIsCollapsed(!isCollapsed);
    }
  };

  return (
    <div className="min-h-screen bg-background flex font-sans text-foreground overflow-hidden h-screen">
      {/* Sidebar Overlay for Mobile */}
      {isSidebarOpen && window.innerWidth < 768 && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar - LEFT SIDE (YouTube-like) */}
      <aside 
        className={cn(
          "fixed md:relative z-50 h-full bg-card border-r shadow-sm transition-all duration-300 ease-in-out shrink-0 overflow-hidden",
          window.innerWidth < 768 
            ? (isSidebarOpen ? "w-64 translate-x-0" : "w-0 -translate-x-full")
            : (isCollapsed ? "w-20" : "w-64")
        )}
      >
        <div className="flex flex-col h-full w-64">
          <div className="p-4 flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={toggleSidebar} className="shrink-0">
              <Menu className="h-5 w-5" />
            </Button>
            <div className={cn("flex items-center gap-2 transition-opacity", isCollapsed && "md:opacity-0")}>
              <img src="/src/assets/logo.png" className="w-8 h-8 object-contain" alt="Logo" />
              <h1 className="font-serif font-bold text-lg text-primary leading-none">SKIT</h1>
            </div>
          </div>

          <nav className="flex-1 px-3 space-y-1 mt-4">
            {menuItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <div 
                  className={cn(
                    "flex items-center gap-4 px-3 py-3 rounded-lg text-sm font-medium transition-all duration-200 group hover:scale-[1.02] active:scale-[0.98] cursor-pointer",
                    location === item.href 
                      ? "bg-primary text-primary-foreground shadow-sm" 
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                  onClick={(e) => {
                    if (window.innerWidth < 768) {
                      setIsSidebarOpen(false);
                    }
                  }}
                >
                  <item.icon className="w-5 h-5 shrink-0" />
                  <span className={cn("transition-opacity duration-300", isCollapsed && "md:hidden")}>
                    {item.label}
                  </span>
                </div>
              </Link>
            ))}
          </nav>

          <div className="p-3 mt-auto border-t">
            <Button 
              variant="ghost" 
              className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10 gap-4 px-3 py-3"
              onClick={() => setShowLogoutConfirm(true)}
            >
              <LogOut className="w-5 h-5 shrink-0" />
              <span className={cn(isCollapsed && "md:hidden")}>Logout</span>
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="h-14 border-b bg-card flex items-center px-4 md:px-6 shrink-0 gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggleSidebar}
            className={cn("shrink-0", window.innerWidth >= 768 && "hidden")}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2 overflow-hidden flex-1">
             <p className="text-sm font-medium text-muted-foreground truncate">System: Online | Local Storage Active</p>
          </div>
          <div className="flex items-center gap-2">
            <DarkModeToggle />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-muted/20 md:p-8 p-4">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      <AlertDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to logout?</AlertDialogTitle>
            <AlertDialogDescription>
              Your current session will be ended. You will need to login again to access the portal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Yes, Logout
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Scroll Indicators */}
      <ScrollIndicators />
    </div>
  );
}
