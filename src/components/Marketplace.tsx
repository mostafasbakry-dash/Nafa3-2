import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Filter, SlidersHorizontal, MapPin, Percent, X, Loader2, Phone, MessageSquare, Building, ExternalLink } from 'lucide-react';
import { Offer, Request as MarketRequest, EGYPT_CITIES } from '@/src/types';
import { OfferCard } from '@/src/components/OfferCard';
import { RatingModal } from '@/src/components/RatingModal';
import { cn, getDistance } from '@/src/lib/utils';
import { toast } from 'react-hot-toast';
import { getSupabase } from '@/src/lib/supabase';

export const Marketplace = () => {
  const { t } = useTranslation();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [filteredOffers, setFilteredOffers] = useState<Offer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [minDiscount, setMinDiscount] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [ratingOffer, setRatingOffer] = useState<Offer | null>(null);
  const [error, setError] = useState<any>(null);

  const userProfile = JSON.parse(localStorage.getItem('pharmacy_profile') || '{}');
  const [loading, setLoading] = useState(true);

  const fetchOffers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('Fetching from inventory_offers...');
      const supabase = getSupabase();
      if (!supabase) return;

      const { data, error: fetchError } = await supabase
        .from('inventory_offers')
        .select('*, pharmacies(pharmacy_id, pharmacy_name, phone, city, address, telegram)')
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Marketplace Fetch Error:', fetchError.message, fetchError.details, fetchError.hint);
      }
      
      const allOffers = data || [];

      // Fetch ratings and success scores for all unique pharmacies in the offers
      const pharmacyIds = [...new Set(allOffers.map(o => o.pharmacy_id))];
      
      if (pharmacyIds.length > 0) {
        // Fetch Ratings
        const { data: ratingsData } = await supabase
          .from('ratings')
          .select('to_pharmacy_id, stars')
          .in('to_pharmacy_id', pharmacyIds);

        // Fetch Success Scores (Archive counts)
        const { data: archiveData } = await supabase
          .from('sales_archive')
          .select('pharmacy_id')
          .in('pharmacy_id', pharmacyIds);

        // Map stats to pharmacies
        allOffers.forEach(offer => {
          if (offer.pharmacies) {
            const pRatings = ratingsData?.filter(r => Number(r.to_pharmacy_id) === Number(offer.pharmacy_id)) || [];
            const pArchive = archiveData?.filter(a => Number(a.pharmacy_id) === Number(offer.pharmacy_id)) || [];
            
            offer.pharmacies.rating = pRatings.length > 0 
              ? pRatings.reduce((sum, r) => sum + r.stars, 0) / pRatings.length 
              : 0;
            offer.pharmacies.review_count = pRatings.length;
            offer.pharmacies.success_score = pArchive.length;
            offer.pharmacies.is_verified = offer.pharmacies.rating >= 4 && offer.pharmacies.success_score >= 5;
          }
        });
      }

      // Sort by proximity to user's city
      const sorted = [...allOffers].sort((a, b) => {
        const cityA = a.pharmacies?.city || '';
        const cityB = b.pharmacies?.city || '';
        const distA = getDistance(userProfile.city, cityA);
        const distB = getDistance(userProfile.city, cityB);
        return distA - distB;
      });

      setOffers(sorted);
      setFilteredOffers(sorted);
    } catch (err) {
      console.error('Fetch Marketplace Error:', err);
      setError(err);
      toast.error(t('error_generic'));
    } finally {
      setLoading(false);
    }
  }, [userProfile.city, t]);

  useEffect(() => {
    fetchOffers();
  }, [fetchOffers]);

  useEffect(() => {
    let result = offers;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(o => 
        String(o.english_name || "").toLowerCase().includes(q) || 
        String(o.arabic_name || "").includes(q) || 
        String(o.barcode || "").includes(q)
      );
    }

    if (selectedCity) {
      result = result.filter(o => o.pharmacies?.city === selectedCity);
    }

    if (minDiscount > 0) {
      result = result.filter(o => o.discount >= minDiscount);
    }

    setFilteredOffers(result);
  }, [searchQuery, selectedCity, minDiscount, offers]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold text-slate-900">{t('marketplace')}</h1>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('search_placeholder')}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none"
            />
          </div>
          <button
            onClick={() => {
              console.log('Show Filters clicked');
              setShowFilters(!showFilters);
            }}
            className={cn(
              "p-2 rounded-xl border transition-all",
              showFilters ? "bg-primary text-white border-primary" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            )}
          >
            <SlidersHorizontal size={20} />
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
              <MapPin size={14} />
              {t('city')}
            </label>
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">{t('all_cities')}</option>
              {EGYPT_CITIES.map(city => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
              <Percent size={14} />
              {t('min_discount')}
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0"
                max="90"
                step="5"
                value={minDiscount}
                onChange={(e) => setMinDiscount(parseInt(e.target.value))}
                className="flex-1 accent-primary"
              />
              <span className="font-bold text-primary w-12 text-center">{minDiscount}%</span>
            </div>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                console.log('Reset Filters clicked');
                setSelectedCity('');
                setMinDiscount(0);
                setSearchQuery('');
              }}
              className="w-full py-2 text-slate-500 hover:text-slate-800 font-semibold flex items-center justify-center gap-2"
            >
              <X size={16} />
              Reset Filters
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-20 flex items-center justify-center">
            <Loader2 className="animate-spin text-primary" size={48} />
          </div>
        ) : filteredOffers.length > 0 ? (
          filteredOffers.map(offer => (
            <OfferCard
              key={offer.id}
              offer={offer}
              actionLabel="Contact Pharmacy"
              onAction={(o) => setSelectedOffer(o)}
              onConfirm={(o) => setRatingOffer(o)}
            />
          ))
        ) : (
          <div className="col-span-full py-20 text-center">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
              <Search size={40} />
            </div>
            <h3 className="text-xl font-bold text-slate-900">{error ? 'Failed to load offers' : 'No offers found'}</h3>
            <p className="text-slate-500">{error ? 'Please try again later' : 'Try adjusting your search or filters'}</p>
          </div>
        )}
      </div>

      {selectedOffer && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="bg-primary p-6 text-white flex justify-between items-center">
              <h2 className="text-xl font-bold">Pharmacy Details</h2>
              <button 
                onClick={() => setSelectedOffer(null)} 
                className="hover:bg-white/20 p-1 rounded-lg"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-primary">
                  <Building size={32} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">
                    {selectedOffer.pharmacies?.pharmacy_name || selectedOffer.pharmacy_name || 'Unknown Pharmacy'}
                  </h3>
                  <p className="text-slate-500 flex items-center gap-1">
                    <MapPin size={14} />
                    {selectedOffer.pharmacies?.city || selectedOffer.city || 'Unknown Location'}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-slate-600">
                      <Phone size={18} className="text-primary" />
                      <span className="font-medium">{selectedOffer.pharmacies?.phone || 'Not provided'}</span>
                    </div>
                    {selectedOffer.pharmacies?.phone && (
                      <a 
                        href={`tel:${selectedOffer.pharmacies.phone}`}
                        className="p-2 bg-white border border-slate-200 rounded-lg text-primary hover:bg-primary hover:text-white transition-all"
                      >
                        <Phone size={16} />
                      </a>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-slate-600">
                      <MessageSquare size={18} className="text-sky-500" />
                      <span className="font-medium">
                        {selectedOffer.pharmacies?.telegram ? `@${selectedOffer.pharmacies.telegram}` : 'Not provided'}
                      </span>
                    </div>
                    {selectedOffer.pharmacies?.telegram && (
                      <a 
                        href={`https://t.me/${selectedOffer.pharmacies.telegram}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 bg-white border border-slate-200 rounded-lg text-sky-500 hover:bg-sky-500 hover:text-white transition-all"
                      >
                        <ExternalLink size={16} />
                      </a>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase px-1">Full Address</label>
                  <p className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-slate-700 text-sm">
                    {selectedOffer.pharmacies?.address || selectedOffer.pharmacy_address}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedOffer(null)}
                className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {ratingOffer && (
        <RatingModal
          isOpen={!!ratingOffer}
          onClose={() => setRatingOffer(null)}
          ratedPharmacyId={ratingOffer.pharmacy_id}
          ratedPharmacyName={ratingOffer.pharmacies?.pharmacy_name || ratingOffer.pharmacy_name || ''}
          relatedItemId={ratingOffer.id}
          onSuccess={fetchOffers}
        />
      )}
    </div>
  );
};
