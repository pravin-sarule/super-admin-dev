import React from 'react';
import { LayoutDashboard, ListChecks, Settings, Database, TrendingUp } from 'lucide-react';

const tabs = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'hitl', label: 'HITL Queue', icon: ListChecks },
    { id: 'pipeline', label: 'Data Pipeline', icon: Settings },
    { id: 'routes', label: 'Routes & DB', icon: Database },
    { id: 'metrics', label: 'Business Metrics', icon: TrendingUp },
];

export default function CitationTopNav({ activeTab, onTabChange }) {
    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
            <nav className="flex min-w-max">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => onTabChange(tab.id)}
                            className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${isActive
                                    ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                                    : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                                }`}
                        >
                            <Icon className="w-4 h-4 flex-shrink-0" />
                            {tab.label}
                        </button>
                    );
                })}
            </nav>
        </div>
    );
}
