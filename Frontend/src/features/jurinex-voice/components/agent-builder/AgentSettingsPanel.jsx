import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  Bot,
  CalendarDays,
  ChevronDown,
  Grip,
  Headphones,
  Languages,
  Pencil,
  PhoneForwarded,
  PhoneOff,
  Plus,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  Volume2,
  X,
} from 'lucide-react';
import { FUNCTION_OPTIONS, LIVE_MODELS } from './agentBuilderConstants';
import {
  formatTransferType,
  getEnabledFunctions,
  mergeDeep,
  normalizeModelOptions,
} from './agentBuilderUtils';
import KnowledgeDocumentPickerModal from './KnowledgeDocumentPickerModal';
import CalendarFunctionModal, { DEFAULT_CALENDAR_TOOL_SETTINGS } from './CalendarFunctionModal';

const Toggle = ({ checked, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className={`flex h-5 w-9 items-center rounded-full p-0.5 ${
      checked ? 'justify-end bg-slate-950' : 'justify-start bg-slate-200'
    }`}
    aria-pressed={checked}
  >
    <span className="h-4 w-4 rounded-full bg-white shadow-sm" />
  </button>
);

const RangeRow = ({ label, description, min, max, step = 1, value, suffix = '', onChange }) => (
  <label className="block">
    <span className="text-sm font-semibold text-slate-950">{label}</span>
    {description && <span className="block text-xs leading-5 text-slate-500">{description}</span>}
    <span className="mt-2 flex items-center gap-4">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="min-w-0 flex-1 accent-slate-950"
      />
      <span className="w-14 text-right text-sm font-semibold text-slate-950">
        {value}
        {suffix}
      </span>
    </span>
  </label>
);

const FieldRow = ({ children }) => (
  <div className="flex items-center justify-between gap-3 rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">
    {children}
  </div>
);

const DEFAULT_END_CALL = {
  name: 'end_call',
  description: 'End the call when user has to leave (like says bye) or you are instructed to do so.',
  talk_while_waiting: true,
  waiting_mode: 'prompt',
  waiting_message: '',
};

const DEFAULT_TRANSFER_CALL = {
  name: 'transfer_call',
  description: 'Transfer the call to a human agent',
  routing_mode: 'dynamic',
  static_destination: '',
  destination_prompt:
    'If the user wants to reach support, transfer to +1 (925) 222-2222; if the user wants to reach sales, transfer to +1 (925) 333-3333',
  e164_format: true,
  transfer_type: 'warm',
  on_hold_music: 'Ringtone',
  ring_duration_seconds: 30,
  navigate_ivr: false,
  internal_queue: true,
  agent_wait_seconds: 30,
  whisper_debrief: false,
  whisper_message: '',
  three_way_ring_tone: true,
  three_way_debrief: true,
  handoff_mode: 'prompt',
  handoff_message: 'Continue translating for the customer and the technician',
  displayed_caller_id: 'retell_agent',
};

const functionIcon = {
  end_call: PhoneOff,
  transfer_call: PhoneForwarded,
  agent_transfer: PhoneForwarded,
  calendar_check: CalendarDays,
  calendar_book: CalendarDays,
};

const AccordionSection = ({ id, title, icon: Icon, open, onToggle, children }) => (
  <section className="border-b border-slate-200 last:border-b-0">
    <button
      type="button"
      onClick={() => onToggle(id)}
      className={`flex w-full items-center justify-between gap-3 px-4 py-4 text-left ${
        open ? 'text-slate-950' : 'text-slate-800'
      }`}
    >
      <span className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-slate-500" />
        <span className="font-semibold">{title}</span>
      </span>
      <ChevronDown className={`h-4 w-4 text-slate-600 ${open ? 'rotate-180' : ''}`} />
    </button>
    {open && <div className="space-y-5 px-7 pb-5">{children}</div>}
  </section>
);

const RadioOption = ({ checked, onClick, icon: Icon, iconClass = 'bg-blue-400', title, description }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-3 text-left ${
      checked ? 'border-slate-300 bg-white' : 'border-slate-200 bg-white hover:border-slate-300'
    }`}
  >
    <span className="flex min-w-0 items-center gap-3">
      {Icon && (
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white ${iconClass}`}>
          <Icon className="h-4 w-4" />
        </span>
      )}
      <span className="min-w-0">
        <span className="text-sm font-medium text-slate-800">{title}</span>
        {description && <span className="ml-1 text-sm text-slate-500">({description})</span>}
      </span>
    </span>
    <span className={`h-4 w-4 rounded-full border ${checked ? 'border-slate-950 ring-4 ring-inset ring-slate-950' : 'border-slate-950'}`} />
  </button>
);

