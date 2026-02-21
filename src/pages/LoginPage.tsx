import { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Loader2, Eye, EyeOff, Moon, Sun, Zap, Dumbbell, Timer, Target, Activity } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import gymIcon from '@/assets/gym-icon.png';
import treadmillImg from '@/assets/treadmill.png';
import benchPressImg from '@/assets/bench-press.png';

const carouselImages = [treadmillImg, benchPressImg, gymIcon];

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Auto-swipe carousel
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % carouselImages.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await login(email, password);
      if (error) {
        toast({
          title: "Login failed",
          description: error,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Welcome back!",
          description: "You have successfully logged in.",
        });
        navigate('/dashboard');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 lg:p-8">
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-6 right-6 rounded-full bg-white dark:bg-slate-800 shadow-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
        onClick={() => document.documentElement.classList.toggle('dark')}
      >
        <Sun className="h-4 w-4 dark:hidden" />
        <Moon className="h-4 w-4 hidden dark:block" />
      </Button>
      <div className="w-full max-w-7xl h-auto lg:h-[850px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col lg:flex-row overflow-hidden border border-slate-200 dark:border-slate-800">
        <div className="relative w-full lg:w-3/5 bg-slate-50 dark:bg-slate-800 flex items-center justify-center p-8 overflow-hidden">
          <div className="absolute top-12 left-12 w-12 h-12 bg-green-400/20 rounded-full flex items-center justify-center text-green-500 animate-bounce" style={{ animationDelay: '0.5s' }}>
            <Zap className="h-5 w-5" />
          </div>
          <div className="absolute top-12 right-12 w-12 h-12 bg-amber-400/20 rounded-full flex items-center justify-center text-amber-500 animate-bounce" style={{ animationDelay: '1s' }}>
            <Dumbbell className="h-5 w-5" />
          </div>
          <div className="absolute bottom-12 left-12 w-12 h-12 bg-blue-400/20 rounded-full flex items-center justify-center text-blue-500 animate-bounce" style={{ animationDelay: '1.5s' }}>
            <Timer className="h-5 w-5" />
          </div>
          <div className="absolute bottom-12 right-12 w-12 h-12 bg-purple-400/20 rounded-full flex items-center justify-center text-purple-500 animate-bounce" style={{ animationDelay: '2s' }}>
            <Target className="h-5 w-5" />
          </div>
          <div className="relative z-10 text-center max-w-lg">
            <div className="mb-12 relative flex justify-center">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] border border-slate-200 dark:border-slate-700 rounded-full opacity-50" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] border border-slate-100 dark:border-slate-700/50 rounded-full opacity-50" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] border border-slate-50 dark:border-slate-700/20 rounded-full opacity-50" />
              <div className="relative z-10 w-64 h-64 flex items-center justify-center">
                {carouselImages.map((img, idx) => (
                  <img
                    key={idx}
                    alt={`Gym visual ${idx + 1}`}
                    className={`absolute rounded-full w-full h-full object-contain border-8 border-white dark:border-slate-900 shadow-xl transition-all duration-500 ${
                      idx === currentSlide ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                    }`}
                    src={img}
                  />
                ))}
              </div>
            </div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
              Manage your gym sessions <br /> with ease and efficiency.
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
              Track attendance, manage schedules, and keep your members engaged with our all-in-one admin platform.
            </p>
            <div className="flex justify-center gap-2">
              {carouselImages.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentSlide(idx)}
                  className={`rounded-full transition-all duration-300 ${idx === currentSlide ? 'w-6 h-2 bg-amber-400' : 'w-2 h-2 bg-slate-400 dark:bg-slate-600'}`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="w-full lg:w-2/5 flex items-center justify-center p-8 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="w-full max-w-md bg-white dark:bg-slate-800 p-8 lg:p-10 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-2xl mb-4">
                <Activity className="h-8 w-8 text-amber-500" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">Welcome Back</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm">Sign in to your account</p>
            </div>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label htmlFor="login-identity" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Email or Username
                </Label>
                <Input
                  id="login-identity"
                  type="text"
                  placeholder="Enter your email or username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 h-12 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-lg focus-visible:ring-2 focus-visible:ring-amber-400/20 focus-visible:border-amber-400 dark:text-white transition-all outline-none"
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <Label htmlFor="login-password" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Password
                  </Label>
                  <button type="button" className="text-xs text-amber-500 hover:underline font-medium">
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-4 py-3 h-12 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-lg focus-visible:ring-2 focus-visible:ring-amber-400/20 focus-visible:border-amber-400 dark:text-white transition-all outline-none pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
              <div className="flex items-center">
                <input id="remember" type="checkbox" className="w-4 h-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500" />
                <label htmlFor="remember" className="ml-2 text-sm text-slate-600 dark:text-slate-400">
                  Remember me for 30 days
                </label>
              </div>
              <Button
                type="submit"
                className="w-full bg-amber-400 hover:bg-amber-500 text-slate-900 font-semibold py-3.5 h-12 rounded-lg shadow-md shadow-amber-500/20 transition-all active:scale-[0.98]"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>
            <div className="relative my-8">
              <div aria-hidden="true" className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-100 dark:border-slate-700" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white dark:bg-slate-800 px-3 text-slate-400 dark:text-slate-500 font-medium">or sign in with</span>
              </div>
            </div>
            <button
              type="button"
              className="w-full flex items-center justify-center gap-3 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-medium py-3 rounded-lg transition-colors shadow-sm active:scale-[0.98]"
            >
              <svg className="w-5 h-5" viewBox="0 0 23 23" xmlns="http://www.w3.org/2000/svg">
                <path d="M11.4 0H0v11.4h11.4V0z" fill="#f25022" />
                <path d="M23 0H11.6v11.4H23V0z" fill="#7fbb00" />
                <path d="M11.4 11.6H0V23h11.4V11.6z" fill="#00a1f1" />
                <path d="M23 11.6H11.6V23H23V11.6z" fill="#ffb900" />
              </svg>
              Microsoft
            </button>
            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-700">
              <p className="text-center text-sm text-slate-500 dark:text-slate-400">
                Don&apos;t have an account?
                <button type="button" className="text-amber-500 font-semibold hover:underline ml-1">
                  Join the community
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="fixed bottom-6 text-center text-slate-400 dark:text-slate-500 text-sm hidden md:block">
        © 2024 GymFlow Management Solutions. All rights reserved.
      </div>
    </div>
  );
}
