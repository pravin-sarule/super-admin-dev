import AggregateAnalytics from './AggregateAnalytics';
import DependencyHealthPanel from './DependencyHealthPanel';
import DocumentInspectDashboard from './DocumentInspectDashboard';
import PipelineMonitor from './PipelineMonitor';
import SummaryCards from './SummaryCards';
import UploadSection from './UploadSection';
import useJudgementDashboard from './useJudgementDashboard';

const JudgementServiceDashboard = () => {
  const dashboard = useJudgementDashboard();

  if (dashboard.selectedDocumentId) {
    return (
      <DocumentInspectDashboard
        detailLoading={dashboard.detailLoading}
        detailStatus={dashboard.detailStatus}
        metadataForm={dashboard.metadataForm}
        onBack={dashboard.closeDetail}
        onMetadataFieldChange={dashboard.updateMetadataField}
        onReprocess={dashboard.handleReprocess}
        onSaveMetadata={dashboard.handleSaveMetadata}
        reprocessing={dashboard.reprocessing}
        savingMetadata={dashboard.savingMetadata}
        selectedDetail={dashboard.selectedDetail}
        selectedDocumentId={dashboard.selectedDocumentId}
        selectedUpload={dashboard.selectedUpload}
        textPreview={dashboard.textPreview}
      />
    );
  }

  return (
    <div className="space-y-6">
      <UploadSection
        feedback={dashboard.feedback}
        maxUploadFiles={dashboard.maxUploadFiles}
        onUpload={dashboard.handleUpload}
        setSourceUrl={dashboard.setSourceUrl}
        setUploadFiles={dashboard.setUploadFiles}
        sourceUrl={dashboard.sourceUrl}
        uploadFiles={dashboard.uploadFiles}
        uploading={dashboard.uploading}
      />

      <SummaryCards summary={dashboard.summary} />

      <AggregateAnalytics
        loading={dashboard.loading}
        summary={dashboard.summary}
      />

      <PipelineMonitor
        activeTab={dashboard.monitorView}
        counts={{
          processing: dashboard.processingUploads.length,
          duplicate: dashboard.duplicateUploads.length,
          completed: dashboard.completedUploads.length,
          failed: dashboard.failedUploads.length,
          archived: dashboard.archivedUploads.length,
        }}
        loading={dashboard.loading}
        onInspect={dashboard.loadDetail}
        onArchive={dashboard.handleArchive}
        onDelete={dashboard.handleDelete}
        onRefresh={dashboard.refreshDashboard}
        onReprocessFailed={dashboard.handleReprocessFailed}
        reprocessing={dashboard.reprocessing}
        refreshing={dashboard.refreshing}
        search={dashboard.search}
        selectedDocumentId={dashboard.selectedDocumentId}
        setActiveTab={dashboard.setMonitorView}
        setSearch={dashboard.setSearch}
        uploads={dashboard.visibleMonitorUploads}
      />

      <DependencyHealthPanel
        dependencyHealth={dashboard.dependencyHealth}
        dependencyHealthLoading={dashboard.dependencyHealthLoading}
        onRefresh={dashboard.refreshDashboard}
      />
    </div>
  );
};

export default JudgementServiceDashboard;
