import { useEffect, useState } from 'react';
import judgementSearchApi from '../../../services/judgementSearchApi';

function getErrorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    'Failed to search judgments.'
  );
}

export default function useJudgementSearch() {
  const [query, setQuery] = useState('');
  const [chunkLimit, setChunkLimit] = useState(8);
  const [judgmentLimit, setJudgmentLimit] = useState(5);
  const [scoreThreshold, setScoreThreshold] = useState('');
  const [phraseMatch, setPhraseMatch] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [analytics, setAnalytics] = useState([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const refreshAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const response = await judgementSearchApi.analytics({ limit: 10 });
      setAnalytics(response.analytics || []);
    } catch (analyticsError) {
      console.error('[JudgementSearch] Failed to load analytics', analyticsError);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    refreshAnalytics();
  }, []);

  const runSearch = async () => {
    const normalizedQuery = String(query || '').trim();
    if (!normalizedQuery) {
      setError('Enter a search query to find relevant judgments.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await judgementSearchApi.hybrid({
        query: normalizedQuery,
        chunkLimit: Number(chunkLimit) || 8,
        judgmentLimit: Number(judgmentLimit) || 5,
        scoreThreshold:
          scoreThreshold === '' || scoreThreshold == null
            ? null
            : Number(scoreThreshold),
        phraseMatch,
      });

      setResult(response);
      await refreshAnalytics();
    } catch (searchError) {
      console.error('[JudgementSearch] Search failed', searchError);
      setError(getErrorMessage(searchError));
    } finally {
      setLoading(false);
    }
  };

  return {
    analytics,
    analyticsLoading,
    chunkLimit,
    error,
    judgmentLimit,
    loading,
    phraseMatch,
    query,
    refreshAnalytics,
    result,
    runSearch,
    scoreThreshold,
    setChunkLimit,
    setError,
    setJudgmentLimit,
    setPhraseMatch,
    setQuery,
    setScoreThreshold,
  };
}
