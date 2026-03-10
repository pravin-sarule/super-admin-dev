import React, { useState, useEffect } from 'react';
import {
    Eye, Download, FileText, BookOpen, Search,
    PenTool, Cpu, BarChart3,
} from 'lucide-react';
import { getPipelineAgents } from '../../../services/citationAdminApi';

/* ─── per-agent config ─── */
const AGENT_META = {
    watchdog: { icon: Eye, desc: 'SC S3 sync + IKanoon daily delta' },
    fetcher: { icon: Download, desc: 'IKanoon API + S3 download + GCS upload' },
    clerk: { icon: FileText, desc: 'GCV OCR + text cleaning + normalisation' },
    librarian: { icon: BookOpen, desc: 'InLegalBERT embedding + indexing' },
    auditor: { icon: Search, desc: 'Scheduled quality audit' },
    keyword_extractor: { icon: PenTool, desc: 'NLP keyword + statute extraction' },
    root: { icon: Cpu, desc: 'Pipeline orchestrator + scheduler' },
    report_builder: { icon: BarChart3, desc: 'Generate citation reports' },
};

const STATUS_DOT = {
    running: 'bg-green-500',
    idle: 'bg-amber-400',
    error: 'bg-red-500',
};

const PIPELINE_ORDER = [
    'root',
    'keyword_extractor',
    'watchdog',
    'fetcher',
    'clerk',
    'librarian',
    'auditor',
    'report_builder',
];

function capitalize(s) {
    return s ? s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '';
}

export default function PipelineAgentStatus() {
    const [agents, setAgents] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        getPipelineAgents({ windowMinutes: 60 })
            .then((r) => {
                if (r?.success && r.data?.agents) setAgents(r.data.agents);
            })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col" style={{ minHeight: 340 }}>
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Pipeline Agent Status</h3>

            <div className="flex-1 overflow-y-auto thin-scrollbar">
                {loading ? (
                    <div className="flex items-center justify-center py-8 text-gray-400 text-sm">
                        Loading…
                    </div>
                ) : agents.length === 0 ? (
                    <div className="flex items-center justify-center py-8 text-gray-400 text-sm">
                        No agents found
                    </div>
                ) : (
                    <ul className="divide-y divide-gray-100">
                        {PIPELINE_ORDER.map((name) => {
                            const agent = agents.find((a) => a.agent_name === name);
                            if (!agent) return null;
                            const meta = AGENT_META[agent.agent_name] || {};
                            const Icon = meta.icon || Cpu;
                            const dotClass = STATUS_DOT[agent.status] || STATUS_DOT.idle;

                            /* Right-side value: show uptime % if available, else today count */
                            let rightValue = '';
                            if (agent.uptime_pct != null && agent.uptime_pct !== 100) {
                                rightValue = `${agent.uptime_pct}%`;
                            } else if (agent.today_events_count != null && agent.today_events_count > 0) {
                                rightValue = `+${agent.today_events_count}`;
                            } else {
                                rightValue = '0';
                            }

                            return (
                                <li
                                    key={agent.agent_name}
                                    className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                                >
                                    {/* Icon */}
                                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
                                        <Icon className="w-4 h-4 text-gray-500" />
                                    </div>

                                    {/* Name + description */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-slate-800 leading-tight">
                                            {capitalize(agent.agent_name)}
                                        </p>
                                        <p className="text-[11px] text-gray-400 truncate leading-tight mt-0.5">
                                            {meta.desc || ''}
                                        </p>
                                    </div>

                                    {/* Value + status dot */}
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                        <span className="text-sm font-medium text-gray-600">{rightValue}</span>
                                        <span className={`w-2 h-2 rounded-full ${dotClass}`} />
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
}
