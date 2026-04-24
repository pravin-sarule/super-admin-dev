import React from 'react';
import PipelineFlowPanel from './PipelineFlowPanel';
import PipelineInspectDashboard from './PipelineInspectDashboard';
import PipelineJudgmentTable from './PipelineJudgmentTable';
import PipelineSummaryCards from './PipelineSummaryCards';
import useJudgementPipelineReport from './useJudgementPipelineReport';

const JudgementPipelineReportDashboard = ({ sourceType = 'ik_pipeline' }) => {
  const dashboard = useJudgementPipelineReport({ sourceType });
  const isInspecting = Boolean(dashboard.selectedJudgmentUuid);

  if (isInspecting) {
    return (
      <PipelineInspectDashboard
        detail={dashboard.selectedDetail}
        detailError={dashboard.detailError}
        detailLoading={dashboard.detailLoading}
        judgmentUuid={dashboard.selectedJudgmentUuid}
        onBack={dashboard.closeJudgmentDetail}
      />
    );
  }

  return (
    <div className="space-y-6">
      {dashboard.errorMessage ? (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {dashboard.errorMessage}
        </section>
      ) : null}

      <PipelineFlowPanel
        descriptor={dashboard.descriptor}
        stores={dashboard.stores}
        summary={dashboard.summary}
        warnings={dashboard.warnings}
      />

      <PipelineSummaryCards
        stores={dashboard.stores}
        summary={dashboard.summary}
      />

      <PipelineJudgmentTable
        currentPage={dashboard.currentPage}
        judgments={dashboard.judgments}
        loading={dashboard.tableLoading}
        meta={dashboard.meta}
        onInspect={(judgment) => dashboard.loadJudgmentDetail(judgment.judgmentUuid)}
        onRefresh={dashboard.handleRefresh}
        pageSize={dashboard.pageSize}
        refreshing={dashboard.refreshing}
        searchInput={dashboard.searchInput}
        setCurrentPage={dashboard.setCurrentPage}
        setPageSize={dashboard.setPageSize}
        setSearchInput={dashboard.setSearchInput}
      />
    </div>
  );
};

export default JudgementPipelineReportDashboard;
