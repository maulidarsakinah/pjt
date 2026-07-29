import { memo } from 'react';
import './KPICard.css';

const KPICard = ({
  title,
  value,
  unit,
  descText,
  descIcon,
  descClass,
  valueClass,
  icon,
  badge,
  accent,
}) => {
  return (
    <div className="kpi-card" style={{ '--kpi-accent': accent || '#3A4BCF' }}>
      <div className="kpi-card-top">
        <div className="kpi-icon">
          <i className={`fa-solid ${icon || 'fa-wave-square'}`}></i>
        </div>
        {badge && <span className="kpi-badge">{badge}</span>}
      </div>
      <div className="kpi-title">{title}</div>
      <div className={`kpi-value ${valueClass || ''}`}>
        {value} {unit && <span className="kpi-unit">{unit}</span>}
      </div>
      <div className={`kpi-desc ${descClass || ''}`}>
        {descClass === 'trend-up' && (
          <span className="trend-up"><i className={`fa-solid ${descIcon || 'fa-arrow-up'}`}></i></span>
        )}
        {descClass !== 'trend-up' && descIcon && (
          <i className={`fa-solid ${descIcon}`}></i>
        )}
        {descText}
      </div>
    </div>
  );
};

export default memo(KPICard);
