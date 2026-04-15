import React from 'react';

const TextPreviewCard = ({ textPreview }) => (
  <div className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
    <h3 className="text-lg font-semibold text-slate-900">Text Preview</h3>
    <div className="mt-4 h-[720px] overflow-y-auto whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-700">
      {textPreview || 'Merged OCR/text output will appear here once processing reaches the merge step.'}
    </div>
  </div>
);

export default TextPreviewCard;
