import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className={`relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 transition-all duration-500 ${isExiting ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}
    >
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute -top-24 -left-24 h-[28rem] w-[28rem] rounded-full bg-amber-400/20 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-[28rem] w-[28rem] rounded-full bg-purple-500/20 blur-3xl" />
        <div className="absolute top-20 right-24 w-16 h-16 rounded-full bg-amber-400/60 blur-xl animate-pulse" />
        <div className="absolute bottom-28 left-24 w-20 h-20 rounded-full bg-blue-400/50 blur-xl animate-bounce" />
        <div className="absolute top-1/3 left-1/3 w-10 h-10 rounded-full bg-purple-400/60 animate-ping" />
        <div className="absolute bottom-40 right-28 w-10 h-10 rounded-full bg-green-400/60 animate-pulse" />
      </div>

      <div className="relative text-center px-6">
        <div className="relative mx-auto mb-6 flex items-center justify-center">
          <div className="absolute -inset-16 rounded-full bg-gradient-to-tr from-amber-400/20 via-blue-500/10 to-purple-600/20 blur-2xl" />
          <div className="relative flex items-center justify-center gap-2">
            <span className="inline-block align-middle select-none text-[5.5rem] sm:text-[8rem] md:text-[10rem] bg-gradient-to-br from-amber-300 to-amber-600 bg-clip-text text-transparent drop-shadow-[0_5px_20px_rgba(255,193,7,0.25)] motion-safe:animate-bounce">4</span>
            <span className="relative inline-flex items-center justify-center mx-1">
              <span className="select-none text-[5.5rem] sm:text-[8rem] md:text-[10rem] bg-gradient-to-br from-blue-400 to-purple-600 bg-clip-text text-transparent drop-shadow-[0_5px_20px_rgba(99,102,241,0.25)] motion-safe:animate-pulse">0</span>
              <span aria-hidden className="absolute inset-0 rounded-full border-2 border-purple-300/50 shadow-[0_0_30px_rgba(168,85,247,0.35)] motion-safe:animate-[spin_10s_linear_infinite]" />
            </span>
            <span className="inline-block align-middle select-none text-[5.5rem] sm:text-[8rem] md:text-[10rem] bg-gradient-to-br from-amber-300 to-amber-600 bg-clip-text text-transparent drop-shadow-[0_5px_20px_rgba(255,193,7,0.25)] motion-safe:animate-bounce">4</span>
          </div>
        </div>

        <h1 className="mt-2 text-2xl sm:text-3xl font-semibold text-white">Page Not Found</h1>
        <p className="mt-2 text-sm text-slate-300">The page you’re looking for doesn’t exist or was moved.</p>

        <div className="mt-8 flex items-center justify-center">
          <Button
            aria-label="Go to booking"
            className="h-11 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-900 font-semibold"
            disabled={isExiting}
            onClick={() => {
              if (isExiting) return;
              setIsExiting(true);
              setTimeout(() => navigate('/booking'), 500);
            }}
          >
            Go to Booking
          </Button>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 opacity-30">
          <svg className="h-full w-full" viewBox="0 0 1440 320" preserveAspectRatio="none">
            <path fill="#A78BFA" fillOpacity="0.25" d="M0,256L80,234.7C160,213,320,171,480,170.7C640,171,800,213,960,234.7C1120,256,1280,256,1360,256L1440,256L1440,320L1360,320C1280,320,1120,320,960,320C800,320,640,320,480,320C320,320,160,320,80,320L0,320Z" />
            <path fill="#60A5FA" fillOpacity="0.25" d="M0,192L80,197.3C160,203,320,213,480,202.7C640,192,800,160,960,144C1120,128,1280,128,1360,128L1440,128L1440,320L1360,320C1280,320,1120,320,960,320C800,320,640,320,480,320C320,320,160,320,80,320L0,320Z" />
          </svg>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