const Segment = ({ value, current, onClick, children }) => (
  <button
    type="button"
    onClick={() => onClick(value)}
    className={`rounded-md px-3 py-1.5 text-xs font-medium ${
      current === value ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'
    }`}
  >
    {children}
  </button>
);

const EndCallModal = ({ value, onChange, onCancel, onSave }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
    <div className="w-full max-w-[600px] rounded-xl bg-white shadow-2xl">
      <header className="flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          <PhoneOff className="h-5 w-5 text-slate-600" />
          <h3 className="text-base font-semibold text-slate-950">End Call</h3>
        </div>
        <button type="button" onClick={onCancel} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100">
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="space-y-4 px-6 pb-6">
        <label className="block">
          <span className="text-sm font-semibold text-slate-950">Name</span>
          <input
            value={value.name}
            onChange={(event) => onChange({ ...value, name: event.target.value })}
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-slate-950">
            Description <span className="font-normal text-slate-500">(Optional)</span>
          </span>
          <textarea
            rows={3}
            value={value.description}
            onChange={(event) => onChange({ ...value, description: event.target.value })}
            className="mt-2 w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm leading-6"
          />
        </label>

        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={Boolean(value.talk_while_waiting)}
            onChange={(event) => onChange({ ...value, talk_while_waiting: event.target.checked })}
            className="mt-1 rounded accent-slate-950"
          />
          <span>
            <span className="block text-sm font-semibold text-slate-950">Talk While Waiting</span>
            <span className="block text-xs leading-5 text-slate-500">
              Enable to say a short phrase to fill the silence, like "let me look that up for you".
            </span>
          </span>
        </label>

        {value.talk_while_waiting && (
          <div className="pl-6">
            <div className="mb-2 inline-flex rounded-lg bg-slate-100 p-1">
              <Segment value="prompt" current={value.waiting_mode} onClick={(waiting_mode) => onChange({ ...value, waiting_mode })}>
                Prompt
              </Segment>
              <Segment value="static" current={value.waiting_mode} onClick={(waiting_mode) => onChange({ ...value, waiting_mode })}>
                Static Sentence
              </Segment>
            </div>
            <input
              value={value.waiting_message}
              onChange={(event) => onChange({ ...value, waiting_message: event.target.value })}
              placeholder="Enter the execution message description"
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
            />
          </div>
        )}
      </div>

      <footer className="flex justify-end gap-3 px-6 py-5">
        <button type="button" onClick={onCancel} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          Cancel
        </button>
        <button type="button" onClick={onSave} className="rounded-lg bg-slate-950 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800">
          Update
        </button>
      </footer>
    </div>
  </div>
);

