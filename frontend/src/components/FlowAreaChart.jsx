import { memo, useCallback, useId, useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const defaultValueFormatter = (value) => {
  if (typeof value !== 'number') return value;
  if (Math.abs(value) >= 100) return value.toLocaleString('en-US', { maximumFractionDigits: 1 });
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
};

const FlowAreaChart = ({
  title,
  description,
  badge,
  data,
  xKey = 'time',
  xTickFormatter,
  yTickFormatter,
  yDomain,
  series = [],
  height = 320,
  showLegend = true,
  compact = false,
}) => {
  const uid = useId().replace(/:/g, '');
  const seriesByKey = useMemo(
    () => new Map(series.map((entry) => [entry.dataKey, entry])),
    [series]
  );

  const tooltipContent = useCallback(({ active, payload, label }) => {
    if (!active || !payload?.length) return null;

    return (
      <div className="chart-tooltip">
        <div className="chart-tooltip-label">{label}</div>
        <div className="chart-tooltip-list">
          {payload
            .filter((item) => item && item.value !== null && item.value !== undefined)
            .map((item) => {
              const meta = seriesByKey.get(item.dataKey);
              return (
                <div key={item.dataKey} className="chart-tooltip-row">
                  <span
                    className="chart-tooltip-dot"
                    style={{ backgroundColor: item.color || meta?.color || '#3A4BCF' }}
                  />
                  <span className="chart-tooltip-name">{item.name || meta?.name || item.dataKey}</span>
                  <strong>{`${defaultValueFormatter(item.value)}${meta?.unit ? ` ${meta.unit}` : ''}`}</strong>
                </div>
              );
            })}
        </div>
      </div>
    );
  }, [seriesByKey]);

  return (
    <section className={`flow-chart-card ${compact ? 'flow-chart-card--compact' : ''}`} style={{ height: '100%' }}>
      <div className="flow-chart-header">
        <div>
          <div className="flow-chart-kicker">{badge || 'Live trend'}</div>
          <h3>{title}</h3>
          {description && <p>{description}</p>}
        </div>
        {showLegend && (
          <div className="flow-chart-legend">
            {series.map((entry) => (
              <span className="flow-chart-chip" key={entry.dataKey}>
                <span className="flow-chart-chip-dot" style={{ backgroundColor: entry.color }} />
                {entry.name}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flow-chart-canvas" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
            <defs>
              {series.map((entry, index) => (
                <linearGradient key={entry.dataKey} id={`${uid}-${index}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={entry.color} stopOpacity={0.28} />
                  <stop offset="95%" stopColor={entry.color} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} stroke="rgba(148, 163, 184, 0.18)" strokeDasharray="4 8" />
            <XAxis
              dataKey={xKey}
              axisLine={false}
              tickLine={false}
              tickMargin={12}
              tickFormatter={xTickFormatter}
              tick={{ fill: '#64748b', fontSize: 12 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tickMargin={10}
              domain={yDomain}
              tickFormatter={yTickFormatter}
              tick={{ fill: '#64748b', fontSize: 12 }}
            />
            <Tooltip cursor={{ stroke: 'rgba(58, 75, 207, 0.2)', strokeWidth: 1, strokeDasharray: '4 4' }} content={tooltipContent} />
            {series.map((entry, index) => (
              <Area
                key={entry.dataKey}
                type="monotone"
                dataKey={entry.dataKey}
                name={entry.name}
                stroke={entry.color}
                strokeWidth={2.5}
                fill={`url(#${uid}-${index})`}
                fillOpacity={1}
                dot={false}
                activeDot={{ r: 5, strokeWidth: 0, fill: entry.color }}
                connectNulls
                strokeDasharray={entry.strokeDasharray}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
};

export default memo(FlowAreaChart);
