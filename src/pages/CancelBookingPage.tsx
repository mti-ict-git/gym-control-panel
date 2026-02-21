import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Badge, Loader2, Moon, Sun, Ticket, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import cancelHero from '@/assets/unnamed.png';
import avatarOne from '@/assets/ava1.png';
import avatarTwo from '@/assets/ava2.png';
import avatarThree from '@/assets/ava3.png';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';

export default function CancelBookingPage() {
  const [bookingIdRaw, setBookingIdRaw] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [pending, setPending] = useState<{ bookingId: number; employeeId: string } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const normalizeBookingId = (raw: string): number | null => {
    const digits = String(raw || '').replace(/[^0-9]/g, '');
    const num = Number(digits);
    return Number.isFinite(num) && num > 0 ? num : null;
  };

  const submitCancelBooking = useCallback(async (bookingId: number, empId: string) => {
    const emp = String(empId || '').trim();
    if (!emp || !bookingId) return;
    setLoading(true);
    try {
      const safeJson = async (resp: Response) => {
        const contentType = resp.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          const text = await resp.text();
          return { json: null, text };
        }
        const json = (await resp.json()) as { ok: boolean; error?: string } | null;
        return { json, text: '' };
      };

      const post = async (url: string) => {
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ booking_id: bookingId, employee_id: emp }),
        });
        const { json, text } = await safeJson(resp);
        return { resp, json, text };
      };

      const first = await post('/api/gym-booking-cancel');
      let final = first;
      if (!first.resp.ok || !first.json) {
        const second = await post('/gym-booking-cancel');
        if (second.resp.ok || second.json) {
          final = second;
        }
      }

      if (!final.resp.ok || !final.json || !final.json.ok) {
        const fallbackMessage =
          final.resp.status === 404
            ? 'Cancel API not found. Pastikan backend aktif dan VITE_BACKEND_URL mengarah ke server backend.'
            : final.resp.status >= 500
              ? 'Server error saat membatalkan booking.'
              : 'Unable to cancel booking. Please verify your details.';
        toast({
          title: 'Cancellation failed',
          description: final.json?.error || final.text || fallbackMessage,
          variant: 'destructive',
        });
        return;
      }
      toast({
        title: 'Booking cancelled',
        description: 'Your booking has been cancelled successfully.',
      });
      setBookingIdRaw('');
      setEmployeeId('');
      setPending(null);
      setDialogOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to cancel booking';
      toast({
        title: 'Cancellation failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <main className="flex min-h-screen">
        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-slate-900">
          <img
            alt="Modern Gym Interior"
            className="absolute inset-0 w-full h-full object-cover opacity-60"
            src={cancelHero}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/40 to-transparent" />
          <div className="relative z-10 p-16 flex flex-col justify-end h-full text-white">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center">
                <Ticket className="h-6 w-6" />
              </div>
              <span className="text-2xl font-bold tracking-tight">SUPER<span className="text-red-400">GYM</span></span>
            </div>
            <h1 className="text-5xl font-extrabold mb-4 leading-tight">Something came up?</h1>
            <p className="text-xl text-slate-200 max-w-lg leading-relaxed font-light">
              Life happens. If you can't make it to your session, manage your bookings here quickly and easily so others can hit the floor.
            </p>
            <div className="mt-12 flex items-center gap-4">
              <div className="flex -space-x-3">
                <img
                  alt="Member avatar"
                  className="w-10 h-10 rounded-full border-2 border-slate-900"
                  src={avatarOne}
                />
                <img
                  alt="Member avatar"
                  className="w-10 h-10 rounded-full border-2 border-slate-900"
                  src={avatarTwo}
                />
                <img
                  alt="Member avatar"
                  className="w-10 h-10 rounded-full border-2 border-slate-900"
                  src={avatarThree}
                />
              </div>
              <p className="text-sm text-slate-300">Join 2,000+ active members today.</p>
            </div>
          </div>
        </div>
        <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-6 right-6 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700"
            onClick={() => document.documentElement.classList.toggle('dark')}
          >
            <Sun className="h-4 w-4 dark:hidden" />
            <Moon className="h-4 w-4 hidden dark:block" />
          </Button>
          <div className="w-full max-w-md">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 p-8 sm:p-10 transition-all">
              <div className="flex justify-between items-center mb-8">
                <Link
                  to="/booking"
                  className="flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors group"
                >
                  <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                  Back
                </Link>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Booking Management</span>
              </div>
              <div className="text-center mb-10">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-950/30 text-red-500 mb-4">
                  <XCircle className="h-8 w-8" />
                </div>
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Cancel Booking</h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm">Please enter your details below to cancel your booked session.</p>
              </div>
              <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Booking ID</label>
                  <div className="relative">
                    <Ticket className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 h-5 w-5" />
                    <Input
                      placeholder="e.g. GYMBOOK01 or 1"
                      value={bookingIdRaw}
                      onChange={(e) => setBookingIdRaw(e.target.value)}
                      className="h-12 pl-12 pr-4 bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-xl focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-red-500 text-slate-900 dark:text-white placeholder:text-slate-400"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Employee ID</label>
                  <div className="relative">
                    <Badge className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 h-5 w-5" />
                    <Input
                      placeholder="Enter your Employee ID"
                      value={employeeId}
                      onChange={(e) => setEmployeeId(e.target.value)}
                      className="h-12 pl-12 pr-4 bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-xl focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-red-500 text-slate-900 dark:text-white placeholder:text-slate-400"
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-6 rounded-xl shadow-lg shadow-red-500/30 hover:shadow-red-500/40 transition-all flex items-center justify-center gap-2 group"
                  disabled={loading}
                  onClick={() => {
                    const bookingId = normalizeBookingId(bookingIdRaw);
                    const emp = employeeId.trim();
                    if (!bookingId || !emp) {
                      toast({
                        title: 'Missing details',
                        description: 'Please enter a valid booking ID and employee ID.',
                        variant: 'destructive',
                      });
                      return;
                    }
                    setPending({ bookingId, employeeId: emp });
                    setDialogOpen(true);
                  }}
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Cancel Booking
                  <XCircle className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </form>
              <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex gap-3">
                <div className="text-amber-500">
                  <Badge className="h-5 w-5" />
                </div>
                <p className="text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
                  Only bookings with status <span className="font-semibold text-slate-700 dark:text-slate-200">BOOKED</span> for today or later can be cancelled. Please contact support if you need assistance with past sessions.
                </p>
              </div>
            </div>
            <div className="mt-8 flex justify-center gap-6 text-xs font-medium text-slate-400">
              <a className="hover:text-red-500 transition-colors" href="#">Privacy Policy</a>
              <a className="hover:text-red-500 transition-colors" href="#">Terms of Service</a>
              <a className="hover:text-red-500 transition-colors" href="#">Need Help?</a>
            </div>
          </div>
        </div>
      </main>
      <AlertDialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setPending(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel booking?</AlertDialogTitle>
            <AlertDialogDescription>
              {pending
                ? `Booking ${pending.bookingId} for Employee ID ${pending.employeeId} will be cancelled and the slot will be released.`
                : 'This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Keep Booking</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!pending || loading}
              onClick={async (e) => {
                e.preventDefault();
                if (!pending) return;
                await submitCancelBooking(pending.bookingId, pending.employeeId);
              }}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Cancel
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
