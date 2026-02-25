import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, Lock, Loader2, Building } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { getSupabase } from '@/src/lib/supabase';

export const Login = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [credentials, setCredentials] = useState({
    email: '',
    password: '',
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const supabase = getSupabase();
    if (!supabase) {
      toast.error('Connection error');
      setLoading(false);
      return;
    }

    const normalizedEmail = credentials.email.trim().toLowerCase();

    try {
      // 1. Email Verification: Check if email exists in 'credentials' table (case-insensitive)
      console.log('Attempting login for:', normalizedEmail);
      
      const { data: credentialData, error: credentialError } = await supabase
        .from('credentials')
        .select('pharmacy_id, email')
        .ilike('email', normalizedEmail)
        .single();

      // Debugging Log: Print exact error if any
      if (credentialError) {
        console.log('Supabase Credentials Error:', credentialError);
      }

      if (credentialError || !credentialData) {
        // Professional multilingual message using i18n
        toast.error(t('login_email_not_found'), {
          duration: 8000,
          position: 'top-center',
          style: {
            border: '1px solid #ef4444',
            padding: '16px',
            color: '#7f1d1d',
            maxWidth: '500px',
            textAlign: 'center',
            fontWeight: '500',
            lineHeight: '1.6'
          },
          iconTheme: {
            primary: '#ef4444',
            secondary: '#fff',
          },
        });
        setLoading(false);
        return;
      }

      // 2. Proceed with login logic
      // Since Supabase Auth isn't fully set up with these credentials yet in the code,
      // we'll fetch the pharmacy profile to complete the mock login with REAL data from the DB.
      const { data: profileData, error: profileError } = await supabase
        .from('pharmacies')
        .select('*')
        .eq('pharmacy_id', credentialData.pharmacy_id)
        .single();

      if (profileError || !profileData) {
        console.error('Profile fetch error:', profileError);
        // Fallback to mock if profile not found but credentials exist
        localStorage.setItem('pharmacy_id', credentialData.pharmacy_id.toString());
        localStorage.setItem('pharmacy_profile', JSON.stringify({
          id: credentialData.pharmacy_id.toString(),
          name: 'Pharmacy User',
          city: 'Cairo',
          address: ''
        }));
      } else {
        localStorage.setItem('pharmacy_id', profileData.pharmacy_id.toString());
        localStorage.setItem('pharmacy_profile', JSON.stringify({
          id: profileData.pharmacy_id.toString(),
          name: profileData.pharmacy_name,
          city: profileData.city,
          address: profileData.address,
          phone: profileData.phone,
          telegram: profileData.telegram
        }));
      }

      toast.success('Welcome back!');
      navigate('/');
    } catch (err) {
      console.error('Login error:', err);
      toast.error('An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="bg-primary p-8 text-white text-center">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
            <Building size={32} />
          </div>
          <h2 className="text-2xl font-bold">{t('login')}</h2>
          <p className="text-white/70 text-sm mt-2">Access your pharmacy dashboard</p>
        </div>

        <div className="p-8">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase px-1">{t('email')}</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="email"
                  required
                  value={credentials.email}
                  onChange={(e) => setCredentials({ ...credentials, email: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                  placeholder="pharmacy@example.com"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase px-1">{t('password')}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="password"
                  required
                  value={credentials.password}
                  onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                  placeholder="••••••••"
                />
              </div>
            </div>
            <button
              disabled={loading}
              className="w-full py-4 bg-primary hover:bg-primary-dark text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
            >
              {loading ? <Loader2 className="animate-spin" /> : t('login')}
            </button>
            <p className="text-center text-sm text-slate-500">
              Don't have an account? <Link to="/register" className="text-primary font-bold">Register</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};
