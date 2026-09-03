import { useCallback, useEffect, useRef, useState } from 'react';
import judgementAdminApi from '../../../services/judgementAdminApi';

const PAGE_SIZE = 20;
const MAX_FILES = Math.max(1, Number(import.meta.env.VITE_LIBRARY_UPLOAD_MAX_FILES || 20));

const EMPTY_UPLOAD_FIELDS = { title: '', docsource: '', publishdate: '', author: '', bench: '' };
const EMPTY_EDIT_FORM = { title: '', docsource: '', publishdate: '', author: '', bench: '' };

function errorMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback;
}

function editFormFromRecord(record) {
  if (!record) return { ...EMPTY_EDIT_FORM };
  return {
    title: record.title || '',
    docsource: record.docsource || '',
    publishdate: record.publishdate || '',
    author: record.author || '',
    bench: record.bench || '',
  };
}

export default function useJudgementLibrary() {
  // list
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // upload
  const [uploadFiles, setUploadFiles] = useState([]);
  const [uploadFields, setUploadFields] = useState({ ...EMPTY_UPLOAD_FIELDS });
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState(null);

  // record view
  const [selectedTid, setSelectedTid] = useState(null);
  const [record, setRecord] = useState(null);
  const [recordLoading, setRecordLoading] = useState(false);
  const [editForm, setEditForm] = useState({ ...EMPTY_EDIT_FORM });
  const [saving, setSaving] = useState(false);
  const [deletingTid, setDeletingTid] = useState(null);

  const [feedback, setFeedback] = useState(null);
  const searchTimer = useRef(null);

  const loadList = useCallback(async ({ silent = false, page: pageOverride, search: searchOverride } = {}) => {
    if (silent) setRefreshing(true);
    else setLoading(true);

    try {
      const response = await judgementAdminApi.libraryList({
        page: pageOverride ?? page,
        size: PAGE_SIZE,
        search: searchOverride ?? search,
      });
      setRows(response.rows || []);
      setTotal(Number(response.total || 0));
    } catch (error) {
      console.error('[JudgementLibrary] Failed to load list', error);
      setFeedback({ tone: 'error', message: errorMessage(error, 'Failed to load the judgment library') });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, search]);

  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const updateSearch = (value) => {
    setSearch(value);
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => {
      setPage(1);
      loadList({ silent: true, page: 1, search: value });
    }, 400);
  };

  const updateUploadField = (key, value) => {
    setUploadFields((current) => ({ ...current, [key]: value }));
  };

  const handleUpload = async () => {
    if (!uploadFiles.length) {
      setFeedback({ tone: 'error', message: 'Choose at least one PDF first.' });
      return;
    }
    if (uploadFiles.length > MAX_FILES) {
      setFeedback({ tone: 'error', message: `Upload at most ${MAX_FILES} PDFs at a time.` });
      return;
    }

    setUploading(true);
    setFeedback(null);
    setUploadResults(null);

    try {
      const response = await judgementAdminApi.libraryUpload({ files: uploadFiles, fields: uploadFields });
      setUploadResults(response);
      setFeedback({
        tone: response.summary?.indexed ? 'success' : 'error',
        message: response.message || 'Upload finished.',
      });
      setUploadFiles([]);
      await loadList({ silent: true, page: 1 });
      setPage(1);
    } catch (error) {
      console.error('[JudgementLibrary] Upload failed', error);
      const data = error?.response?.data;
      if (data?.results) setUploadResults(data);
      setFeedback({ tone: 'error', message: errorMessage(error, 'Upload failed') });
    } finally {
      setUploading(false);
    }
  };

  const refreshRecord = async (tid = selectedTid) => {
    if (!tid) return null;
    setRecordLoading(true);
    try {
      const response = await judgementAdminApi.libraryDetail(tid);
      const next = response.record || null;
      setRecord(next);
      setEditForm(editFormFromRecord(next));
      return next;
    } catch (error) {
      console.error('[JudgementLibrary] Failed to load record', error);
      setFeedback({ tone: 'error', message: errorMessage(error, 'Failed to load the library record') });
      return null;
    } finally {
      setRecordLoading(false);
    }
  };

  const openRecord = async (tid) => {
    setSelectedTid(tid);
    setRecord(null);
    setFeedback(null);
    await refreshRecord(tid);
  };

  const closeRecord = () => {
    setSelectedTid(null);
    setRecord(null);
    setEditForm({ ...EMPTY_EDIT_FORM });
  };

  const updateEditField = (key, value) => {
    setEditForm((current) => ({ ...current, [key]: value }));
  };

  const editDirty = record
    ? Object.keys(EMPTY_EDIT_FORM).some((key) => String(editForm[key] || '').trim() !== String(record[key] || '').trim())
    : false;

  const handleSave = async () => {
    if (!selectedTid || !record) return;

    const payload = {};
    for (const key of Object.keys(EMPTY_EDIT_FORM)) {
      const next = String(editForm[key] || '').trim();
      const current = String(record[key] || '').trim();
      if (next !== current) payload[key] = next;
    }
    if (!Object.keys(payload).length) return;

    setSaving(true);
    setFeedback(null);
    try {
      const response = await judgementAdminApi.libraryUpdate(selectedTid, payload);
      setFeedback({ tone: 'success', message: response.message || 'Record updated and re-indexed.' });
      await refreshRecord(selectedTid);
      await loadList({ silent: true });
    } catch (error) {
      console.error('[JudgementLibrary] Update failed', error);
      setFeedback({ tone: 'error', message: errorMessage(error, 'Failed to update the record') });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (tid) => {
    if (!tid) return;
    const confirmed = window.confirm(
      `Remove judgment ${tid} from the library? Citation research will no longer find it.`
    );
    if (!confirmed) return;

    setDeletingTid(tid);
    setFeedback(null);
    try {
      const response = await judgementAdminApi.libraryDelete(tid);
      setFeedback({ tone: 'success', message: response.message || 'Removed from the library.' });
      if (selectedTid === tid) closeRecord();
      await loadList({ silent: true });
    } catch (error) {
      console.error('[JudgementLibrary] Delete failed', error);
      setFeedback({ tone: 'error', message: errorMessage(error, 'Failed to remove the record') });
    } finally {
      setDeletingTid(null);
    }
  };

  const handleOpenHtml = async (tid) => {
    if (!tid) return;
    // Open synchronously (popup blockers), then fill once the HTML arrives.
    const popup = window.open('', '_blank');
    try {
      const html = await judgementAdminApi.libraryHtml(tid);
      if (popup) {
        popup.document.open();
        popup.document.write(html);
        popup.document.close();
      }
    } catch (error) {
      if (popup) popup.close();
      console.error('[JudgementLibrary] Failed to open HTML', error);
      setFeedback({ tone: 'error', message: errorMessage(error, 'Failed to open the Indian Kanoon-format HTML') });
    }
  };

  return {
    closeRecord,
    deletingTid,
    editDirty,
    editForm,
    feedback,
    handleDelete,
    handleOpenHtml,
    handleSave,
    handleUpload,
    loadList,
    loading,
    maxFiles: MAX_FILES,
    openRecord,
    page,
    pageSize: PAGE_SIZE,
    record,
    recordLoading,
    refreshRecord,
    refreshing,
    rows,
    saving,
    search,
    selectedTid,
    setPage,
    setUploadFiles,
    total,
    updateEditField,
    updateSearch,
    updateUploadField,
    uploadFields,
    uploadFiles,
    uploadResults,
    uploading,
  };
}
