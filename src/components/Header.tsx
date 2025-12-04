import { motion, useScroll, useTransform } from "motion/react";
import { ArrowRight, Menu, X } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { smoothScrollTo } from "../utils/smoothScroll";
import { ConsultationModal } from "./ConsultationModal";
import { DevPasswordModal } from "./DevPasswordModal";
import { toast } from "sonner@2.0.3";

export function Header() {
  const { scrollY } = useScroll();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDevPasswordModalOpen, setIsDevPasswordModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [devModeEnabled, setDevModeEnabled] = useState(false);
  const [logoClickCount, setLogoClickCount] = useState(0);
  const [keyPressCount, setKeyPressCount] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();

  // Check localStorage for dev mode on mount
  useEffect(() => {
    const devMode = localStorage.getItem('novalare_dev_mode') === 'true';
    setDevModeEnabled(devMode);
  }, []);

  // Secret keyboard shortcut: Press 'd' 3 times quickly
  useEffect(() => {
    let keyTimeout: NodeJS.Timeout;
    
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'd') {
        clearTimeout(keyTimeout);
        const newCount = keyPressCount + 1;
        setKeyPressCount(newCount);
        
        if (newCount >= 3) {
          toggleDevMode();
          setKeyPressCount(0);
        } else {
          keyTimeout = setTimeout(() => setKeyPressCount(0), 1000);
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      clearTimeout(keyTimeout);
    };
  }, [keyPressCount, devModeEnabled]);

  const toggleDevMode = () => {
    // If already enabled, disable it
    if (devModeEnabled) {
      setDevModeEnabled(false);
      localStorage.setItem('novalare_dev_mode', 'false');
      toast.info('🔒 Developer Mode Disabled', {
        description: 'Dev Portal hidden',
        duration: 2000,
      });
    } else {
      // If not enabled, show password prompt
      setIsDevPasswordModalOpen(true);
    }
  };

  const handleDevPasswordSuccess = () => {
    setDevModeEnabled(true);
    localStorage.setItem('novalare_dev_mode', 'true');
  };

  // Track scroll position
  useEffect(() => {
    const updateScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    
    window.addEventListener("scroll", updateScroll);
    return () => window.removeEventListener("scroll", updateScroll);
  }, []);

  // Prevent scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMobileMenuOpen]);

  const backgroundColor = useTransform(
    scrollY,
    [0, 100],
    ["rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0.8)"]
  );

  const borderOpacity = useTransform(
    scrollY,
    [0, 100],
    [0, 0.1]
  );

  const handleNavClick = (href: string) => {
    setIsMobileMenuOpen(false);
    
    // If we're on the invoice demo page, navigate to home first
    if (location.pathname !== '/') {
      navigate('/');
      // Wait for navigation to complete before scrolling
      setTimeout(() => {
        const element = document.querySelector(href);
        if (element) {
          const offset = 80; // Header height
          const elementPosition = element.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.pageYOffset - offset;
          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
          });
        }
      }, 100);
    } else {
      // Already on homepage, just scroll
      setTimeout(() => {
        const element = document.querySelector(href);
        if (element) {
          const offset = 80; // Header height
          const elementPosition = element.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.pageYOffset - offset;
          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
          });
        }
      }, 100);
    }
  };

  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsMobileMenuOpen(false);
    if (location.pathname !== '/') {
      navigate('/');
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Secret logo click: Click 3 times quickly
    const newCount = logoClickCount + 1;
    setLogoClickCount(newCount);
    
    if (newCount >= 3) {
      toggleDevMode();
      setLogoClickCount(0);
    } else {
      setTimeout(() => setLogoClickCount(0), 1000);
    }
  };

  return (
    <>
    <motion.header
      className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-6 md:px-8 py-4 transition-all duration-300"
      style={{
        backgroundColor,
        backdropFilter: isScrolled ? "blur(20px)" : "blur(0px)",
        WebkitBackdropFilter: isScrolled ? "blur(20px)" : "blur(0px)",
      }}
    >
      <motion.div
        className="border-b transition-all duration-300"
        style={{
          borderColor: `rgba(255, 255, 255, ${borderOpacity})`,
        }}
      />
      
      <div className="max-w-[1400px] mx-auto flex items-center justify-between">
        {/* Logo */}
        <motion.a
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          onClick={(e) => {
            e.preventDefault();
            // Logo click counter for dev mode
            const newCount = logoClickCount + 1;
            setLogoClickCount(newCount);
            
            if (newCount >= 3) {
              toggleDevMode();
              setLogoClickCount(0);
            } else {
              setTimeout(() => setLogoClickCount(0), 1000);
            }
            
            // Navigate to home if not already there
            if (location.pathname !== '/') {
              navigate('/');
            }
          }}
          className="relative group cursor-pointer"
        >
          <span
            className="relative z-10"
            style={{
              fontSize: 'clamp(24px, 3vw, 32px)',
              fontWeight: '800',
              fontFamily: "'Outfit', sans-serif",
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              letterSpacing: '-0.02em',
            }}
          >
            Novalare
            <span
              className="absolute -inset-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              style={{
                background: 'radial-gradient(circle, rgba(147, 51, 234, 0.2) 0%, transparent 70%)',
              }}
            />
          </span>
        </motion.a>

        {/* Navigation - Hidden on mobile, visible on desktop */}
        <motion.nav
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="hidden md:flex items-center gap-8 lg:gap-10"
        >
          <button
            onClick={() => handleNavClick('#services')}
            className="text-white/70 hover:text-white transition-colors duration-300"
            style={{
              fontSize: 'clamp(14px, 1.5vw, 16px)',
              fontWeight: '500',
              fontFamily: "'Manrope', sans-serif",
            }}
          >
            Services
          </button>
          <button
            onClick={() => handleNavClick('#workflow')}
            className="text-white/70 hover:text-white transition-colors duration-300"
            style={{
              fontSize: 'clamp(14px, 1.5vw, 16px)',
              fontWeight: '500',
              fontFamily: "'Manrope', sans-serif",
            }}
          >
            Workflow
          </button>
          <button
            onClick={() => handleNavClick('#benefits')}
            className="text-white/70 hover:text-white transition-colors duration-300"
            style={{
              fontSize: 'clamp(14px, 1.5vw, 16px)',
              fontWeight: '500',
              fontFamily: "'Manrope', sans-serif",
            }}
          >
            Benefits
          </button>
          <button
            onClick={() => navigate('/invoice-demo')}
            className="text-white/70 hover:text-white transition-colors duration-300 relative group"
            style={{
              fontSize: 'clamp(14px, 1.5vw, 16px)',
              fontWeight: '500',
              fontFamily: "'Manrope', sans-serif",
            }}
          >
            <span className="relative">
              Invoice Demo
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-purple-400 to-pink-400 group-hover:w-full transition-all duration-300"></span>
            </span>
          </button>
          <button
            onClick={() => navigate('/bank-demo')}
            className="text-white/70 hover:text-white transition-colors duration-300 relative group"
            style={{
              fontSize: 'clamp(14px, 1.5vw, 16px)',
              fontWeight: '500',
              fontFamily: "'Manrope', sans-serif",
            }}
          >
            <span className="relative">
              Bank Rec Demo
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-emerald-400 to-cyan-400 group-hover:w-full transition-all duration-300"></span>
            </span>
          </button>
          
          {/* Dev Portal Button - Only visible when dev mode enabled */}
          {devModeEnabled && (
            <button
              onClick={() => navigate('/dev-portal')}
              className="text-orange-400/90 hover:text-orange-300 transition-colors duration-300 relative group"
              style={{
                fontSize: 'clamp(14px, 1.5vw, 16px)',
                fontWeight: '600',
                fontFamily: "'Manrope', sans-serif",
              }}
            >
              <span className="relative flex items-center gap-1">
                🔓 Dev Portal
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-orange-400 to-red-400 group-hover:w-full transition-all duration-300"></span>
              </span>
            </button>
          )}
        </motion.nav>

        {/* Right side - CTA Button + Mobile Menu Toggle */}
        <div className="flex items-center gap-3">
          {/* CTA Button */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <button
              onClick={() => setIsModalOpen(true)}
              className="group inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-full transition-all duration-300 hover:scale-105 active:scale-95"
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                boxShadow: '0 4px 16px rgba(102, 126, 234, 0.4)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(102, 126, 234, 0.6)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(102, 126, 234, 0.4)';
              }}
            >
              <span
                className="text-white whitespace-nowrap"
                style={{
                  fontSize: 'clamp(13px, 1.5vw, 16px)',
                  fontWeight: '700',
                  fontFamily: "'Outfit', sans-serif",
                  letterSpacing: '-0.01em',
                }}
              >
                Get Free Consulting
              </span>
              <ArrowRight className="w-4 h-4 text-white transition-transform duration-300 group-hover:translate-x-0.5 hidden sm:block" strokeWidth={2.5} />
            </button>
          </motion.div>

          {/* Mobile Menu Button */}
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-all duration-300"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? (
              <X className="w-5 h-5 text-white" />
            ) : (
              <Menu className="w-5 h-5 text-white" />
            )}
          </motion.button>
        </div>
      </div>

      {/* Consultation Modal */}
      <ConsultationModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      {/* Dev Password Modal */}
      <DevPasswordModal isOpen={isDevPasswordModalOpen} onClose={() => setIsDevPasswordModalOpen(false)} onSuccess={handleDevPasswordSuccess} />
    </motion.header>

    {/* Mobile Menu Overlay */}
    {isMobileMenuOpen && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-black/95 backdrop-blur-xl md:hidden"
        onClick={() => setIsMobileMenuOpen(false)}
      >
        <motion.nav
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col items-center justify-center h-full gap-8 px-6"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => handleNavClick('#services')}
            className="text-white/70 hover:text-white transition-colors duration-300 w-full text-center py-4"
            style={{
              fontSize: '24px',
              fontWeight: '600',
              fontFamily: "'Outfit', sans-serif",
            }}
          >
            Services
          </button>
          <button
            onClick={() => handleNavClick('#workflow')}
            className="text-white/70 hover:text-white transition-colors duration-300 w-full text-center py-4"
            style={{
              fontSize: '24px',
              fontWeight: '600',
              fontFamily: "'Outfit', sans-serif",
            }}
          >
            Workflow
          </button>
          <button
            onClick={() => handleNavClick('#benefits')}
            className="text-white/70 hover:text-white transition-colors duration-300 w-full text-center py-4"
            style={{
              fontSize: '24px',
              fontWeight: '600',
              fontFamily: "'Outfit', sans-serif",
            }}
          >
            Benefits
          </button>
          
          <button
            onClick={() => {
              setIsMobileMenuOpen(false);
              navigate('/invoice-demo');
            }}
            className="text-white/70 hover:text-white transition-colors duration-300 w-full text-center py-4"
            style={{
              fontSize: '24px',
              fontWeight: '600',
              fontFamily: "'Outfit', sans-serif",
            }}
          >
            Invoice Demo
          </button>
          
          <button
            onClick={() => {
              setIsMobileMenuOpen(false);
              navigate('/bank-demo');
            }}
            className="text-white/70 hover:text-white transition-colors duration-300 w-full text-center py-4"
            style={{
              fontSize: '24px',
              fontWeight: '600',
              fontFamily: "'Outfit', sans-serif",
            }}
          >
            Bank Rec Demo
          </button>
          
          {/* Dev Portal - Mobile Menu */}
          {devModeEnabled && (
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                navigate('/dev-portal');
              }}
              className="text-orange-400/90 hover:text-orange-300 transition-colors duration-300 w-full text-center py-4"
              style={{
                fontSize: '24px',
                fontWeight: '700',
                fontFamily: "'Outfit', sans-serif",
              }}
            >
              🔓 Dev Portal
            </button>
          )}
          
          {/* Mobile Menu CTA */}
          <button
            onClick={() => {
              setIsMobileMenuOpen(false);
              setIsModalOpen(true);
            }}
            className="group inline-flex items-center justify-center gap-3 px-8 py-4 rounded-full transition-all duration-300 hover:scale-105 active:scale-95 mt-4"
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              boxShadow: '0 8px 32px rgba(102, 126, 234, 0.6)',
            }}
          >
            <span
              className="text-white"
              style={{
                fontSize: '18px',
                fontWeight: '700',
                fontFamily: "'Outfit', sans-serif",
                letterSpacing: '-0.01em',
              }}
            >
              Get Free Consulting
            </span>
            <ArrowRight className="w-5 h-5 text-white transition-transform duration-300 group-hover:translate-x-1" strokeWidth={2.5} />
          </button>
        </motion.nav>
      </motion.div>
    )}
    </>
  );
}