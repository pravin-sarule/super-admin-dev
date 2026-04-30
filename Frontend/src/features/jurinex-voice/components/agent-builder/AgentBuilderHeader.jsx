import React from 'react';
import {
  ArrowLeft,
  Clock3,
  Copy,
  Pencil,
  Rocket,
  Save,
} from 'lucide-react';
import { compactId, getModelMeta } from './agentBuilderUtils';

const AgentBuilderHeader = ({
  agent,
  liveModel,
  models,
  onBack,
  onSave,
  saving,
  lastSavedAt,
}) => {
  const model = getModelMeta(liveModel, models);
  const savedLabel = lastSavedAt
    ? `Auto saved at ${lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : 'Unsaved changes';

  return (
    <header className="bg-white border border-slate-200 rounded-lg px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <button
            type="button"
            onClick={onBack}
            className="mt-1 flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            aria-label="Back to agents"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-xl font-semibold text-slate-950">
                {agent.display_name || agent.name}
              </h2>
              <button
                type="button"
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Edit agent name"
              >
                <Pencil className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
              <span>Agent ID: {compactId(agent.id)}</span>
              <Copy className="h-3.5 w-3.5" />
              <span>Live Model ID: {compactId(liveModel)}</span>
              <Copy className="h-3.5 w-3.5" />
              {model.cost && (
                <span className="inline-flex items-center">{model.cost}</span>
              )}
              {model.latency && (
                <span className="inline-flex items-center gap-1">
                  <Clock3 className="h-3.5 w-3.5" />
                  {model.latency}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-slate-500">{savedLabel}</span>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {saving ? <Save className="h-4 w-4 animate-pulse" /> : <Rocket className="h-4 w-4" />}
            {saving ? 'Publishing...' : 'Publish'}
          </button>
        </div>
      </div>
    </header>
  );
};

export default AgentBuilderHeader;
