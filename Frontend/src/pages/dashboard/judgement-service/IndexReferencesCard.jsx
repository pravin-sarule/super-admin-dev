import React from 'react';

const IndexReferencesCard = ({ selectedDetail }) => (
  <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
    <h3 className="text-lg font-semibold text-slate-900">Aliases & Index Refs</h3>
    <div className="mt-4 space-y-3 text-sm text-slate-600">
      <div>
        <span className="font-medium text-slate-800">Canonical ID:</span>{' '}
        {selectedDetail?.upload?.canonicalId || 'Pending'}
      </div>
      <div>
        <span className="font-medium text-slate-800">ES Doc ID:</span>{' '}
        {selectedDetail?.upload?.esDocId || 'Pending'}
      </div>
      <div>
        <span className="font-medium text-slate-800">Qdrant Collection:</span>{' '}
        {selectedDetail?.upload?.qdrantCollection || 'Pending'}
      </div>
      <div className="flex flex-wrap gap-2 pt-2">
        {(selectedDetail?.aliases || []).length ? (
          selectedDetail.aliases.map((alias, index) => (
            <span
              key={`${alias.normalized}-${index}`}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700"
            >
              {alias.alias_string}
            </span>
          ))
        ) : (
          <span className="text-slate-500">No aliases captured yet.</span>
        )}
      </div>
    </div>
  </div>
);

export default IndexReferencesCard;
