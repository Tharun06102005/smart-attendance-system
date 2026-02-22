import { useState, useEffect } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DarkModeToggle() {
  const [isDark, setIsDark] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    // Check if user has a preference stored
    const stored = localStorage.getItem('darkMode');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    const shouldBeDark = stored ? stored === 'true' : prefersDark;
    setIsDark(shouldBeDark);
    
    // Apply theme with smooth transition
    applyTheme(shouldBeDark, false);
  }, []);

  const applyTheme = (darkMode: boolean, animate: boolean = true) => {
    const root = document.documentElement;
    
    if (animate) {
      // Add smooth transition for theme change
      root.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
      
      // Add a subtle flash effect
      const flash = document.createElement('div');
      flash.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: ${darkMode ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)'};
        pointer-events: none;
        z-index: 9999;
        opacity: 1;
        transition: opacity 0.3s ease-out;
      `;
      document.body.appendChild(flash);
      
      setTimeout(() => {
        flash.style.opacity = '0';
        setTimeout(() => document.body.removeChild(flash), 300);
      }, 50);
    }
    
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    
    if (animate) {
      setTimeout(() => {
        root.style.transition = '';
      }, 400);
    }
  };

  const toggleDarkMode = () => {
    if (isTransitioning) return;
    
    setIsTransitioning(true);
    const newDarkMode = !isDark;
    setIsDark(newDarkMode);
    
    // Apply theme with animation
    applyTheme(newDarkMode, true);
    
    // Store preference
    localStorage.setItem('darkMode', newDarkMode.toString());
    
    // Reset transition state
    setTimeout(() => {
      setIsTransitioning(false);
    }, 400);
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleDarkMode}
      disabled={isTransitioning}
      className={`
        h-10 w-10 rounded-full relative overflow-hidden group
        transition-all duration-300 ease-out
        hover:scale-110 active:scale-95
        ${isDark 
          ? 'bg-gradient-to-br from-green-400/10 to-emerald-400/10 hover:from-green-400/20 hover:to-emerald-400/20' 
          : 'bg-gradient-to-br from-slate-100 to-slate-200 hover:from-slate-200 hover:to-slate-300'
        }
        ${isTransitioning ? 'animate-pulse' : ''}
      `}
      title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
    >
      {/* Background glow effect */}
      <div className={`
        absolute inset-0 rounded-full transition-all duration-500
        ${isDark 
          ? 'bg-gradient-to-br from-green-400/20 to-emerald-400/20 shadow-lg shadow-green-400/25' 
          : 'bg-gradient-to-br from-slate-300/50 to-slate-400/50 shadow-md shadow-slate-400/25'
        }
        opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100
      `} />
      
      {/* Icon container with rotation animation */}
      <div className={`
        relative z-10 transition-all duration-500 ease-out
        ${isTransitioning ? 'rotate-180 scale-75' : 'rotate-0 scale-100'}
      `}>
        {isDark ? (
          <Sun className={`
            h-5 w-5 transition-all duration-300
            text-green-400 drop-shadow-sm
            ${isTransitioning ? 'animate-spin' : ''}
          `} />
        ) : (
          <Moon className={`
            h-5 w-5 transition-all duration-300
            text-slate-600 drop-shadow-sm
            ${isTransitioning ? 'animate-pulse' : ''}
          `} />
        )}
      </div>
      
      {/* Ripple effect on click */}
      <div className={`
        absolute inset-0 rounded-full
        bg-gradient-to-br ${isDark ? 'from-green-400/30 to-emerald-400/30' : 'from-slate-400/30 to-slate-500/30'}
        scale-0 group-active:scale-100 
        transition-transform duration-200 ease-out
      `} />
      
      {/* Subtle border highlight */}
      <div className={`
        absolute inset-0 rounded-full border transition-all duration-300
        ${isDark 
          ? 'border-green-400/20 group-hover:border-green-400/40' 
          : 'border-slate-300/40 group-hover:border-slate-400/60'
        }
      `} />
    </Button>
  );
}