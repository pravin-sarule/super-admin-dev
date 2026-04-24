import { startTransition, useDeferredValue, useEffect, useState } from 'react';
import judgementAdminApi from '../../../services/judgementAdminApi';
import { dedupeWarnings } from './helpers';
import { createPipelineReportLogger } from './logger';

const logger = createPipelineReportLogger('Dashboard');
const DEFAULT_SOURCE_TYPE = 'ik_pipeline';
const DEFAULT_PAGE_SIZE = 10;

function buildSummaryState(payload = {}) {
  return {
    descriptor: payload.descriptor || null,
    summary: payload.summary || null,
    stores: payload.stores || null,
    warnings: payload.warnings || [],
  };
}

export default function useJudgementPipelineReport({ sourceType = DEFAULT_SOURCE_TYPE } = {}) {
  const [summaryState, setSummaryState] = useState(() => buildSummaryState());
  const [judgments, setJudgments] = useState([]);
  const [tableWarnings, setTableWarnings] = useState([]);
  const [meta, setMeta] = useState({
    total: 0,
    limit: DEFAULT_PAGE_SIZE,
    offset: 0,
    search: '',
    hasMore: false,
  });
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(true);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [page, setPage] = useState(1);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedJudgmentUuid, setSelectedJudgmentUuid] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const deferredSearch = useDeferredValue(searchInput);
  const normalizedSourceType = String(sourceType || DEFAULT_SOURCE_TYPE).trim() || DEFAULT_SOURCE_TYPE;
  const offset = (page - 1) * pageSize;
  const refreshing = refreshNonce > 0 && (summaryLoading || tableLoading);

  useEffect(() => {
    let ignore = false;

    async function loadSummary() {
      setSummaryLoading(true);

      logger.flow('Loading pipeline report summary', {
        sourceType: normalizedSourceType,
      });

      try {
        const response = await judgementAdminApi.pipelineReportSummary({
          sourceType: normalizedSourceType,
        });

        if (ignore) return;

        setSummaryState(buildSummaryState(response));
        setErrorMessage('');
        logger.info('Pipeline report summary loaded', {
          sourceType: normalizedSourceType,
          postgresCount: response.stores?.postgres?.count || 0,
          elasticsearchCount: response.stores?.elasticsearch?.count || 0,
          qdrantCount: response.stores?.qdrant?.count || 0,
        });
      } catch (error) {
        if (ignore) return;

        setSummaryState(buildSummaryState());
        setErrorMessage(error.response?.data?.message || error.message || 'Failed to load pipeline summary');
        logger.error('Pipeline report summary failed', error, {
          sourceType: normalizedSourceType,
        });
      } finally {
        if (!ignore) {
          setSummaryLoading(false);
        }
      }
    }

    loadSummary();

    return () => {
      ignore = true;
    };
  }, [normalizedSourceType, refreshNonce]);

  useEffect(() => {
    let ignore = false;

    async function loadTable() {
      setTableLoading(true);

      logger.flow('Loading pipeline report table', {
        sourceType: normalizedSourceType,
        search: deferredSearch,
        page,
        pageSize,
        offset,
      });

      try {
        const response = await judgementAdminApi.pipelineReportList({
          sourceType: normalizedSourceType,
          search: deferredSearch,
          limit: pageSize,
          offset,
        });

        if (ignore) return;

        setJudgments(response.judgments || []);
        setTableWarnings(response.warnings || []);
        setErrorMessage('');
        setMeta(response.meta || {
          total: 0,
          limit: pageSize,
          offset,
          search: deferredSearch,
          hasMore: false,
        });
        logger.info('Pipeline report table loaded', {
          sourceType: normalizedSourceType,
          total: response.meta?.total || 0,
          returnedRows: (response.judgments || []).length,
        });
      } catch (error) {
        if (ignore) return;

        setJudgments([]);
        setTableWarnings([]);
        setMeta({
          total: 0,
          limit: pageSize,
          offset,
          search: deferredSearch,
          hasMore: false,
        });
        setErrorMessage(error.response?.data?.message || error.message || 'Failed to load pipeline rows');
        logger.error('Pipeline report table failed', error, {
          sourceType: normalizedSourceType,
          search: deferredSearch,
          page,
          pageSize,
        });
      } finally {
        if (!ignore) {
          setTableLoading(false);
        }
      }
    }

    loadTable();

    return () => {
      ignore = true;
    };
  }, [normalizedSourceType, deferredSearch, offset, page, pageSize, refreshNonce]);

  const warnings = dedupeWarnings([
    ...(summaryState.warnings || []),
    ...(tableWarnings || []),
  ]);

  function handleRefresh() {
    setErrorMessage('');
    setRefreshNonce((currentValue) => currentValue + 1);
  }

  async function loadJudgmentDetail(judgmentUuid) {
    const normalizedUuid = String(judgmentUuid || '').trim();
    if (!normalizedUuid) {
      return;
    }

    setSelectedJudgmentUuid(normalizedUuid);
    setDetailLoading(true);
    setDetailError('');

    try {
      const response = await judgementAdminApi.pipelineReportDetail(normalizedUuid);
      setSelectedDetail(response.detail || null);
      logger.info('Pipeline judgment detail loaded', {
        judgmentUuid: normalizedUuid,
        chunks: response.detail?.chunks?.length || 0,
        aliases: response.detail?.aliases?.length || 0,
      });
    } catch (error) {
      setSelectedDetail(null);
      setDetailError(error.response?.data?.message || error.message || 'Failed to load judgment detail');
      logger.error('Pipeline judgment detail failed', error, {
        judgmentUuid: normalizedUuid,
      });
    } finally {
      setDetailLoading(false);
    }
  }

  function closeJudgmentDetail() {
    setSelectedJudgmentUuid(null);
    setSelectedDetail(null);
    setDetailError('');
  }

  function handleSearchChange(value) {
    setErrorMessage('');
    startTransition(() => {
      setSearchInput(value);
      setPage(1);
    });
  }

  function handlePageSizeChange(value) {
    setPageSize(value);
    setPage(1);
  }

  return {
    currentPage: page,
    descriptor: summaryState.descriptor,
    errorMessage,
    judgments,
    loading: summaryLoading || tableLoading,
    meta,
    pageSize,
    refreshing,
    searchInput,
    setCurrentPage: setPage,
    setPageSize: handlePageSizeChange,
    setSearchInput: handleSearchChange,
    sourceType: normalizedSourceType,
    stores: summaryState.stores,
    summary: summaryState.summary,
    summaryLoading,
    tableLoading,
    warnings,
    handleRefresh,
    selectedJudgmentUuid,
    selectedDetail,
    detailLoading,
    detailError,
    loadJudgmentDetail,
    closeJudgmentDetail,
  };
}
