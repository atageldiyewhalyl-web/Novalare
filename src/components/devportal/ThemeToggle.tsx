import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm"
          className={theme === 'premium-dark' 
            ? 'text-purple-200 hover:text-white hover:bg-purple-500/10' 
            : 'text-gray-600 hover:text-gray-900'
          }
        >
          {theme === 'premium-dark' ? (
            <Moon className="size-4" />
          ) : (
            <Sun className="size-4" />
          )}
          <span className="ml-2 text-sm">Theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end"
        className={theme === 'premium-dark' 
          ? 'bg-gray-900 border-purple-500/20 text-white' 
          : ''
        }
      >
        <DropdownMenuLabel className={theme === 'premium-dark' ? 'text-purple-200' : ''}>
          Choose Theme
        </DropdownMenuLabel>
        <DropdownMenuSeparator className={theme === 'premium-dark' ? 'bg-purple-500/20' : ''} />
        
        <DropdownMenuItem
          onClick={() => setTheme('professional-light')}
          className={theme === 'premium-dark' 
            ? 'text-purple-200 hover:bg-purple-500/10 hover:text-white focus:bg-purple-500/10 focus:text-white' 
            : theme === 'professional-light' 
              ? 'bg-blue-50 text-blue-600' 
              : ''
          }
        >
          <Sun className="size-4 mr-2" />
          <div>
            <div className="text-sm font-medium">Professional Light</div>
            <div className={`text-xs ${theme === 'premium-dark' ? 'text-purple-300/60' : 'text-gray-500'}`}>
              Clean corporate style
            </div>
          </div>
        </DropdownMenuItem>
        
        <DropdownMenuItem
          onClick={() => setTheme('premium-dark')}
          className={theme === 'premium-dark' 
            ? theme === 'premium-dark'
              ? 'bg-gradient-to-r from-purple-600/20 to-pink-500/20 text-white'
              : 'text-purple-200 hover:bg-purple-500/10 hover:text-white focus:bg-purple-500/10 focus:text-white'
            : ''
          }
        >
          <Moon className="size-4 mr-2" />
          <div>
            <div className="text-sm font-medium">Premium Dark</div>
            <div className={`text-xs ${theme === 'premium-dark' ? 'text-purple-300/60' : 'text-gray-500'}`}>
              Vibrant landing page style
            </div>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
