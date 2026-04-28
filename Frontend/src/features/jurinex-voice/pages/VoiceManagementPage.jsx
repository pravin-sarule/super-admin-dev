import React, { useState } from 'react';
import { Mic, Bot, FileText, CloudUpload, Search, Activity } from 'lucide-react';
import VoiceAgentList from '../components/VoiceAgentList';
import VoiceDocumentUpload from '../components/VoiceDocumentUpload';
import VoiceDocumentList from '../components/VoiceDocumentList';
import VoiceKbSearchTester from '../components/VoiceKbSearchTester';
import VoiceDebugLogs from '../components/VoiceDebugLogs';

const TABS = [
  { key: 'agents', label: 'Agents', Icon: Bot },
  { key: 'documents', label: 'Documents', Icon: FileText },
  { key: 'upload', label: 'Upload Document', Icon: CloudUpload },
  { key: 'search', label: 'Test Search', Icon: Search },
  { key: 'debug', label: 'Debug Logs', Icon: Activity },
];

const VoiceManagementPage = () => {
  const [tab, setTab] = useState('agents');
  const [agents, setAgents] = useState([]);
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl text-white p-6 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <Mic className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Voice Management</h1>
            <p className="text-sm text-white/80">
              Manage Jurinex voice agents, upload knowledge documents, and test support answers.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <nav className="flex flex-wrap gap-1 px-2 pt-2">
          {TABS.map((t) => {
            const TabIcon = t.Icon;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                  tab === t.key
                    ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <TabIcon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </nav>
      </div>

      {tab === 'agents' && <VoiceAgentList onRefresh={(list) => setAgents(list)} />}
      {tab === 'documents' && <VoiceDocumentList agents={agents} reloadKey={reloadKey} />}
      {tab === 'upload' && (
        <VoiceDocumentUpload
          onUploaded={() => {
            setReloadKey((k) => k + 1);
          }}
        />
      )}
      {tab === 'search' && <VoiceKbSearchTester agents={agents} />}
      {tab === 'debug' && <VoiceDebugLogs />}
    </div>
  );
};

export default VoiceManagementPage;
