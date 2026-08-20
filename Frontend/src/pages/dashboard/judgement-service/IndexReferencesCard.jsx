import React from 'react';

const IndexReferencesCard = ({ selectedDetail }) => {
  const aliases = selectedDetail?.aliases || [];
  const rows = [
    { label: 'Canonical ID', value: selectedDetail?.upload?.canonicalId || 'Pending' },
    { label: 'ES Doc ID', value: selectedDetail?.upload?.esDocId || 'Pending' },
    { label: 'Qdrant Collection', value: selectedDetail?.upload?.qdrantCollection || 'Pending' },
  ];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-900">Aliases & Index Refs</h3>
      </div>

      <div className="divide-y divide-slate-100">
        {rows.map((row) => (
          <div key={row.label} className="flex items-start justify-between gap-4 px-4 py-2.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {row.label}
            </span>
            <span className="break-all text-right text-sm font-medium text-slate-900">{row.value}</span>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-100 px-4 py-2.5">
        {aliases.length ? (
          <div className="flex flex-wrap gap-1.5">
            {aliases.map((alias, index) => (
              <span
                key={`${alias.normalized}-${index}`}
                className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-700"
              >
                {alias.alias_string}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-slate-500">No aliases captured yet.</p>
        )}
      </div>
    </section>
  );
};

export default IndexReferencesCard;
