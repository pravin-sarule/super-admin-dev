import React from 'react';
import { FileCheck, Hourglass, Ban, Users, DollarSign } from 'lucide-react';

function formatNum(n) {
    if (n == null || n === '') return '0';
    const num = Number(n);
    return isNaN(num) ? '0' : num.toLocaleString('en-IN');
}

const cardConfig = [
    {
        id: 'verified',
        title: 'VERIFIED CITATIONS',
        valueKey: 'verified_judgments_count',
        subKey: 'today_citations_added',
        subPrefix: '+',
        subSuffix: ' today',
        icon: FileCheck,
        valueColor: 'text-green-600',
        bgIcon: 'bg-green-50',
        iconColor: 'text-green-500',
        borderAccent: 'border-l-green-500',
    },
    {
        id: 'hitl',
        title: 'HITL PENDING',
        valueKey: 'hitl_pending_count',
        sub: 'pending review',
        icon: Hourglass,
        valueColor: 'text-amber-600',
        bgIcon: 'bg-amber-50',
        iconColor: 'text-amber-500',
        borderAccent: 'border-l-amber-500',
    },
    {
        id: 'blacklisted',
        title: 'BLACKLISTED',
        valueKey: 'blacklist_count',
        sub: 'excluded',
        icon: Ban,
        valueColor: 'text-red-600',
        bgIcon: 'bg-red-50',
        iconColor: 'text-red-500',
        borderAccent: 'border-l-red-500',
    },
    {
        id: 'total',
        title: 'TOTAL JUDGMENTS',
        valueKey: 'total_judgments',
        subKey: 'unverified_judgments_count',
        subSuffix: ' unverified',
        icon: Users,
        valueColor: 'text-blue-600',
        bgIcon: 'bg-blue-50',
        iconColor: 'text-blue-500',
        borderAccent: 'border-l-blue-500',
    },
    {
        id: 'avgconf',
        title: 'AVG CONFIDENCE',
        valueKey: 'avg_confidence_score',
        format: (v) => v != null ? `${(Number(v) * 100).toFixed(1)}%` : '—',
        subKey: 'today_citations_added',
        subPrefix: '+',
        subSuffix: ' today',
        icon: DollarSign,
        valueColor: 'text-emerald-600',
        bgIcon: 'bg-emerald-50',
        iconColor: 'text-emerald-500',
        borderAccent: 'border-l-emerald-500',
    },
];

export default function CitationMetricCards({ data, loading }) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
            {cardConfig.map((card) => {
                const Icon = card.icon;
                const rawVal = data ? data[card.valueKey] : null;
                const value = card.format ? card.format(rawVal) : formatNum(rawVal);

                let sub = card.sub || '';
                if (card.subKey && data && data[card.subKey] != null)
                    sub = (card.subPrefix || '') + formatNum(data[card.subKey]) + (card.subSuffix || '');

                return (
                    <div
                        key={card.id}
                        className={`
                            bg-white rounded-xl border border-gray-200 border-l-[3px] ${card.borderAccent}
                            shadow-sm p-4 hover:shadow-md transition-shadow flex items-start gap-3
                        `}
                    >
                        {/* Icon badge */}
                        <div className={`${card.bgIcon} p-2 rounded-lg flex-shrink-0`}>
                            <Icon className={`w-5 h-5 ${card.iconColor}`} />
                        </div>

                        {/* Content */}
                        <div className="min-w-0">
                            <p className={`text-xl font-bold leading-tight ${card.valueColor}`}>
                                {loading ? '—' : value}
                            </p>
                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.1em] mt-0.5">
                                {card.title}
                            </p>
                            {sub && (
                                <p className="text-[10px] text-gray-400 mt-0.5 truncate">{sub}</p>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
