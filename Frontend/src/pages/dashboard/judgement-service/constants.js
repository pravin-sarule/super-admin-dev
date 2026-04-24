import {
  AlertCircle,
  CheckCircle2,
  FileText,
  FileUp,
  LoaderCircle,
} from 'lucide-react';

export const STATUS_STYLES = {
  uploaded: 'bg-slate-100 text-slate-700 border-slate-200',
  splitting: 'bg-blue-100 text-blue-700 border-blue-200',
  ocr_processing: 'bg-amber-100 text-amber-800 border-amber-200',
  metadata_extracting: 'bg-purple-100 text-purple-800 border-purple-200',
  indexing: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  duplicate_detected: 'bg-amber-100 text-amber-800 border-amber-200',
  completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  failed: 'bg-rose-100 text-rose-700 border-rose-200',
  archived: 'bg-slate-100 text-slate-700 border-slate-200',
};

export const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'uploaded', label: 'Uploaded' },
  { value: 'splitting', label: 'Splitting' },
  { value: 'ocr_processing', label: 'OCR Processing' },
  { value: 'metadata_extracting', label: 'Metadata Extracting' },
  { value: 'indexing', label: 'Indexing' },
  { value: 'duplicate_detected', label: 'Duplicate Detected' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'archived', label: 'Archived' },
];

export function getSummaryCards(summary) {
  return [
    {
      key: 'total',
      label: 'Total Uploads',
      value: summary?.total || 0,
      tone: 'from-slate-50 to-slate-100',
      icon: FileText,
    },
    {
      key: 'uploaded',
      label: 'Queued',
      value: summary?.uploaded || 0,
      tone: 'from-blue-50 to-blue-100',
      icon: FileUp,
    },
    {
      key: 'ocr_processing',
      label: 'OCR Running',
      value: summary?.ocr_processing || 0,
      tone: 'from-amber-50 to-amber-100',
      icon: LoaderCircle,
    },
    {
      key: 'duplicate_detected',
      label: 'Duplicates',
      value: summary?.duplicate_detected || 0,
      tone: 'from-amber-50 to-amber-100',
      icon: AlertCircle,
    },
    {
      key: 'completed',
      label: 'Completed',
      value: summary?.completed || 0,
      tone: 'from-emerald-50 to-emerald-100',
      icon: CheckCircle2,
    },
    {
      key: 'failed',
      label: 'Failed',
      value: summary?.failed || 0,
      tone: 'from-rose-50 to-rose-100',
      icon: AlertCircle,
    },
  ];
}
