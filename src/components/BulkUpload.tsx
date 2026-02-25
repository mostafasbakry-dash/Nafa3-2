import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileSpreadsheet, Download, Upload, Loader2, AlertTriangle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'react-hot-toast';

export const BulkUpload = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const downloadTemplate = () => {
    console.log('Download Template clicked');
    const template = [
      {
        'Barcode': '6221000000001',
        'Drug Name EN': 'Panadol Advance',
        'Drug Name AR': 'بانادول ادفانس',
        'Expiry Date (YYYY-MM-DD)': '2026-05-01',
        'Discount %': 25,
        'Quantity': 10,
        'Price': 120
      }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'Nafa3_Template.xlsx');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('File Upload triggered');
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setProgress(0);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        toast.error('The file is empty');
        return;
      }

      const pharmacy_id_str = localStorage.getItem('pharmacy_id');
      const pharmacy_id = pharmacy_id_str ? parseInt(pharmacy_id_str) : 0;
      
      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i] as any;
        
        // Map Excel columns to our API format
        const payload = {
          pharmacy_id: pharmacy_id,
          barcode: row['Barcode'] ? row['Barcode'].toString().replace(/\D/g, '') : "0",
          english_name: row['Drug Name EN'],
          arabic_name: row['Drug Name AR'],
          expiry_date: row['Expiry Date (YYYY-MM-DD)'],
          discount: row['Discount %'],
          quantity: row['Quantity'],
          price: row['Price']
        };

        await fetch('https://n8n.srv1168218.hstgr.cloud/webhook/add-offer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payload }),
        });

        setProgress(Math.round(((i + 1) / jsonData.length) * 100));
      }

      toast.success(`Successfully uploaded ${jsonData.length} items!`);
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Failed to process Excel file');
    } finally {
      setLoading(false);
      setProgress(0);
      if (e.target) e.target.value = '';
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
      <div className="flex flex-col md:flex-row items-center gap-8">
        <div className="w-24 h-24 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center shrink-0">
          <FileSpreadsheet size={48} />
        </div>
        
        <div className="flex-1 text-center md:text-start">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">{t('bulk_upload')}</h2>
          <p className="text-slate-500 mb-6">
            Upload multiple offers at once using our Excel template. 
            Each row will be processed and added to your inventory.
          </p>
          
          <div className="flex flex-wrap gap-4 justify-center md:justify-start">
            <button
              onClick={downloadTemplate}
              className="flex items-center gap-2 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-all"
            >
              <Download size={20} />
              {t('download_template')}
            </button>
            
            <label className="relative flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary-dark text-white rounded-xl font-bold transition-all cursor-pointer shadow-md shadow-primary/20">
              <Upload size={20} />
              {t('upload_file')}
              <input
                type="file"
                accept=".xlsx, .xls"
                onChange={handleFileUpload}
                className="hidden"
                disabled={loading}
              />
            </label>
          </div>
        </div>
      </div>

      {loading && (
        <div className="mt-8 space-y-4">
          <div className="flex justify-between items-center text-sm font-bold text-slate-600">
            <span className="flex items-center gap-2">
              <Loader2 className="animate-spin" size={16} />
              Processing items...
            </span>
            <span>{progress}%</span>
          </div>
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-300" 
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      <div className="mt-8 p-4 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-3">
        <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={20} />
        <div className="text-sm text-amber-800">
          <p className="font-bold mb-1">Important Note:</p>
          <p>Please ensure all dates are in YYYY-MM-DD format and barcodes are 13-digit numbers. Duplicate items (same barcode and expiry) will be flagged.</p>
        </div>
      </div>
    </div>
  );
};
