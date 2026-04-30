import React, { useEffect, useState } from 'react';
import { Bot, FileText, CloudUpload, Search, Activity, BarChart3, History } from 'lucide-react';
import VoiceAgentList from '../components/VoiceAgentList';
import VoiceDocumentUpload from '../components/VoiceDocumentUpload';
import VoiceDocumentList from '../components/VoiceDocumentList';
import VoiceKbSearchTester from '../components/VoiceKbSearchTester';
import VoiceDebugLogs from '../components/VoiceDebugLogs';
import VoiceAnalytics from '../components/VoiceAnalytics';
import VoiceCallHistory from '../components/VoiceCallHistory';
import { listVoiceAgents } from '../api/jurinexVoiceApi';

const TABS = [
  { key: 'analytics', label: 'Analytics', Icon: BarChart3 },
  { key: 'history', label: 'Call History', Icon: History },
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

  useEffect(() => {
    listVoiceAgents()
      .then((data) => setAgents(data.agents || []))
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-slate-200">
        <nav className="flex flex-wrap gap-1 px-2 pt-2 overflow-x-auto">
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

      {tab === 'analytics' && <VoiceAnalytics />}
      {tab === 'history' && <VoiceCallHistory />}
      {tab === 'agents' && (
        <VoiceAgentList
          onRefresh={(list) => setAgents(list)}
          onNavigateUpload={() => setTab('upload')}
        />
      )}
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
