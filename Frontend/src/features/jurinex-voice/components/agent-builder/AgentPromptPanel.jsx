import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Clock3,
  Globe2,
  Settings,
  Sparkles,
} from 'lucide-react';
import {
  LANGUAGE_OPTIONS,
  LIVE_MODELS,
} from './agentBuilderConstants';
import { getModelMeta, getVoiceMeta, mergeDeep, normalizeModelOptions } from './agentBuilderUtils';

const formatPricingKey = (key) =>
  String(key || '')
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const AgentPromptPanel = ({
  agent,
  liveModel,
  models = LIVE_MODELS,
  onLiveModelChange,
  voiceName,
  onOpenVoiceModal,
  builderSettings,
  onBuilderSettingsChange,
  audioPrompt,
  onAudioPromptChange,
}) => {
  const [modelOpen, setModelOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);

  const voice = getVoiceMeta(voiceName);
  const modelOptions = useMemo(() => normalizeModelOptions(models), [models]);
  const model = getModelMeta(liveModel, modelOptions);
  const selectedLanguages = builderSettings.languages || [];
  const languageLabel = selectedLanguages.length > 1 ? 'Multilingual' : selectedLanguages[0] || 'Language';

  const groupedModels = useMemo(
    () =>
      modelOptions.reduce((acc, item) => {
        acc[item.group] = acc[item.group] || [];
        acc[item.group].push(item);
        return acc;
      }, {}),
    [modelOptions]
  );

  const updateBuilder = (patch) => onBuilderSettingsChange(mergeDeep(builderSettings, patch));

  const toggleLanguage = (code) => {
    const exists = selectedLanguages.includes(code);
    const next = exists
      ? selectedLanguages.filter((item) => item !== code)
      : [...selectedLanguages, code];
    updateBuilder({ languages: next.length ? next : ['en'] });
  };

  return (
    <section className="relative flex min-h-[680px] flex-col rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50/70 px-3 py-3">
        <div className="relative">
          <button
            type="button"
            onClick={() => setModelOpen((value) => !value)}
            className="inline-flex h-10 max-w-full items-center gap-2 rounded-lg bg-white px-3 text-sm font-semibold text-slate-950 shadow-sm ring-1 ring-slate-200"
            title={model.label}
          >
            <Sparkles className="h-4 w-4 text-blue-600" />
            <span className="max-w-[240px] truncate">{model.label}</span>
            {model.cost && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                {model.cost}
              </span>
            )}
            <ChevronDown className={`h-4 w-4 text-slate-500 ${modelOpen ? 'rotate-180' : ''}`} />
          </button>
          {modelOpen && (
            <div className="absolute left-0 top-12 z-20 max-h-[560px] w-[520px] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-lg border border-slate-200 bg-white p-3 shadow-xl">
              {Object.entries(groupedModels).map(([group, items]) => (
                <div key={group} className="mb-4 last:mb-0">
                  <p className="mb-2 text-xs font-semibold text-slate-500">{group}</p>
                  <div className="space-y-2">
                    {items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          onLiveModelChange(item.id);
                          setModelOpen(false);
                        }}
                        className={`w-full rounded-lg border px-3 py-3 text-left text-sm transition hover:border-blue-200 hover:bg-slate-50 ${
                          item.id === liveModel ? 'border-blue-300 bg-blue-50/40' : 'border-slate-200 bg-white'
                        }`}
                      >
                        <span className="flex items-start justify-between gap-3">
                          <span className="min-w-0">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-slate-950">{item.label}</span>
                              {item.badge && (
                                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                                  {item.badge}
                                </span>
                              )}
                            </span>
                            <span className="mt-0.5 block font-mono text-xs text-slate-500">{item.model_id}</span>
                            {item.description && (
                              <span className="mt-2 block text-xs leading-5 text-slate-600">{item.description}</span>
                            )}
                            <span className="mt-2 flex flex-wrap gap-2">
                              {Object.entries(item.unit_pricing || {}).map(([key, value]) => (
                                <span
                                  key={key}
                                  className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600"
                                >
                                  {formatPricingKey(key)}: {value}
                                </span>
                              ))}
                            </span>
                            {item.pricing_rows?.length > 0 && (
                              <span className="mt-3 block overflow-hidden rounded-md border border-slate-200">
                                <span className="grid grid-cols-[1fr_auto_auto_auto] gap-3 bg-slate-50 px-2 py-1.5 text-[10px] font-semibold uppercase text-slate-500">
                                  <span>Length</span>
                                  <span>Input</span>
                                  <span>Output</span>
                                  <span>Total</span>
                                </span>
                                {item.pricing_rows.map((row) => (
                                  <span
                                    key={`${item.id}-${row.duration}`}
                                    className="grid grid-cols-[1fr_auto_auto_auto] gap-3 border-t border-slate-100 px-2 py-1.5 text-[11px] text-slate-600"
                                  >
                                    <span>{row.duration}</span>
                                    <span>{row.input_estimate}</span>
                                    <span>{row.output_estimate}</span>
                                    <span className="font-semibold text-slate-900">{row.total_estimate}</span>
                                  </span>
                                ))}
                              </span>
                            )}
                          </span>
                          <span className="flex shrink-0 items-center gap-2">
                            {item.cost && (
                              <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                                {item.cost}
                              </span>
                            )}
                            {item.id === liveModel && <Check className="h-4 w-4 text-blue-600" />}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onOpenVoiceModal}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-white px-3 text-sm font-semibold text-slate-950 shadow-sm ring-1 ring-slate-200"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-xs">
            {voice.name.slice(0, 1)}
          </span>
          {voice.name}
          <Settings className="h-4 w-4 text-slate-500" />
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setLanguageOpen((value) => !value)}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-white px-3 text-sm font-semibold text-slate-950 shadow-sm ring-1 ring-slate-200"
          >
            <Globe2 className="h-4 w-4 text-blue-600" />
            {languageLabel}
            {selectedLanguages.includes('multi') && <AlertTriangle className="h-4 w-4 text-orange-500" />}
            <ChevronDown className={`h-4 w-4 text-slate-500 ${languageOpen ? 'rotate-180' : ''}`} />
          </button>
          {languageOpen && (
            <div className="absolute left-0 top-12 z-20 w-80 rounded-lg border border-slate-200 bg-white p-4 shadow-xl">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-950">Speech Language</span>
              </div>
              <p className="text-xs text-slate-600">
                This agent runs in <span className="font-semibold text-slate-900">Multilingual</span> mode by default — it auto-detects the caller&apos;s language (English, Hindi, Marathi, etc.) and replies in the same one.
              </p>
              {/*
                Language picker temporarily hidden. Re-enable later by
                restoring the LANGUAGE_OPTIONS list + toggleLanguage()
                handler from git history if per-language locking is
                needed again.

                <p className="mb-3 text-xs text-orange-600">
                  "Multilingual" is a legacy setting. Pick specific languages for cleaner updates.
                </p>
                <div className="max-h-80 space-y-1 overflow-y-auto pr-1">
                  {LANGUAGE_OPTIONS.map((item) => {
                    const selected = selectedLanguages.includes(item.code);
                    return (
                      <button
                        key={item.code}
                        type="button"
                        onClick={() => toggleLanguage(item.code)}
                        className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm hover:bg-slate-50"
                      >
                        <span className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
                            {item.code.slice(0, 2).toUpperCase()}
                          </span>
                          <span>
                            <span className="font-medium text-slate-800">{item.label}</span>
                            <span className="ml-1 text-slate-400">({item.region})</span>
                          </span>
                        </span>
                        {selected && <Check className="h-4 w-4 text-slate-900" />}
                      </button>
                    );
                  })}
                </div>
              */}
            </div>
          )}
        </div>

        <div className="ml-auto" />
      </div>

      <div className="flex flex-1 flex-col p-3">
        <textarea
          value={audioPrompt}
          onChange={(event) => onAudioPromptChange(event.target.value)}
          className="min-h-[520px] flex-1 resize-none rounded-lg border border-slate-200 bg-white p-3 font-mono text-sm leading-6 text-slate-950 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          spellCheck={false}
        />
      </div>

      <div className="border-t border-slate-200 px-3 py-3">
        <div className="mb-2 flex items-center justify-between gap-3 text-sm font-semibold text-slate-950">
          <span>Welcome Message</span>
          <span className="inline-flex items-center gap-1 text-slate-600">
            <Clock3 className="h-4 w-4" />
            Pause Before Speaking: {builderSettings.welcome?.pause_seconds || 0}s
          </span>
        </div>
        <div className="grid grid-cols-1 gap-2">
          <select
            value={builderSettings.welcome?.speaker || 'ai_first'}
            onChange={(event) => updateBuilder({ welcome: { speaker: event.target.value } })}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="ai_first">AI speaks first</option>
            <option value="user_first">User speaks first</option>
          </select>
          <select
            value={builderSettings.welcome?.mode || 'dynamic'}
            onChange={(event) => updateBuilder({ welcome: { mode: event.target.value } })}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="dynamic">Dynamic message</option>
            <option value="static">Static message</option>
          </select>
          {builderSettings.welcome?.mode === 'static' && (
            <input
              value={builderSettings.welcome?.message || ''}
              onChange={(event) => updateBuilder({ welcome: { message: event.target.value } })}
              placeholder="Hello, thank you for contacting Jurinex support."
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          )}
        </div>
      </div>
    </section>
  );
};

export default AgentPromptPanel;
