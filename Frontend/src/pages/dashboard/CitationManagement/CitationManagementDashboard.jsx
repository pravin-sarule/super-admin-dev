import React, { useState, useEffect } from 'react';
import { Settings } from 'lucide-react';
import CitationTopNav from './CitationTopNav';
import CitationMetricCards from './CitationMetricCards';
import ConfidenceDistributionChart from './ConfidenceDistributionChart';
import PipelineAgentStatus from './PipelineAgentStatus';
import HITLQueueView from './HITLQueueView';
import DataPipelineView from './DataPipelineView';
import RoutesDBView from './RoutesDBView';
import BusinessMetricsView from './BusinessMetricsView';
import { getOverview } from '../../../services/citationAdminApi';

export default function CitationManagementDashboard() {
    const [activeTab, setActiveTab] = useState('overview');
    const [overviewData, setOverviewData] = useState(null);
    const [overviewLoading, setOverviewLoading] = useState(true);
    const [overviewError, setOverviewError] = useState(null);

    useEffect(() => {
        if (activeTab !== 'overview') return;
        setOverviewLoading(true);
        setOverviewError(null);
        getOverview()
            .then((res) => res?.success && res?.data && setOverviewData(res.data))
            .catch((err) => setOverviewError(err.response?.data?.error?.message || err.message))
            .finally(() => setOverviewLoading(false));
    }, [activeTab]);

    const renderContent = () => {
        switch (activeTab) {
            case 'hitl':
                return <HITLQueueView />;
            case 'pipeline':
                return <DataPipelineView />;
            case 'routes':
                return <RoutesDBView />;
            case 'metrics':
                return <BusinessMetricsView />;
            case 'overview':
            default:
                return (
                    <>
                        {/* ── Header ── */}
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm">
                                <Settings className="w-4.5 h-4.5 text-white" />
                            </div>
                            <div>
                                <h1 className="text-lg font-bold text-slate-800 leading-tight">
                                    Jurinex Operations Center
                                </h1>
                                <p className="text-xs text-gray-400 mt-0.5">
                                    System health · Pipeline status · Real-time metrics
                                </p>
                            </div>
                        </div>

                        {overviewError && (
                            <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
                                {overviewError}
                            </div>
                        )}

                        {/* ── Metric Cards ── */}
                        <CitationMetricCards data={overviewData} loading={overviewLoading} />

                        {/* ── Bottom: Chart + Agent Status ── */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                            <ConfidenceDistributionChart
                                data={overviewData?.confidence_distribution}
                                loading={overviewLoading}
                            />
                            <PipelineAgentStatus />
                        </div>
                    </>
                );
        }
    };

    return (
        <div className="space-y-5">
            <CitationTopNav activeTab={activeTab} onTabChange={setActiveTab} />
            {renderContent()}
        </div>
    );
}