const TransferCallModal = ({ value, onChange, onCancel, onSave }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
    <div className="flex max-h-[92vh] w-full max-w-[680px] flex-col rounded-xl bg-white shadow-2xl">
      <header className="flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          <PhoneForwarded className="h-5 w-5 text-slate-600" />
          <h3 className="text-base font-semibold text-slate-950">Transfer Call</h3>
        </div>
        <button type="button" onClick={onCancel} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100">
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto px-6 pb-6">
        <label className="block">
          <span className="text-sm font-semibold text-slate-950">Name</span>
          <input
            value={value.name}
            onChange={(event) => onChange({ ...value, name: event.target.value })}
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-slate-950">
            Description <span className="font-normal text-slate-500">(Optional)</span>
          </span>
          <textarea
            rows={3}
            value={value.description}
            onChange={(event) => onChange({ ...value, description: event.target.value })}
            className="mt-2 w-full resize-y rounded-lg border border-slate-200 px-3 py-2.5 text-sm leading-6"
          />
        </label>

        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-slate-950">Transfer to</span>
            <button
              type="button"
              onClick={() => onChange({ ...value, e164_format: !value.e164_format })}
              className="inline-flex items-center gap-1 text-sm text-slate-700"
            >
              Format to E.164
              <ChevronDown className={`h-4 w-4 ${value.e164_format ? 'rotate-180' : ''}`} />
            </button>
          </div>
          <div className="mb-2 inline-flex rounded-lg bg-slate-100 p-1">
            <Segment value="static" current={value.routing_mode} onClick={(routing_mode) => onChange({ ...value, routing_mode })}>
              Static Destination
            </Segment>
            <Segment value="dynamic" current={value.routing_mode} onClick={(routing_mode) => onChange({ ...value, routing_mode })}>
              Dynamic Routing
            </Segment>
          </div>
          {value.routing_mode === 'static' ? (
            <input
              value={value.static_destination || ''}
              onChange={(event) => onChange({ ...value, static_destination: event.target.value })}
              placeholder="+1 (925) 222-2222"
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
            />
          ) : (
            <textarea
              rows={3}
              value={value.destination_prompt}
              onChange={(event) => onChange({ ...value, destination_prompt: event.target.value })}
              className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm leading-6"
            />
          )}
          <p className="mt-2 text-xs text-slate-500">Use a prompt to handle dynamic call transfer routing.</p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-950">How should the AI handle the transfer?</p>
          <RadioOption
            checked={value.transfer_type === 'cold'}
            onClick={() => onChange({ ...value, transfer_type: 'cold' })}
            icon={PhoneForwarded}
            iconClass="bg-sky-400"
            title="Cold Transfer"
            description="AI transfers immediately"
          />
          <RadioOption
            checked={value.transfer_type === 'warm'}
            onClick={() => onChange({ ...value, transfer_type: 'warm' })}
            icon={Bot}
            iconClass="bg-orange-400"
            title="Warm Transfer"
            description="AI gives a one-way brief to the agent"
          />
          <RadioOption
            checked={value.transfer_type === 'agentic_warm'}
            onClick={() => onChange({ ...value, transfer_type: 'agentic_warm' })}
            icon={Sparkles}
            iconClass="bg-violet-500"
            title="Agentic Warm Transfer"
            description="AI has a 2-way conversation with agent, then bridges"
          />
        </div>

      </div>

      <footer className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
        <button type="button" onClick={onCancel} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          Cancel
        </button>
        <button type="button" onClick={onSave} className="rounded-lg bg-slate-950 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800">
          Update
        </button>
      </footer>
    </div>
  </div>
);

