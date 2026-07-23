import { useState } from 'react';
import useAuth from '../contexts/useAuth';
import { changePassword } from '../services/api';
import './Settings.css';

const STATIC_PASSWORD = 'pjt123456';

const Settings = () => {
  const [activeTab, setActiveTab] = useState('profil');
  const [passwordStatus, setPasswordStatus] = useState('');
  const [passwordStatusType, setPasswordStatusType] = useState('warning');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const { user } = useAuth();
  const isDemoUser = Boolean(user?.is_demo);
  const roles = user?.roles?.length ? user.roles.join(', ') : '-';
  const companyName = user?.company?.name || user?.company_name || '-';
  const displayName = user?.name || 'Pengguna HydroTrack';
  const username = user?.username || user?.email?.split('@')?.[0] || '-';
  const position = user?.position || user?.job_title || roles;
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'HT';
  const profileDetails = [
    { label: 'Nama Lengkap', value: displayName },
    { label: 'Username', value: username },
    { label: 'Email', value: user?.email || '-' },
    { label: 'Nomor Telepon', value: user?.phone || '-' },
    { label: 'Posisi', value: position },
    { label: 'Perusahaan', value: companyName },
  ];

  const scrollToSection = (sectionId) => {
    setActiveTab(sectionId);
    const element = document.getElementById(`sec-${sectionId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleChangePassword = async () => {
    setPasswordStatus('');
    setPasswordStatusType('warning');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordStatus('Password lama, password baru, dan konfirmasi wajib diisi.');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordStatus('Password baru minimal 8 karakter.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordStatus('Konfirmasi password baru tidak sama.');
      return;
    }

    if (currentPassword === newPassword) {
      setPasswordStatus('Password baru harus berbeda dari password lama.');
      return;
    }

    if (isDemoUser && currentPassword !== STATIC_PASSWORD) {
      setPasswordStatus('Password lama tidak sesuai dengan akun static.');
      return;
    }

    if (isDemoUser) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordStatusType('success');
      setPasswordStatus('Password berhasil diperbarui secara lokal.');
      return;
    }

    setIsChangingPassword(true);

    try {
      await changePassword(currentPassword, newPassword, confirmPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordStatusType('success');
      setPasswordStatus('Password berhasil diperbarui.');
    } catch (error) {
      setPasswordStatusType('warning');
      setPasswordStatus(error.message || 'Gagal memperbarui password.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="view-section">
      <div className="header-section">
        <h1>Pengaturan</h1>
        <p>Kelola informasi akun yang sedang digunakan.</p>
      </div>

      <div className="settings-layout">
        <div className="settings-nav">
          <div 
            className={`settings-nav-item ${activeTab === 'profil' ? 'active' : ''}`} 
            onClick={() => scrollToSection('profil')}
          >
            Profil
          </div>
          <div 
            className={`settings-nav-item ${activeTab === 'keamanan' ? 'active' : ''}`} 
            onClick={() => scrollToSection('keamanan')}
          >
            Keamanan
          </div>
        </div>

        <div className="settings-content">
          
          <div className="settings-card" id="sec-profil">
            <div className="settings-card-title">Informasi Profil</div>
            <div className="profile-info-panel">
              <div className="profile-identity-layout">
                <div className="profile-summary">
                  <div className="profile-summary-avatar">{initials}</div>
                  <span className="profile-status-badge">Akun Aktif</span>
                </div>

                <div className="profile-detail-list" aria-label="Informasi profil pengguna">
                  {profileDetails.map((item) => (
                    <div className="profile-detail-row" key={item.label}>
                      <span>{item.label}</span>
                      <b>:</b>
                      <strong>{item.value}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="settings-card" id="sec-keamanan">
            <div className="settings-card-title">Keamanan Akun</div>
            <div className="form-grid settings-password-grid">
              <div className="filter-group">
                <label>Password Lama</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  placeholder="Masukkan password lama"
                  autoComplete="current-password"
                />
              </div>
              <div className="filter-group">
                <label>Password Baru</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="Minimal 8 karakter"
                  autoComplete="new-password"
                />
              </div>
              <div className="filter-group">
                <label>Konfirmasi Password Baru</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Ulangi password baru"
                  autoComplete="new-password"
                />
              </div>
              {passwordStatus && (
                <div
                  className={`settings-status ${
                    passwordStatusType === 'success' ? 'settings-status-success' : 'settings-status-warning'
                  }`}
                >
                  {passwordStatus}
                </div>
              )}
              <div>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ marginTop: '10px' }}
                  onClick={handleChangePassword}
                  disabled={isChangingPassword}
                >
                  {isChangingPassword ? 'Menyimpan...' : 'Simpan Password'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;


