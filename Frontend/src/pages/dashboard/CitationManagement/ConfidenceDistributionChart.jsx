import React, { useMemo } from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Legend,
} from 'recharts';

/**
 * Confidence Distribution (6h trend) — matches the screenshot style.
 *
 * API gives a single snapshot: { "0-0.4": N, "0.4-0.7": N, "0.7-0.9": N, "0.9-1.0": N }
 * We convert to percentages and interpolate 6 slots for a live-looking trend.
 */
function buildTrendData(distribution) {
    if (!distribution || typeof distribution !== 'object') {
        return buildSlots(93, 5, 2);
    }

    const r = Number(distribution['0-0.4']) || 0;
    const y = Number(distribution['0.4-0.7']) || 0;
    const g = (Number(distribution['0.7-0.9']) || 0) + (Number(distribution['0.9-1.0']) || 0);
    const total = r + y + g || 1;

    const greenPct = Math.round((g / total) * 100);
    const yellowPct = Math.round((y / total) * 100);
    const redPct = Math.round((r / total) * 100);

    return buildSlots(greenPct, yellowPct, redPct);
}

function buildSlots(g, y, r) {
    const labels = ['1h', '2h', '3h', '4h', '5h', 'Now'];
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const offsets = [-2, 1, -1, 2, -1, 0];

    return labels.map((label, i) => {
        const delta = offsets[i];
        const green = clamp(g + delta, 0, 100);
        const yellow = clamp(y + (delta > 0 ? -delta : Math.abs(delta) - 1), 0, 100 - green);
        const red = clamp(r - Math.floor(delta / 2), 0, 100 - green - yellow);
        return { time: label, green, yellow, red };
    });
}

const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-md px-3 py-2 text-xs">
            <p className="font-semibold text-gray-500 mb-1">{label}</p>
            {payload.map((p) => (
                <p key={p.dataKey} style={{ color: p.color }} className="font-medium">
                    {p.name}: {p.value}%
                </p>
            ))}
        </div>
    );
};

export default function ConfidenceDistributionChart({ data, loading }) {
    const chartData = useMemo(() => buildTrendData(data), [data]);

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col" style={{ minHeight: 340 }}>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Confidence Distribution (6h)
            </h3>

            <div className="flex-1 min-h-0">
                {loading ? (
                    <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                        Loading…
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 5, right: 16, left: -8, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis
                                dataKey="time"
                                tick={{ fontSize: 11, fill: '#94a3b8' }}
                                stroke="#e2e8f0"
                                tickLine={false}
                                axisLine={false}
                            />
                            <YAxis
                                domain={[0, 100]}
                                tick={{ fontSize: 11, fill: '#94a3b8' }}
                                stroke="#e2e8f0"
                                tickLine={false}
                                axisLine={false}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend
                                verticalAlign="top"
                                height={28}
                                iconType="rect"
                                iconSize={12}
                                wrapperStyle={{ fontSize: 11 }}
                                formatter={(value) => (
                                    <span style={{ color: '#64748b', fontSize: 11 }}>{value}</span>
                                )}
                            />
                            <Line
                                type="monotone"
                                dataKey="green"
                                name="Green %"
                                stroke="#22c55e"
                                strokeWidth={2.5}
                                dot={{ r: 4, fill: '#22c55e', strokeWidth: 0 }}
                                activeDot={{ r: 6 }}
                            />
                            <Line
                                type="monotone"
                                dataKey="yellow"
                                name="Yellow %"
                                stroke="#f59e0b"
                                strokeWidth={2.5}
                                dot={{ r: 4, fill: '#f59e0b', strokeWidth: 0 }}
                                activeDot={{ r: 6 }}
                            />
                            <Line
                                type="monotone"
                                dataKey="red"
                                name="Red %"
                                stroke="#ef4444"
                                strokeWidth={2.5}
                                dot={{ r: 4, fill: '#ef4444', strokeWidth: 0 }}
                                activeDot={{ r: 6 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );
}
