import { Mail, Linkedin, Instagram, ArrowUpRight } from "lucide-react";
import { toast } from "sonner@2.0.3";
import { useNavigate } from "react-router-dom";

export const Footer = () => {
  const currentYear = new Date().getFullYear();
  const navigate = useNavigate();

  const handleSocialClick = (platform: string) => {
    toast.info(`Our ${platform} page is coming soon`, {
      duration: 3000,
      position: 'top-center',
    });
  };

  return (
    <footer className="relative w-full border-t border-white/10 bg-black overflow-hidden">
      {/* Gradient accent at top */}
      <div 
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(147, 51, 234, 0.6) 20%, rgba(249, 115, 22, 0.6) 50%, rgba(59, 130, 246, 0.6) 80%, transparent)'
        }}
      />

      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-16 md:py-20">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-12 md:gap-8 mb-16">
          
          {/* Company Info */}
          <div>
            <h3 
              className="text-white mb-3 bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text text-transparent"
              style={{
                fontWeight: '800',
                fontFamily: "'Outfit', sans-serif",
                fontSize: '24px',
                letterSpacing: '-0.02em'
              }}
            >
              Novalare
            </h3>
            <p 
              className="text-white/60 mb-8"
              style={{
                fontWeight: '500',
                fontFamily: "'Manrope', sans-serif",
                fontSize: '15px',
                lineHeight: '1.6'
              }}
            >
              Intelligent automation that moves at the speed of your business.
            </p>
            
            {/* Social Links */}
            <div className="flex items-center gap-3">
              <a
                href="mailto:contact@novalare.com"
                className="group relative w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30 flex items-center justify-center transition-all duration-300 hover:scale-110 hover:border-purple-400/60"
                aria-label="Email"
              >
                <Mail className="w-4 h-4 text-purple-300 group-hover:text-purple-200 transition-colors" />
              </a>
              <a
                href="https://www.linkedin.com/company/novalare"
                target="_blank"
                rel="noopener noreferrer"
                className="group relative w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 flex items-center justify-center transition-all duration-300 hover:scale-110 hover:border-blue-400/60"
                aria-label="LinkedIn"
              >
                <Linkedin className="w-4 h-4 text-blue-300 group-hover:text-blue-200 transition-colors" />
              </a>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  handleSocialClick('Instagram');
                }}
                className="group relative w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500/20 to-purple-500/20 border border-pink-500/30 flex items-center justify-center transition-all duration-300 hover:scale-110 hover:border-pink-400/60"
                aria-label="Instagram"
              >
                <Instagram className="w-4 h-4 text-pink-300 group-hover:text-pink-200 transition-colors" />
              </button>
            </div>
          </div>

          {/* Services */}
          <div>
            <h3 
              className="text-white mb-6"
              style={{
                fontWeight: '700',
                fontFamily: "'Outfit', sans-serif",
                fontSize: '16px',
                letterSpacing: '-0.01em'
              }}
            >
              Services
            </h3>
            <ul className="space-y-3">
              {['Email Automation', 'Document Processing', 'Data Entry', 'Workflow Integration'].map((item) => (
                <li key={item}>
                  <a 
                    href="#services"
                    className="group flex items-center gap-2 text-white/60 hover:text-white transition-colors duration-200"
                    style={{
                      fontWeight: '500',
                      fontFamily: "'Manrope', sans-serif",
                      fontSize: '15px',
                    }}
                  >
                    <span>{item}</span>
                    <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 
              className="text-white mb-6"
              style={{
                fontWeight: '700',
                fontFamily: "'Outfit', sans-serif",
                fontSize: '16px',
                letterSpacing: '-0.01em'
              }}
            >
              Company
            </h3>
            <ul className="space-y-3">
              {[
                { label: 'About Us', href: '#philosophy' },
                { label: 'Our Philosophy', href: '#philosophy' },
                { label: 'How It Works', href: '#workflow' }
              ].map((item) => (
                <li key={item.label}>
                  <a 
                    href={item.href}
                    className="group flex items-center gap-2 text-white/60 hover:text-white transition-colors duration-200"
                    style={{
                      fontWeight: '500',
                      fontFamily: "'Manrope', sans-serif",
                      fontSize: '15px',
                    }}
                  >
                    <span>{item.label}</span>
                    <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources (NEW - includes Blog) */}
          <div>
            <h3 
              className="text-white mb-6"
              style={{
                fontWeight: '700',
                fontFamily: "'Outfit', sans-serif",
                fontSize: '16px',
                letterSpacing: '-0.01em'
              }}
            >
              Resources
            </h3>
            <ul className="space-y-3">
              <li>
                <button
                  onClick={() => navigate('/blog')}
                  className="group flex items-center gap-2 text-white/60 hover:text-white transition-colors duration-200"
                  style={{
                    fontWeight: '500',
                    fontFamily: "'Manrope', sans-serif",
                    fontSize: '15px',
                  }}
                >
                  <span>Blog</span>
                  <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('/features')}
                  className="group flex items-center gap-2 text-white/60 hover:text-white transition-colors duration-200"
                  style={{
                    fontWeight: '500',
                    fontFamily: "'Manrope', sans-serif",
                    fontSize: '15px',
                  }}
                >
                  <span>Features</span>
                  <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('/pricing')}
                  className="group flex items-center gap-2 text-white/60 hover:text-white transition-colors duration-200"
                  style={{
                    fontWeight: '500',
                    fontFamily: "'Manrope', sans-serif",
                    fontSize: '15px',
                  }}
                >
                  <span>Pricing</span>
                  <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 
              className="text-white mb-6"
              style={{
                fontWeight: '700',
                fontFamily: "'Outfit', sans-serif",
                fontSize: '16px',
                letterSpacing: '-0.01em'
              }}
            >
              Get in Touch
            </h3>
            <ul className="space-y-3">
              <li>
                <a 
                  href="mailto:contact@novalare.com"
                  className="text-white/60 hover:text-white transition-colors duration-200"
                  style={{
                    fontWeight: '500',
                    fontFamily: "'Manrope', sans-serif",
                    fontSize: '15px',
                  }}
                >
                  contact@novalare.com
                </a>
              </li>
              <li>
                <a 
                  href="tel:+17736561156"
                  className="text-white/60 hover:text-white transition-colors duration-200"
                  style={{
                    fontWeight: '500',
                    fontFamily: "'Manrope', sans-serif",
                    fontSize: '15px',
                  }}
                >
                  +1 (773) 656-1156
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-white/10">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <p 
              className="text-white/40 text-center sm:text-left"
              style={{
                fontWeight: '500',
                fontFamily: "'Manrope', sans-serif",
                fontSize: '14px',
              }}
            >
              © {currentYear} Novalare. All rights reserved.
            </p>
            
            <p 
              className="text-white/40 text-center sm:text-right"
              style={{
                fontWeight: '600',
                fontFamily: "'Outfit', sans-serif",
                fontSize: '14px',
                letterSpacing: '0.05em',
                textTransform: 'uppercase'
              }}
            >
              Built for the Future
            </p>
          </div>
        </div>
      </div>

      {/* Bottom gradient glow */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.3) 30%, rgba(147, 51, 234, 0.3) 70%, transparent)'
        }}
      />
    </footer>
  );
};