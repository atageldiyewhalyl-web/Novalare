import { motion, useScroll, useTransform } from "motion/react";
import { ArrowRight, Menu, X, LogIn } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { smoothScrollTo } from "../utils/smoothScroll";
import { ConsultationModal } from "./ConsultationModal";
import { useAuth } from "../contexts/AuthContext";

export function Header() {
  const { scrollY } = useScroll();
  const { user } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();



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
          onClick={handleLogoClick}
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
            onClick={() => navigate('/features')}
            className="text-white/70 hover:text-white transition-colors duration-300"
            style={{
              fontSize: 'clamp(14px, 1.5vw, 16px)',
              fontWeight: '500',
              fontFamily: "'Manrope', sans-serif",
            }}
          >
            Features
          </button>
          <button
            onClick={() => navigate('/pricing')}
            className="text-white/70 hover:text-white transition-colors duration-300"
            style={{
              fontSize: 'clamp(14px, 1.5vw, 16px)',
              fontWeight: '500',
              fontFamily: "'Manrope', sans-serif",
            }}
          >
            Pricing
          </button>
          <button
            onClick={() => handleNavClick('#demos')}
            className="text-white/70 hover:text-white transition-colors duration-300"
            style={{
              fontSize: 'clamp(14px, 1.5vw, 16px)',
              fontWeight: '500',
              fontFamily: "'Manrope', sans-serif",
            }}
          >
            Demos
          </button>
          
          {/* Dashboard Button - Only visible when logged in */}
          {user && (
            <button
              onClick={() => navigate('/dashboard')}
              className="text-purple-400/90 hover:text-purple-300 transition-colors duration-300 relative group"
              style={{
                fontSize: 'clamp(14px, 1.5vw, 16px)',
                fontWeight: '600',
                fontFamily: "'Manrope', sans-serif",
              }}
            >
              <span className="relative flex items-center gap-1">
                Dashboard
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-purple-400 to-fuchsia-400 group-hover:w-full transition-all duration-300"></span>
              </span>
            </button>
          )}
        </motion.nav>

        {/* Right side - Auth Buttons or CTA + Mobile Menu Toggle */}
        <div className="flex items-center gap-3">
          {!user ? (
            <>
              {/* Login Button - Desktop */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="hidden md:block"
              >
                <button
                  onClick={() => navigate('/login')}
                  className="inline-flex items-center gap-2 px-4 py-2 text-white/70 hover:text-white transition-colors duration-300"
                  style={{
                    fontSize: 'clamp(14px, 1.5vw, 16px)',
                    fontWeight: '500',
                    fontFamily: "'Manrope', sans-serif",
                  }}
                >
                  <LogIn className="w-4 h-4" />
                  <span>Log In</span>
                </button>
              </motion.div>

              {/* Book Consultation Button */}
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
                    Book Consultation
                  </span>
                  <ArrowRight className="w-4 h-4 text-white transition-transform duration-300 group-hover:translate-x-0.5 hidden sm:block" strokeWidth={2.5} />
                </button>
              </motion.div>
            </>
          ) : (
            /* User Logged In - Show Dashboard Button */
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <button
                onClick={() => navigate('/dashboard')}
                className="group inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-full transition-all duration-300 hover:scale-105 active:scale-95"
                style={{
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%)',
                  boxShadow: '0 4px 16px rgba(139, 92, 246, 0.4)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(139, 92, 246, 0.6)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(139, 92, 246, 0.4)';
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
                  Go to Dashboard
                </span>
                <ArrowRight className="w-4 h-4 text-white transition-transform duration-300 group-hover:translate-x-0.5 hidden sm:block" strokeWidth={2.5} />
              </button>
            </motion.div>
          )}
          
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
    </motion.header>

    {/* Mobile Menu Overlay */}
    {isMobileMenuOpen && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-black md:hidden"
      >
        {/* Top Bar with Logo, Dashboard Button, and Close */}
        <div className="absolute top-0 left-0 right-0 px-4 py-4 flex items-center justify-between">
          {/* Logo */}
          <span
            style={{
              fontSize: '24px',
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
          </span>

          {/* Right Side: Dashboard button + Close */}
          <div className="flex items-center gap-3">
            {user && (
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  navigate('/dashboard');
                }}
                className="px-5 py-2 rounded-full transition-all duration-300"
                style={{
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%)',
                  boxShadow: '0 4px 16px rgba(139, 92, 246, 0.4)',
                }}
              >
                <span
                  className="text-white whitespace-nowrap"
                  style={{
                    fontSize: '14px',
                    fontWeight: '700',
                    fontFamily: "'Outfit', sans-serif",
                  }}
                >
                  Go to Dashboard
                </span>
              </button>
            )}
            
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-all duration-300"
              aria-label="Close menu"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        <motion.nav
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col items-center justify-center h-full gap-6 px-6 pt-20 pb-32"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              setIsMobileMenuOpen(false);
              navigate('/features');
            }}
            className="text-gray-400 hover:text-white transition-colors duration-300 w-full text-center py-3"
            style={{
              fontSize: '20px',
              fontWeight: '500',
              fontFamily: "'Outfit', sans-serif",
            }}
          >
            Features
          </button>
          <button
            onClick={() => {
              setIsMobileMenuOpen(false);
              navigate('/pricing');
            }}
            className="text-gray-400 hover:text-white transition-colors duration-300 w-full text-center py-3"
            style={{
              fontSize: '20px',
              fontWeight: '500',
              fontFamily: "'Outfit', sans-serif",
            }}
          >
            Pricing
          </button>
          <button
            onClick={() => handleNavClick('#demos')}
            className="text-gray-400 hover:text-white transition-colors duration-300 w-full text-center py-3"
            style={{
              fontSize: '20px',
              fontWeight: '500',
              fontFamily: "'Outfit', sans-serif",
            }}
          >
            Demos
          </button>
          
          {/* Dashboard - Highlighted in gradient text */}
          {user && (
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                navigate('/dashboard');
              }}
              className="w-full text-center py-3 transition-colors duration-300"
              style={{
                fontSize: '20px',
                fontWeight: '700',
                fontFamily: "'Outfit', sans-serif",
                background: 'linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Dashboard
            </button>
          )}
          
          {/* Login Link - if not logged in */}
          {!user && (
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                navigate('/login');
              }}
              className="text-gray-400 hover:text-white transition-colors duration-300 w-full text-center py-3"
              style={{
                fontSize: '18px',
                fontWeight: '500',
                fontFamily: "'Outfit', sans-serif",
              }}
            >
              Log In
            </button>
          )}
        </motion.nav>

        {/* Bottom CTA Button */}
        <div className="absolute bottom-8 left-0 right-0 px-6">
          {user ? (
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                navigate('/dashboard');
              }}
              className="w-full group inline-flex items-center justify-center gap-3 px-8 py-4 rounded-full transition-all duration-300 active:scale-95"
              style={{
                background: 'linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%)',
                boxShadow: '0 8px 32px rgba(139, 92, 246, 0.6)',
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
                Go to Dashboard
              </span>
              <ArrowRight className="w-5 h-5 text-white" strokeWidth={2.5} />
            </button>
          ) : (
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                setIsModalOpen(true);
              }}
              className="w-full group inline-flex items-center justify-center gap-3 px-8 py-4 rounded-full transition-all duration-300 active:scale-95"
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
                Book Consultation
              </span>
              <ArrowRight className="w-5 h-5 text-white" strokeWidth={2.5} />
            </button>
          )}
        </div>
      </motion.div>
    )}
    
    {/* Consultation Modal */}
    <ConsultationModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}