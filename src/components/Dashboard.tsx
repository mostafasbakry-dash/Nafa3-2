import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { 
  TrendingUp, 
  Package, 
  ShoppingCart, 
  DollarSign, 
  AlertCircle,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  ShieldCheck,
  Star
} from 'lucide-react';
import { Offer, Request as MarketRequest } from '@/src/types';
import { formatCurrency, cn } from '@/src/lib/utils';
import { getSupabase } from '@/src/lib/supabase';
import { toast } from 'react-hot-toast';

const StatCard = ({ title, value, icon: Icon, color, trend }: any) => (
  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
    <div className="flex justify-between items-start mb-4">
      <div className={cn("p-3 rounded-xl", color)}>
        <Icon size={24} className="text-white" />
      </div>
      {trend && (
        <div className={cn(
          "flex items-center gap-1 text-xs font-bold",
          trend > 0 ? "text-emerald-600" : "text-rose-600"
        )}>
          {trend > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          {Math.abs(trend)}%
        </div>
      )}
    </div>
    <h3 className="text-slate-500 text-sm font-medium mb-1">{title}</h3>
    <p className="text-2xl font-bold text-slate-900">{value}</p>
  </div>
);

export const Dashboard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalOffers: 0,
    totalRequests: 0,
    totalOffersValue: 0,
    soldItems: 0,
    soldTrend: 0,
    successScore: 0,
    avgRating: 0
  });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [error, setError] = useState<any>(null);

  const fetchStats = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;

    const current_user_id = localStorage.getItem('pharmacy_id');
    if (!current_user_id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      console.log('Fetching stats for pharmacy:', current_user_id);
      
      // 1. Fetch Offers
      const { data: offers, count: offersCount, error: offersError } = await supabase
        .from('inventory_offers')
        .select('*', { count: 'exact' })
        .eq('pharmacy_id', current_user_id);

      if (offersError) console.error('inventory_offers Error:', offersError);

      // 2. Fetch Requests
      const { data: requests, count: requestsCount, error: requestsError } = await supabase
        .from('inventory_requests')
        .select('*', { count: 'exact' })
        .eq('pharmacy_id', current_user_id);

      if (requestsError) console.error('inventory_requests Error:', requestsError);

      // 3. Fetch Sales Archive for Sold Items and Success Score
      const { data: archive, count: archiveCount, error: archiveError } = await supabase
        .from('sales_archive')
        .select('*', { count: 'exact' })
        .eq('pharmacy_id', current_user_id);

      if (archiveError) console.error('sales_archive Error:', archiveError);

      // 4. Fetch Ratings for Cumulative Rating
      const { data: ratings, error: ratingsError } = await supabase
        .from('ratings')
        .select('stars')
        .eq('to_pharmacy_id', current_user_id);

      if (ratingsError) console.error('ratings Error:', ratingsError);

      // Calculate stats
      const totalOffers = offersCount || 0;
      const totalRequests = requestsCount || 0;
      const successScore = archiveCount || 0;
      
      const avgRating = ratings && ratings.length > 0
        ? ratings.reduce((sum, r) => sum + r.stars, 0) / ratings.length
        : 0;
      
      // Total Value Calculation: sum(price * quantity) from inventory_offers
      const totalOffersValue = (offers || []).reduce((sum, item) => {
        const price = Number(item.price) || 0;
        const qty = Number(item.quantity) || 0;
        return sum + (price * qty);
      }, 0);
      
      // Sold Quantity Counter: sum(quantity) from sales_archive where action_type matches Offer labels
      // Only items archived from 'Offers' count towards 'Sold Quantity'
      const offerSaleLabels = ['بيع داخلي', 'Internal Sale', 'تحويل', 'Transfer', 'بيع'];
      const filteredArchive = (archive || []).filter(item => offerSaleLabels.includes(item.action_type));
      
      const soldQuantity = filteredArchive.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

      // Trend Calculation for Sold Quantity
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      const currentWeekSales = filteredArchive
        .filter(item => new Date(item.created_at) >= sevenDaysAgo)
        .reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

      const previousWeekSales = filteredArchive
        .filter(item => {
          const dt = new Date(item.created_at);
          return dt >= fourteenDaysAgo && dt < sevenDaysAgo;
        })
        .reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

      let soldTrend = 0;
      if (previousWeekSales > 0) {
        soldTrend = Math.round(((currentWeekSales - previousWeekSales) / previousWeekSales) * 100);
      } else if (currentWeekSales > 0) {
        soldTrend = 100; // 100% growth if starting from zero
      }

      setStats({
        totalOffers,
        totalRequests,
        totalOffersValue,
        soldItems: soldQuantity,
        soldTrend,
        successScore,
        avgRating
      });

      // Combine and sort for recent activity (Offers, Requests, and Archive)
      const activity = [
        ...(offers || []).map(o => ({ ...o, type: 'offer' })),
        ...(requests || []).map(r => ({ ...r, type: 'request' })),
        ...(archive || []).map(a => ({ ...a, type: 'archive' }))
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10); // Show more in the list

      setRecentActivity(activity);
    } catch (err) {
      console.error('Dashboard Stats Error:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'offer': return <Package size={20} />;
      case 'request': return <ShoppingCart size={20} />;
      case 'archive': return <TrendingUp size={20} />;
      default: return <Package size={20} />;
    }
  };

  const getActivityLabel = (item: any) => {
    if (item.type === 'offer') return 'New Offer';
    if (item.type === 'request') return 'New Request';
    if (item.type === 'archive') {
      const offerSaleLabels = ['بيع داخلي', 'Internal Sale', 'تحويل', 'Transfer', 'بيع'];
      const requestLabels = ['تم الشراء', 'Purchased', 'تم التحويل', 'Transferred'];
      
      if (offerSaleLabels.includes(item.action_type)) return 'Offer Sold/Transferred';
      if (requestLabels.includes(item.action_type)) return 'Request Completed';
      return 'Item Archived';
    }
    return 'Activity';
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{t('dashboard')}</h1>
          <p className="text-slate-500">{t('tagline')}</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => navigate('/my-requests')}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg font-semibold text-slate-700 hover:bg-slate-50 transition-all"
          >
            <Plus size={18} />
            {t('add_request')}
          </button>
          <button 
            onClick={() => navigate('/my-offers')}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary-dark transition-all shadow-md shadow-primary/20"
          >
            <Plus size={18} />
            {t('add_offer')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard 
          title={t('stats_total_offers')} 
          value={stats.totalOffers} 
          icon={Package} 
          color="bg-blue-500"
          trend={12}
        />
        <StatCard 
          title={t('stats_total_requests')} 
          value={stats.totalRequests} 
          icon={ShoppingCart} 
          color="bg-indigo-500"
          trend={-5}
        />
        <StatCard 
          title={t('stats_total_value')} 
          value={formatCurrency(stats.totalOffersValue)} 
          icon={DollarSign} 
          color="bg-emerald-500"
          trend={8}
        />
        <StatCard 
          title={t('stats_sold_items')} 
          value={stats.soldItems} 
          icon={TrendingUp} 
          color="bg-amber-500"
          trend={stats.soldTrend}
        />
        <StatCard 
          title={t('success_score')} 
          value={stats.successScore} 
          icon={ShieldCheck} 
          color="bg-emerald-600"
        />
        <StatCard 
          title={t('cumulative_rating')} 
          value={stats.avgRating > 0 ? stats.avgRating.toFixed(1) : 'N/A'} 
          icon={Star} 
          color="bg-amber-400"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">Recent Activity</h2>
            <button 
              onClick={() => navigate('/my-offers')}
              className="text-primary font-semibold text-sm hover:underline"
            >
              View All
            </button>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            {loading ? (
              <div className="p-12 flex items-center justify-center">
                <Loader2 className="animate-spin text-primary" size={32} />
              </div>
            ) : recentActivity.length > 0 ? (
              recentActivity.map((item, i) => (
                <div key={i} className="p-4 border-b border-slate-100 last:border-0 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center",
                      item.type === 'archive' ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-slate-500"
                    )}>
                      {getActivityIcon(item.type)}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{item.english_name}</p>
                      <p className="text-xs text-slate-500">
                        {new Date(item.created_at).toLocaleDateString()} • {getActivityLabel(item)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-900">
                      {item.type === 'offer' || item.type === 'archive' ? formatCurrency(Number(item.price) || 0) : `${item.quantity} units`}
                    </p>
                    <p className={cn(
                      "text-[10px] font-bold uppercase",
                      item.type === 'archive' ? "text-amber-600" : "text-emerald-600"
                    )}>
                      {item.type === 'archive' ? item.action_type : 'Active'}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-12 text-center text-slate-500">
                {error ? 'Failed to load activity' : 'No recent activity found.'}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-bold text-slate-900">Quick Actions</h2>
          <div className="grid grid-cols-1 gap-3">
            <button 
              onClick={() => console.log('Near Expiry Alert clicked')}
              className="flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-2xl hover:border-primary hover:shadow-md transition-all group text-start"
            >
              <div className="p-3 rounded-xl bg-slate-100 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                <AlertCircle size={24} />
              </div>
              <div>
                <p className="font-bold text-slate-900">Near Expiry Alert</p>
                <p className="text-xs text-slate-500">Check items expiring soon</p>
              </div>
            </button>
            <button 
              onClick={() => console.log('Optimization Tips clicked')}
              className="flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-2xl hover:border-primary hover:shadow-md transition-all group text-start"
            >
              <div className="p-3 rounded-xl bg-slate-100 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                <TrendingUp size={24} />
              </div>
              <div>
                <p className="font-bold text-slate-900">Optimization Tips</p>
                <p className="text-xs text-slate-500">Increase sales with discounts</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
