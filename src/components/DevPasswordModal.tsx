import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Lock, X } from 'lucide-react';
import { toast } from 'sonner@2.0.3';

interface DevPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function DevPasswordModal({ isOpen, onClose, onSuccess }: DevPasswordModalProps) {
  const [password, setPassword] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // The secret password (you can change this to whatever you want)
  const SECRET_PASSWORD = 'Halyl.A2025';

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password === SECRET_PASSWORD) {
      toast.success('🔓 Access Granted', {
        description: 'Developer Mode activated',
        duration: 3000,
      });
      onSuccess();
      setPassword('');
      onClose();
    } else {
      toast.error('❌ Access Denied', {
        description: 'Incorrect password',
        duration: 2000,
      });
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      setPassword('');
    }
  };

  const handleClose = () => {
    setPassword('');
    onClose();
  };

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-xl"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div 
        className={`relative bg-gradient-to-br from-zinc-900 to-black border border-orange-500/30 rounded-2xl p-8 max-w-md w-full shadow-2xl ${
          isShaking ? 'animate-shake' : ''
        }`}
        style={{
          boxShadow: '0 20px 60px rgba(251, 146, 60, 0.3)',
        }}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 hover:bg-white/5 rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-white/50" />
        </button>

        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-500/30 flex items-center justify-center">
            <Lock className="w-8 h-8 text-orange-400" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-center mb-2">
          <span className="bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">
            Developer Access
          </span>
        </h2>
        <p className="text-white/50 text-center mb-8">
          Enter password to unlock Dev Portal
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <input
              ref={inputRef}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password..."
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-orange-500/50 focus:bg-white/10 transition-all"
              style={{
                fontFamily: "'Manrope', sans-serif",
              }}
            />
          </div>

          <button
            type="submit"
            className="w-full px-6 py-3 rounded-xl font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: 'linear-gradient(135deg, #fb923c 0%, #ef4444 100%)',
              boxShadow: '0 4px 20px rgba(251, 146, 60, 0.4)',
            }}
          >
            Unlock Dev Portal
          </button>
        </form>

        {/* Hint (remove this in production if you want) */}
        <div className="mt-6 p-3 bg-orange-500/5 border border-orange-500/20 rounded-lg">
          <p className="text-xs text-orange-300/70 text-center">
            Hint: Check DEV_MODE_INSTRUCTIONS.md for password
          </p>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-10px); }
          75% { transform: translateX(10px); }
        }
        .animate-shake {
          animation: shake 0.3s ease-in-out;
        }
      `}</style>
    </div>
  );

  return createPortal(modalContent, document.body);
}