const AgentSettingsPanel = ({
  builderSettings,
  onBuilderSettingsChange,
  models = LIVE_MODELS,
  transferCall,
  onTransferCallChange,
  documents = [],
  onNavigateUpload,
}) => {
  const [openSections, setOpenSections] = useState({
    functions: true,
    knowledge: false,
    speech: false,
    transcription: false,
    call: false,
    postCall: false,
    security: false,
  });
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [kbPickerOpen, setKbPickerOpen] = useState(false);
  const [editingExtraction, setEditingExtraction] = useState(null);
  const [editingFunction, setEditingFunction] = useState(null);
  const [endCallDraft, setEndCallDraft] = useState(DEFAULT_END_CALL);
  const [transferDraft, setTransferDraft] = useState(DEFAULT_TRANSFER_CALL);

  const enabledFunctions = useMemo(() => getEnabledFunctions(builderSettings), [builderSettings]);
  const modelOptions = useMemo(() => normalizeModelOptions(models), [models]);
  const selectedDocumentIds = useMemo(
    () =>
      Array.isArray(builderSettings.knowledge_base?.document_ids)
        ? builderSettings.knowledge_base.document_ids
        : [],
    [builderSettings.knowledge_base?.document_ids]
  );
  const documentsById = useMemo(() => {
    const map = new Map();
    documents.forEach((doc) => {
      if (doc?.id) map.set(doc.id, doc);
    });
    return map;
  }, [documents]);
  const selectedDocuments = useMemo(
    () =>
      selectedDocumentIds
        .map((id) => documentsById.get(id))
        .filter(Boolean),
    [selectedDocumentIds, documentsById]
  );

  const toggleSection = (key) =>
    setOpenSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));

  const updateBuilder = (patch) => onBuilderSettingsChange(mergeDeep(builderSettings, patch));

  const updateFunction = (key, enabled) => {
    const existing = builderSettings.functions || [];
    const found = existing.find((item) => item.key === key);
    const next = found
      ? existing.map((item) => (item.key === key ? { ...item, enabled } : item))
      : [...existing, { key, enabled }];
    updateBuilder({ functions: next });
  };

  const removeFunction = (key) => {
    updateBuilder({
      functions: (builderSettings.functions || []).filter((item) => item.key !== key),
    });
  };

  const openFunctionEditor = (key) => {
    if (key === 'end_call') {
      setEndCallDraft({
        ...DEFAULT_END_CALL,
        ...(builderSettings.end_call || {}),
      });
      setEditingFunction('end_call');
      return;
    }
    if (key === 'transfer_call') {
      setTransferDraft({
        ...DEFAULT_TRANSFER_CALL,
        ...(transferCall || {}),
      });
      setEditingFunction('transfer_call');
      return;
    }
    if (key === 'calendar_check' || key === 'calendar_book') {
      setEditingFunction(key);
    }
  };

  const calendarSettings =
    builderSettings.tool_settings?.calendar || DEFAULT_CALENDAR_TOOL_SETTINGS;
  const saveCalendarSettings = (next) => {
    updateBuilder({
      tool_settings: {
        ...(builderSettings.tool_settings || {}),
        calendar: next,
      },
    });
    setEditingFunction(null);
  };

  const saveEndCall = () => {
    updateBuilder({ end_call: endCallDraft });
    setEditingFunction(null);
  };

  const saveTransferCall = () => {
    onTransferCallChange(transferDraft);
    updateBuilder({ call: { ring_duration_seconds: transferDraft.ring_duration_seconds } });
    setEditingFunction(null);
  };

  const getFunctionLabel = (key) =>
    FUNCTION_OPTIONS.find((item) => item.key === key)?.label || key;

  const normalizeExtractionKey = (value) => {
    const key = String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return key || `custom_${Date.now()}`;
  };

  const saveExtractionField = () => {
    if (!editingExtraction) return;

    const current = builderSettings.post_call_extraction || [];
    const label = String(editingExtraction.field.label || '').trim() || 'Custom Field';
    const nextField = {
      ...editingExtraction.field,
      label,
      key: normalizeExtractionKey(editingExtraction.field.key || label),
      type: editingExtraction.field.type || 'text',
      enabled: editingExtraction.field.enabled !== false,
    };

    const next = Number.isInteger(editingExtraction.index)
      ? current.map((field, index) => (index === editingExtraction.index ? nextField : field))
      : [...current, nextField];

    updateBuilder({ post_call_extraction: next });
    setEditingExtraction(null);
  };

  const deleteExtractionField = (deleteIndex) => {
    updateBuilder({
      post_call_extraction: (builderSettings.post_call_extraction || []).filter(
        (_, index) => index !== deleteIndex
      ),
    });
    setEditingExtraction((current) =>
      current?.index === deleteIndex ? null : current
    );
  };

  return (
    <>
    <aside className="min-h-[680px] rounded-lg border border-slate-200 bg-white">
      <AccordionSection
        id="functions"
        title="Functions"
        icon={Grip}
        open={openSections.functions}
        onToggle={toggleSection}
      >
        <p className="text-xs leading-5 text-slate-500">
          Enable your agent with capabilities such as call termination, transfer, and custom tools.
        </p>
        <div className="space-y-2">
          {enabledFunctions.map((item) => {
            const Icon = functionIcon[item.key] || Settings;
            return (
              <FieldRow key={item.key}>
                <button
                  type="button"
                  onClick={() => openFunctionEditor(item.key)}
                  className="flex min-w-0 items-center gap-2 text-left hover:text-slate-950"
                >
                  <Icon className="h-4 w-4 shrink-0 text-slate-500" />
                  <span className="truncate">{item.key}</span>
                </button>
                <span className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openFunctionEditor(item.key)}
                    className="text-slate-500 hover:text-slate-900"
                    aria-label={`Edit ${item.key}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeFunction(item.key)}
                    className="text-slate-500 hover:text-red-600"
                    aria-label="Remove function"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </span>
              </FieldRow>
            );
          })}
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setAddMenuOpen((value) => !value)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
          {addMenuOpen && (
            <div className="absolute left-0 top-11 z-20 w-80 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
              {FUNCTION_OPTIONS.map((item) => {
                const Icon = functionIcon[item.key] || Settings;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      updateFunction(item.key, true);
                      setAddMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-slate-50"
                  >
                    <Icon className="h-4 w-4 text-slate-500" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </AccordionSection>

      <AccordionSection
        id="knowledge"
        title="Knowledge Base"
        icon={BookOpen}
        open={openSections.knowledge}
        onToggle={toggleSection}
      >
        <p className="text-xs leading-5 text-slate-500">
          Pick which uploaded documents the agent should answer from. The model is grounded only on
          these documents during live conversations.
        </p>
        <div className="space-y-2">
          {selectedDocuments.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 px-3 py-3 text-xs text-slate-500">
              No documents selected yet. Click <span className="font-semibold">Add</span> to pick from
              uploaded documents, or upload a new one.
            </p>
          ) : (
            selectedDocuments.map((doc) => (
              <FieldRow key={doc.id}>
                <span className="flex min-w-0 items-center gap-2 truncate">
                  <BookOpen className="h-4 w-4 shrink-0 text-slate-500" />
                  <span className="truncate" title={doc.title || doc.original_filename}>
                    {doc.title || doc.original_filename || 'Untitled document'}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() =>
                    updateBuilder({
                      knowledge_base: {
                        document_ids: selectedDocumentIds.filter((id) => id !== doc.id),
                      },
                    })
                  }
                  className="text-slate-500 hover:text-red-600"
                  aria-label={`Remove ${doc.title || 'document'}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </FieldRow>
            ))
          )}
        </div>
        <button
          type="button"
          onClick={() => setKbPickerOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-600">Advanced Settings</p>
          <button type="button" className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">
            Adjust KB Retrieval Chunks and Similarity
          </button>
          <textarea
            value={builderSettings.knowledge_base?.instructions || ''}
            onChange={(event) => updateBuilder({ knowledge_base: { instructions: event.target.value } })}
            rows={3}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
      </AccordionSection>

      <AccordionSection
        id="speech"
        title="Speech Settings"
        icon={Volume2}
        open={openSections.speech}
        onToggle={toggleSection}
      >
        <RangeRow
          label="Response Eagerness"
          description="How quickly the agent starts responding after the user finishes."
          min={0}
          max={1}
          step={0.1}
          value={builderSettings.speech?.response_eagerness ?? 1}
          onChange={(value) => updateBuilder({ speech: { response_eagerness: value } })}
        />
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={Boolean(builderSettings.speech?.dynamic_eagerness)}
            onChange={(event) => updateBuilder({ speech: { dynamic_eagerness: event.target.checked } })}
            className="rounded accent-slate-950"
          />
          Dynamically adjust based on user input
        </label>
        <RangeRow
          label="Interruption Sensitivity"
          description="How quickly the agent stops when user talks over it."
          min={0}
          max={1}
          step={0.1}
          value={builderSettings.speech?.interruption_sensitivity ?? 0.9}
          onChange={(value) => updateBuilder({ speech: { interruption_sensitivity: value } })}
        />
      </AccordionSection>

      <AccordionSection
        id="transcription"
        title="Realtime Transcription Settings"
        icon={Languages}
        open={openSections.transcription}
        onToggle={toggleSection}
      >
        <div>
          <p className="mb-2 text-sm font-semibold text-slate-950">Denoising Mode</p>
          {[
            ['noise', 'Remove noise'],
            ['noise_and_speech', 'Remove noise + background speech'],
            ['none', 'No denoising'],
          ].map(([value, label]) => (
            <label key={value} className="mb-2 flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                checked={builderSettings.transcription?.denoising_mode === value}
                onChange={() => updateBuilder({ transcription: { denoising_mode: value } })}
                className="accent-slate-950"
              />
              {label}
            </label>
          ))}
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold text-slate-950">Transcription Mode</p>
          {[
            ['speed', 'Optimize for speed'],
            ['accuracy', 'Optimize for accuracy'],
          ].map(([value, label]) => (
            <label key={value} className="mb-2 flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                checked={builderSettings.transcription?.mode === value}
                onChange={() => updateBuilder({ transcription: { mode: value } })}
                className="accent-slate-950"
              />
              {label}
            </label>
          ))}
        </div>
      </AccordionSection>

      <AccordionSection
        id="call"
        title="Call Settings"
        icon={Headphones}
        open={openSections.call}
        onToggle={toggleSection}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <span>
              <span className="block text-sm font-semibold text-slate-950">Call Recording</span>
              <span className="block text-xs text-slate-500">
                Record both sides of the call (caller mic + agent audio) and upload the WAV to GCS for review.
              </span>
            </span>
            <Toggle
              checked={builderSettings.call?.recording_enabled !== false}
              onChange={(checked) => updateBuilder({ call: { recording_enabled: checked } })}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <span>
              <span className="block text-sm font-semibold text-slate-950">User Keypad Input Detection</span>
              <span className="block text-xs text-slate-500">Enable the AI to listen for keypad input during a call.</span>
            </span>
            <Toggle
              checked={Boolean(builderSettings.call?.keypad_detection)}
              onChange={(checked) => updateBuilder({ call: { keypad_detection: checked } })}
            />
          </div>
        </div>
        {builderSettings.call?.keypad_detection && (
          <div className="space-y-5 rounded-lg bg-slate-100 p-4">
            <p className="text-sm text-slate-600">The AI will respond when any of the following conditions are met:</p>
            <RangeRow
              label="Timeout"
              description="The AI will respond if no keypad input is detected within the set time."
              min={0.5}
              max={10}
              step={0.5}
              value={builderSettings.call?.keypad_timeout_seconds ?? 2.5}
              suffix=" s"
              onChange={(value) => updateBuilder({ call: { keypad_timeout_seconds: value } })}
            />
            <div className="flex items-center justify-between gap-3">
              <span>
                <span className="block text-sm font-semibold text-slate-950">Termination Key</span>
                <span className="block text-xs text-slate-500">Respond when the user presses 0-9, #, or *.</span>
              </span>
              <Toggle
                checked={Boolean(builderSettings.call?.termination_key_enabled)}
                onChange={(checked) => updateBuilder({ call: { termination_key_enabled: checked } })}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>
                <span className="block text-sm font-semibold text-slate-950">Digit Limit</span>
                <span className="block text-xs text-slate-500">Respond after a configured number of digits.</span>
              </span>
              <Toggle
                checked={Boolean(builderSettings.call?.digit_limit_enabled)}
                onChange={(checked) => updateBuilder({ call: { digit_limit_enabled: checked } })}
              />
            </div>
          </div>
        )}
        <RangeRow
          label="End Call on Silence"
          description="End the call if user stays silent for an extended period of time."
          min={0.5}
          max={5}
          step={0.5}
          value={builderSettings.call?.end_on_silence_minutes ?? 1}
          suffix=" m"
          onChange={(value) => updateBuilder({ call: { end_on_silence_minutes: value } })}
        />
        <RangeRow
          label="Max Call Duration"
          min={1}
          max={30}
          step={0.1}
          value={builderSettings.call?.max_duration_minutes ?? 15.3}
          suffix=" m"
          onChange={(value) => updateBuilder({ call: { max_duration_minutes: value } })}
        />
        <RangeRow
          label="Ring Duration"
          description="Max ringing duration before outbound or transfer call is deemed no answer."
          min={5}
          max={90}
          step={1}
          value={transferCall.ring_duration_seconds ?? 30}
          suffix=" s"
          onChange={(value) => {
            onTransferCallChange({ ...transferCall, ring_duration_seconds: value });
            updateBuilder({ call: { ring_duration_seconds: value } });
          }}
        />
        <label className="block">
          <span className="text-sm font-semibold text-slate-950">Transfer Type</span>
          <select
            value={transferCall.transfer_type || 'warm'}
            onChange={(event) => onTransferCallChange({ ...transferCall, transfer_type: event.target.value })}
            className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="cold">{formatTransferType('cold')}</option>
            <option value="warm">{formatTransferType('warm')}</option>
            <option value="agentic_warm">{formatTransferType('agentic_warm')}</option>
          </select>
        </label>
      </AccordionSection>

      <AccordionSection
        id="postCall"
        title="Post-Call Data Extraction"
        icon={BarChart3}
        open={openSections.postCall}
        onToggle={toggleSection}
      >
        <p className="text-xs leading-5 text-slate-500">Define the information to extract from the voice conversation.</p>
        <div className="space-y-2">
          {(builderSettings.post_call_extraction || []).map((field, index) => (
            <FieldRow key={`${field.key}-${index}`}>
              <span className="flex items-center gap-2">
                <Grip className="h-4 w-4 text-slate-500" />
                {field.label}
              </span>
              <span className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingExtraction({ index, field: { ...field } })}
                  className="text-slate-500 hover:text-slate-900"
                  aria-label={`Edit ${field.label}`}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => deleteExtractionField(index)}
                  className="text-slate-500 hover:text-red-600"
                  aria-label={`Delete ${field.label}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </span>
            </FieldRow>
          ))}
        </div>
        {editingExtraction && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="grid grid-cols-1 gap-3">
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Label</span>
                <input
                  value={editingExtraction.field.label || ''}
                  onChange={(event) =>
                    setEditingExtraction((current) => ({
                      ...current,
                      field: { ...current.field, label: event.target.value },
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Key</span>
                <input
                  value={editingExtraction.field.key || ''}
                  onChange={(event) =>
                    setEditingExtraction((current) => ({
                      ...current,
                      field: { ...current.field, key: event.target.value },
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Type</span>
                <select
                  value={editingExtraction.field.type || 'text'}
                  onChange={(event) =>
                    setEditingExtraction((current) => ({
                      ...current,
                      field: { ...current.field, type: event.target.value },
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="text">Text</option>
                  <option value="boolean">Boolean</option>
                  <option value="enum">Enum</option>
                  <option value="string">String</option>
                  <option value="number">Number</option>
                </select>
              </label>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingExtraction(null)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveExtractionField}
                className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Save
              </button>
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() =>
              setEditingExtraction({
                index: null,
                field: { key: '', label: 'Custom Field', type: 'text', enabled: true },
              })
            }
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
          <select
            value={builderSettings.post_call_model || modelOptions[0]?.id || LIVE_MODELS[0].id}
            onChange={(event) => updateBuilder({ post_call_model: event.target.value })}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            {modelOptions.map((model) => (
              <option key={model.id} value={model.id}>{model.label}</option>
            ))}
          </select>
        </div>
      </AccordionSection>

      <AccordionSection
        id="security"
        title="Security & Fallback Settings"
        icon={ShieldCheck}
        open={openSections.security}
        onToggle={toggleSection}
      >
        <label className="block">
          <span className="text-sm font-semibold text-slate-950">Fallback Phrase</span>
          <textarea
            rows={3}
            value={builderSettings.security?.fallback_phrase || ''}
            onChange={(event) => updateBuilder({ security: { fallback_phrase: event.target.value } })}
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
      </AccordionSection>
    </aside>
    {editingFunction === 'end_call' && (
      <EndCallModal
        value={endCallDraft}
        onChange={setEndCallDraft}
        onCancel={() => setEditingFunction(null)}
        onSave={saveEndCall}
      />
    )}
    {editingFunction === 'transfer_call' && (
      <TransferCallModal
        value={transferDraft}
        onChange={setTransferDraft}
        onCancel={() => setEditingFunction(null)}
        onSave={saveTransferCall}
      />
    )}
    <KnowledgeDocumentPickerModal
      open={kbPickerOpen}
      documents={documents}
      selectedIds={selectedDocumentIds}
      onClose={() => setKbPickerOpen(false)}
      onApply={(ids) => updateBuilder({ knowledge_base: { document_ids: ids } })}
      onNavigateUpload={onNavigateUpload}
    />
    <CalendarFunctionModal
      open={editingFunction === 'calendar_check' || editingFunction === 'calendar_book'}
      mode={editingFunction === 'calendar_book' ? 'book' : 'check'}
      value={calendarSettings}
      onSave={saveCalendarSettings}
      onClose={() => setEditingFunction(null)}
    />
    </>
  );
};

export default AgentSettingsPanel;
