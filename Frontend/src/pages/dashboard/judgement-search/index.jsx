import AnalyticsPanel from './AnalyticsPanel';
import FullTextResultsPanel from './FullTextResultsPanel';
import SearchHero from './SearchHero';
import SearchMetricCards from './SearchMetricCards';
import SemanticResultsPanel from './SemanticResultsPanel';
import useJudgementSearch from './useJudgementSearch';

const JudgementSearchDashboard = () => {
  const search = useJudgementSearch();

  return (
    <div className="space-y-6">
      <SearchHero
        chunkLimit={search.chunkLimit}
        error={search.error}
        judgmentLimit={search.judgmentLimit}
        loading={search.loading}
        onSearch={search.runSearch}
        phraseMatch={search.phraseMatch}
        query={search.query}
        scoreThreshold={search.scoreThreshold}
        sourceScope={search.sourceScope}
        setChunkLimit={search.setChunkLimit}
        setJudgmentLimit={search.setJudgmentLimit}
        setPhraseMatch={search.setPhraseMatch}
        setQuery={search.setQuery}
        setScoreThreshold={search.setScoreThreshold}
        setSourceScope={search.setSourceScope}
      />

      <SearchMetricCards result={search.result} />

      <SemanticResultsPanel
        results={search.result?.semantic?.results || []}
        requestedSourceScope={search.result?.requestedSourceScope || search.sourceScope}
        scopeCoverageMessage={search.result?.semantic?.scopeCoverageMessage}
        unavailableReason={search.result?.semantic?.unavailableReason}
        thresholdFallbackTriggered={Boolean(search.result?.semantic?.thresholdFallbackTriggered)}
        appliedScoreThreshold={search.result?.semantic?.appliedScoreThreshold}
      />

      <FullTextResultsPanel
        results={search.result?.fullText?.results || []}
        requestedSourceScope={search.result?.requestedSourceScope || search.sourceScope}
      />

      <AnalyticsPanel
        analytics={search.analytics}
        analyticsLoading={search.analyticsLoading}
        onRefresh={search.refreshAnalytics}
      />
    </div>
  );
};

export default JudgementSearchDashboard;
