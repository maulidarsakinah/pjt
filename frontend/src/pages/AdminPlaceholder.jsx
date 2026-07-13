const AdminPlaceholder = ({ title, icon }) => (
  <div className="view-section">
    <div className="header-section">
      <h1>{title}</h1>
      <p>Modul admin ini sudah disiapkan dan akan mengikuti gaya dashboard HydroTrack.</p>
    </div>

    <section className="panel" style={{ minHeight: '280px', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
      <div
        style={{
          width: '72px',
          height: '72px',
          borderRadius: '22px',
          display: 'grid',
          placeItems: 'center',
          background: 'rgba(177, 207, 246, 0.42)',
          color: 'var(--primary-color)',
          fontSize: '28px',
          marginBottom: '18px',
        }}
      >
        <i className={`fa-solid ${icon}`}></i>
      </div>
      <h2 style={{ fontSize: '20px', marginBottom: '8px' }}>{title}</h2>
      <p style={{ color: 'var(--text-secondary)', maxWidth: '520px', lineHeight: 1.7 }}>
        Placeholder sementara agar navigasi admin lengkap. Konten detail bisa kita lanjutkan modul per modul.
      </p>
    </section>
  </div>
);

export default AdminPlaceholder;
