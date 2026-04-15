import { useEffect, useRef, useState } from 'react';
import judgementAdminApi from '../../../services/judgementAdminApi';
import {
  buildMetadataForm,
  hasMetadataDraft,
  isActivePipelineStatus,
  normalizeMetadataPayload,
} from './helpers';

const MAX_UPLOAD_FILES = Math.max(1, Number(import.meta.env.VITE_JUDGEMENT_UPLOAD_MAX_FILES || 100));

export default function useJudgementDashboard() {
  const [uploads, setUploads] = useState([]);
  const [summary, setSummary] = useState(null);
  const [dependencyHealth, setDependencyHealth] = useState({
    overallStatus: 'unknown',
    checkedAt: null,
    unhealthyCount: 0,
    dependencies: [],
  });
  const [dependencyHealthLoading, setDependencyHealthLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [uploadFiles, setUploadFiles] = useState([]);
  const [sourceUrl, setSourceUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState('');
  const [monitorView, setMonitorView] = useState('processing');
  const [feedback, setFeedback] = useState(null);
  const [metadataForm, setMetadataForm] = useState(buildMetadataForm(null));
  const [savingMetadata, setSavingMetadata] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);
  const hasInitializedFilters = useRef(false);
  const previousSelectedStatusRef = useRef(null);
  const previousPipelineErrorRef = useRef(null);
  const previousDependencySignatureRef = useRef('');

  const selectedUpload = uploads.find((upload) => upload.documentId === selectedDocumentId) || null;
  const detailStatus = selectedDetail?.upload?.status || selectedUpload?.status;
  const textPreview = selectedDetail?.upload?.mergedText || '';
  const processingUploads = uploads.filter((upload) => isActivePipelineStatus(upload.status));
  const completedUploads = uploads.filter((upload) => upload.status === 'completed');
  const failedUploads = uploads.filter((upload) => upload.status === 'failed');
  const archivedUploads = uploads.filter((upload) => upload.status === 'archived');
  const visibleMonitorUploads =
    monitorView === 'completed'
      ? completedUploads
      : monitorView === 'failed'
        ? failedUploads
        : monitorView === 'archived'
          ? archivedUploads
          : processingUploads;

  const clearTransientDashboardError = () => {
    setFeedback((current) => {
      if (current?.tone !== 'error') {
        return current;
      }

      if (
        /failed to load judgement dashboard/i.test(current.message || '') ||
        /judgement service is unavailable/i.test(current.message || '') ||
        /status code 502/i.test(current.message || '') ||
        /bad gateway/i.test(current.message || '')
      ) {
        return null;
      }

      return current;
    });
  };

  const loadDashboard = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    if (silent) setRefreshing(true);

    try {
      const [summaryResponse, listResponse] = await Promise.all([
        judgementAdminApi.summary(),
        judgementAdminApi.list({
          search,
          status: 'all',
        }),
      ]);

      setSummary(summaryResponse.summary || null);
      setUploads(listResponse.uploads || []);
      clearTransientDashboardError();
    } catch (error) {
      if (!silent) {
        console.error('[JudgementManagement] Failed to load dashboard', error);
        setFeedback({
          tone: 'error',
          message: error.response?.data?.message || error.message || 'Failed to load judgement dashboard',
        });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadDependencyHealth = async ({ silent = false } = {}) => {
    if (!silent) {
      setDependencyHealthLoading(true);
    }

    try {
      const response = await judgementAdminApi.dependencyHealth();
      setDependencyHealth({
        overallStatus: response.overallStatus || 'unknown',
        checkedAt: response.checkedAt || null,
        unhealthyCount: response.unhealthyCount || 0,
        dependencies: response.dependencies || [],
      });
    } catch (error) {
      if (!silent) {
        console.error('[JudgementManagement] Failed to load dependency health', error);
      }

      setDependencyHealth({
        overallStatus: 'degraded',
        checkedAt: new Date().toISOString(),
        unhealthyCount: 1,
        dependencies: [
          {
            key: 'judgement_health_monitor',
            label: 'Dependency Monitor',
            status: 'unhealthy',
            message: error.response?.data?.message || error.message || 'Dependency health endpoint is unavailable',
            latencyMs: null,
          },
        ],
      });
    } finally {
      if (!silent) {
        setDependencyHealthLoading(false);
      }
    }
  };

  const refreshSelectedDetail = async (documentId, { preserveMetadataDraft = false } = {}) => {
    const response = await judgementAdminApi.detail(documentId);
    const detail = response.detail || null;

    setSelectedDetail(detail);
    setMetadataForm((current) => {
      const next = buildMetadataForm(detail);
      return preserveMetadataDraft && hasMetadataDraft(current) ? current : next;
    });

    return detail;
  };

  const loadDetail = async (documentId) => {
    setSelectedDocumentId(documentId);
    setDetailLoading(true);

    try {
      await refreshSelectedDetail(documentId);
    } catch (error) {
      console.error('[JudgementManagement] Failed to load detail', error);
      setFeedback({
        tone: 'error',
        message: error.response?.data?.message || error.message || 'Failed to load judgement detail',
      });
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
    loadDependencyHealth();
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      loadDependencyHealth({ silent: true });
    }, 20000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!hasInitializedFilters.current) {
      hasInitializedFilters.current = true;
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      loadDashboard({ silent: true });
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [search]);

  useEffect(() => {
    const hasActiveUploads = uploads.some((upload) => isActivePipelineStatus(upload.status));
    const shouldPoll = hasActiveUploads || isActivePipelineStatus(detailStatus);

    if (!shouldPoll) return undefined;

    const intervalId = window.setInterval(async () => {
      await loadDashboard({ silent: true });

      if (!selectedDocumentId) return;

      try {
        await refreshSelectedDetail(selectedDocumentId, { preserveMetadataDraft: true });
      } catch (error) {
        console.error('[JudgementManagement] Poll detail refresh failed', error);
      }
    }, 4000);

    return () => window.clearInterval(intervalId);
  }, [uploads, selectedDocumentId, detailStatus, search]);

  useEffect(() => {
    const upload = selectedDetail?.upload;
    if (!upload) return;

    if (previousSelectedStatusRef.current !== upload.status) {
      if (upload.status === 'failed') {
        console.log('[JudgementDashboard] Status changed to failed', {
          documentId: upload.documentId,
          originalFilename: upload.originalFilename,
          lastProgressMessage: upload.lastProgressMessage,
        });
      }

      previousSelectedStatusRef.current = upload.status;
    }

    if (upload.errorMessage && previousPipelineErrorRef.current !== upload.errorMessage) {
      console.error(`[JudgementDashboard] Pipeline error: ${upload.errorMessage}`, {
        documentId: upload.documentId,
        originalFilename: upload.originalFilename,
        status: upload.status,
        lastProgressMessage: upload.lastProgressMessage,
      });
      previousPipelineErrorRef.current = upload.errorMessage;
      return;
    }

    if (!upload.errorMessage) {
      previousPipelineErrorRef.current = null;
    }
  }, [selectedDetail]);

  useEffect(() => {
    const unhealthyDependencies = (dependencyHealth.dependencies || []).filter(
      (dependency) => dependency.status !== 'healthy'
    );
    const signature = unhealthyDependencies
      .map((dependency) => `${dependency.key}:${dependency.status}:${dependency.message}`)
      .join('|');

    if (!unhealthyDependencies.length) {
      previousDependencySignatureRef.current = '';
      return;
    }

    if (previousDependencySignatureRef.current === signature) {
      return;
    }

    console.warn('[JudgementDashboard] Dependency issues detected');
    console.table(
      unhealthyDependencies.map((dependency) => ({
        dependency: dependency.label,
        status: dependency.status,
        message: dependency.message,
        latencyMs: dependency.latencyMs,
      }))
    );

    previousDependencySignatureRef.current = signature;
  }, [dependencyHealth]);

  const handleUpload = async () => {
    if (!uploadFiles.length) {
      setFeedback({ tone: 'error', message: 'Please choose at least one PDF before uploading.' });
      return;
    }

    if (uploadFiles.length > MAX_UPLOAD_FILES) {
      setFeedback({
        tone: 'error',
        message: `You can upload up to ${MAX_UPLOAD_FILES} files at a time.`,
      });
      return;
    }

    setUploading(true);
    setFeedback(null);

    try {
      const response = await judgementAdminApi.upload({
        files: uploadFiles,
        sourceUrl,
      });

      console.log('[JudgementDashboard] Upload accepted', {
        filesAccepted: response.filesAccepted || response.uploads?.length || uploadFiles.length,
        documentIds: (response.uploads || []).map((upload) => upload.documentId),
        originalFilenames:
          (response.uploads || []).map((upload) => upload.originalFilename)
            .filter(Boolean),
        sourceUrl: sourceUrl || null,
      });

      setFeedback({
        tone: 'success',
        message: response.message || 'Judgment uploaded and pipeline started.',
      });
      setUploadFiles([]);
      setSourceUrl('');

      await loadDashboard({ silent: true });

      if (response.uploads?.[0]?.documentId || response.upload?.documentId) {
        await loadDetail(response.uploads?.[0]?.documentId || response.upload.documentId);
      }
    } catch (error) {
      console.error('[JudgementManagement] Upload failed', error);
      setFeedback({
        tone: 'error',
        message: error.response?.data?.message || error.message || 'Upload failed',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSaveMetadata = async () => {
    if (!selectedDocumentId) return;

    setSavingMetadata(true);
    setFeedback(null);

    try {
      await judgementAdminApi.updateMetadata(selectedDocumentId, normalizeMetadataPayload(metadataForm));

      setFeedback({
        tone: 'success',
        message: 'Metadata updated successfully.',
      });

      await refreshSelectedDetail(selectedDocumentId);
      await loadDashboard({ silent: true });
    } catch (error) {
      console.error('[JudgementManagement] Metadata update failed', error);
      setFeedback({
        tone: 'error',
        message: error.response?.data?.message || error.message || 'Failed to update metadata',
      });
    } finally {
      setSavingMetadata(false);
    }
  };

  const handleReprocess = async () => {
    if (!selectedDocumentId) return;

    setReprocessing(true);
    setFeedback(null);

    try {
      const response = await judgementAdminApi.reprocess(selectedDocumentId);
      setFeedback({
        tone: 'success',
        message: response.message || 'Judgment reprocessing started.',
      });

      await loadDashboard({ silent: true });
      await refreshSelectedDetail(selectedDocumentId);
    } catch (error) {
      console.error('[JudgementManagement] Reprocess failed', error);
      setFeedback({
        tone: 'error',
        message: error.response?.data?.message || error.message || 'Failed to reprocess judgment',
      });
    } finally {
      setReprocessing(false);
    }
  };

  const handleReprocessFailed = async () => {
    setReprocessing(true);
    setFeedback(null);

    try {
      const response = await judgementAdminApi.reprocessFailed();
      setFeedback({
        tone: 'success',
        message: response.message || 'All failed judgments queued for reprocessing.',
      });

      await loadDashboard({ silent: true });
    } catch (error) {
      console.error('[JudgementManagement] Reprocess failed', error);
      setFeedback({
        tone: 'error',
        message: error.response?.data?.message || error.message || 'Failed to reprocess failed judgments',
      });
    } finally {
      setReprocessing(false);
    }
  };

  const updateMetadataField = (field, value) => {
    setMetadataForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const refreshDashboard = async () => {
    await Promise.all([
      loadDashboard({ silent: true }),
      loadDependencyHealth(),
    ]);
  };

  const handleDelete = async (documentId) => {
    if (!window.confirm('Are you sure you want to completely delete this judgment? This will wipe the database records, object storage, Qdrant vectors, and Elasticsearch data. This action cannot be undone.')) {
      return;
    }

    try {
      await judgementAdminApi.deleteJudgment(documentId);
      setFeedback({ type: 'success', message: 'Judgment completely deleted from all systems' });
      
      if (selectedDocumentId === documentId) {
        closeDetail();
      }
      
      loadDashboard({ silent: true });
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to delete judgment' });
    }
  };

  const handleArchive = async (documentId) => {
    if (!window.confirm('Send this judgment to the archive? It will be hidden from the main view.')) {
      return;
    }

    try {
      await judgementAdminApi.archiveJudgment(documentId);
      setFeedback({ type: 'success', message: 'Judgment archived successfully' });
      
      if (selectedDocumentId === documentId) {
        closeDetail();
      }
      
      loadDashboard({ silent: true });
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to archive judgment' });
    }
  };

  const closeDetail = () => {
    setSelectedDocumentId(null);
    setSelectedDetail(null);
    setMetadataForm(buildMetadataForm(null));
    previousSelectedStatusRef.current = null;
    previousPipelineErrorRef.current = null;
  };

  return {
    archivedUploads,
    closeDetail,
    dependencyHealth,
    dependencyHealthLoading,
    detailLoading,
    detailStatus,
    feedback,
    failedUploads,
    handleArchive,
    handleDelete,
    handleReprocess,
    handleReprocessFailed,
    handleSaveMetadata,
    handleUpload,
    loadDashboard,
    loadDetail,
    loading,
    metadataForm,
    monitorView,
    processingUploads,
    refreshing,
    refreshDashboard,
    loadDependencyHealth,
    reprocessing,
    savingMetadata,
    search,
    selectedDetail,
    selectedDocumentId,
    selectedUpload,
    setMonitorView,
    setSearch,
    setSourceUrl,
    setUploadFiles,
    sourceUrl,
    summary,
    textPreview,
    updateMetadataField,
    uploadFiles,
    completedUploads,
    maxUploadFiles: MAX_UPLOAD_FILES,
    uploading,
    uploads,
    visibleMonitorUploads,
  };
}
