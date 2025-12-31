import { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent } from '@/components/ui/tabs';
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
    <div className="min-h-screen flex bg-slate-400/80">
      {/* Left Panel - Decorative */}
      <div className="hidden lg:flex lg:w-1/2 p-6">
        <div className="w-full bg-slate-100 rounded-3xl flex flex-col items-center justify-between p-12 relative overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-72 h-72 border border-slate-300 rounded-full absolute" />
            <div className="w-96 h-96 border border-slate-300 rounded-full absolute" />
            <div className="w-[28rem] h-[28rem] border border-slate-200 rounded-full absolute" />
          </div>

          <div className="absolute top-20 right-24 w-10 h-10 bg-amber-400 rounded-full flex items-center justify-center text-amber-900 font-bold text-sm shadow-md">
            💪
          </div>
          <div className="absolute bottom-32 left-20 w-10 h-10 bg-blue-400 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md">
            🏋️
          </div>
          <div className="absolute top-40 left-28 w-10 h-10 bg-green-400 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md">
            ⚡
          </div>
          <div className="absolute bottom-40 right-28 w-10 h-10 bg-purple-400 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md">
            🎯
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Carousel - Centered on circles */}
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="flex flex-col items-center">
              <div className="w-72 h-72 flex items-center justify-center relative">
                {carouselImages.map((img, idx) => (
                  <img
                    key={idx}
                    src={img}
                    alt={`Fitness ${idx + 1}`}
                    className={`absolute w-64 h-64 object-contain transition-all duration-500 ${
                      idx === currentSlide
                        ? 'opacity-100 scale-100'
                        : 'opacity-0 scale-95'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          <div className="relative z-10 text-center">
            <h2 className="text-2xl font-semibold text-slate-800 mb-3">
              Manage your gym sessions
              <br />
              with ease and efficiency.
            </h2>
            <p className="text-slate-500 text-sm max-w-xs mx-auto">
              Track attendance, manage schedules, and keep your members engaged with our admin platform.
            </p>

            <div className="flex justify-center gap-2 mt-8">
              {carouselImages.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentSlide(idx)}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    idx === currentSlide
                      ? 'bg-slate-800'
                      : 'bg-slate-300 hover:bg-slate-400'
                  }`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="w-full lg:w-1/2 p-6 flex items-center justify-center">
        <div className="w-full max-w-md bg-white rounded-3xl p-8 lg:p-12 shadow-xl">
          {/* Mobile logo */}
          <div className="flex lg:hidden justify-center mb-6">
            <img src={gymIcon} alt="Gym" className="w-14 h-14 object-contain" />
          </div>

          <Tabs defaultValue="login" className="w-full">

            <TabsContent value="login">
              <div className="text-center mb-8">
                <h1 className="text-2xl font-semibold text-slate-900">Welcome Back</h1>
                <p className="text-slate-500 text-sm mt-1">Sign in to your account</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="login-identity" className="text-slate-700">Email or Username</Label>
                  <Input
                    id="login-identity"
                    type="text"
                    placeholder="Enter your email or username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-12 rounded-xl border-slate-200 bg-slate-50 focus:bg-white transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="login-password" className="text-slate-700">Password</Label>
                  <div className="relative">
                    <Input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="h-12 rounded-xl border-slate-200 bg-slate-50 focus:bg-white transition-colors pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-900 font-semibold shadow-md"
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
            </TabsContent>

            
          </Tabs>
        </div>
      </div>
    </div>
  );
}
