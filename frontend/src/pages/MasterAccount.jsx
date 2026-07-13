import { useMemo, useState } from 'react';
import KPICard from '../components/KPICard';
import './MasterAccount.css';

const users = [
  {
    id: 'USR-001',
    name: 'Budi Setiawan',
    email: 'budi.s@hydrotrack.io',
    role: 'Administrator',
    status: 'Aktif',
    lastLogin: '24/10/23 08:30',
    position: 'Senior Hydrologist',
    phone: '0812-3456-7890',
  },
  {
    id: 'USR-002',
    name: 'Siti Aminah',
    email: 'siti.a@hydrotrack.io',
    role: 'Operator',
    status: 'Aktif',
    lastLogin: '23/10/23 15:45',
    position: 'Operator Bendung',
    phone: '0813-2244-5511',
  },
  {
    id: 'USR-003',
    name: 'Ahmad Fauzi',
    email: 'ahmad.f@hydrotrack.io',
    role: 'Operator',
    status: 'Non-aktif',
    lastLogin: '20/10/23 09:12',
    position: 'Teknisi Lapangan',
    phone: '0821-4400-1188',
  },
  {
    id: 'USR-004',
    name: 'Dinas PU Jatim',
    email: 'pu.jatim@client.io',
    role: 'Pemanfaat',
    status: 'Aktif',
    lastLogin: '24/10/23 11:20',
    position: 'Stakeholder Wilayah',
    phone: '031-7788-9021',
  },
];

const permissions = [
  'Melihat Dashboard & Grafik Real-time (Read-only)',
  'Mengelola Master Alat & Sensor (Create/Edit/Delete)',
  'Mengekspor & Mengunduh Laporan (Export)',
  'Manajemen Pengguna & Master Akun (User Admin)',
  'Melihat Audit Log Sistem',
];

const initialForm = {
  name: '',
  email: '',
  role: '',
  status: 'Aktif',
  password: '',
};

function getInitials(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

const MasterAccount = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('Semua Peran');
  const [statusFilter, setStatusFilter] = useState('Semua Status');
  const [activeModal, setActiveModal] = useState(null);
  const [selectedUser, setSelectedUser] = useState(users[0]);
  const [formTitle, setFormTitle] = useState('Tambah Akun Baru');
  const [formData, setFormData] = useState(initialForm);

  const filteredUsers = useMemo(() => users.filter((user) => {
    const term = searchTerm.trim().toLowerCase();
    const matchesSearch = !term || `${user.name} ${user.email} ${user.id}`.toLowerCase().includes(term);
    const matchesRole = roleFilter === 'Semua Peran' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'Semua Status' || user.status === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  }), [roleFilter, searchTerm, statusFilter]);

  const totalActive = users.filter((user) => user.status === 'Aktif').length;
  const totalAdmins = users.filter((user) => user.role === 'Administrator').length;
  const totalOperators = users.filter((user) => user.role === 'Operator').length;

  const closeModal = () => setActiveModal(null);
  const openDetail = (user) => {
    setSelectedUser(user);
    setActiveModal('detail');
  };
  const openForm = (mode, user = null) => {
    setSelectedUser(user || users[0]);
    setFormTitle(mode === 'edit' ? 'Edit Akun Pengguna' : 'Tambah Akun Baru');
    setFormData(user ? {
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      password: '',
    } : initialForm);
    setActiveModal('form');
  };
  const openDelete = (user) => {
    setSelectedUser(user);
    setActiveModal('delete');
  };
  const resetFilters = () => {
    setSearchTerm('');
    setRoleFilter('Semua Peran');
    setStatusFilter('Semua Status');
  };

  return (
    <div className="view-section master-account-page">
      <div className="header-section master-account-header">
        <div>
          <h1>Master Akun</h1>
          <p>Kelola pengguna, role, dan permission akses HydroTrack.</p>
        </div>
      </div>

      <div className="kpi-grid master-kpi-grid">
        <KPICard title="Total Pengguna" value="128" icon="fa-users" badge="ALL" accent="#3A4BCF" descText="Seluruh tenant dan operator" />
        <KPICard title="Admin" value={String(totalAdmins + 11)} icon="fa-user-shield" badge="ADMIN" accent="#f59e0b" descText="Role administrator aktif" />
        <KPICard title="Operator" value={String(totalOperators + 92)} icon="fa-headset" badge="OPS" accent="#10b981" descText="Tim pemantauan lapangan" />
        <KPICard title="Akun Aktif" value={String(totalActive + 113)} icon="fa-circle-check" badge="LIVE" accent="#06b6d4" descText="Akses siap digunakan" />
      </div>

      <section className="panel master-control-panel">
        <div className="master-filter-row">
          <div className="filter-group">
            <label>Cari Pengguna</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Nama, email, atau ID..."
            />
          </div>
          <div className="filter-group">
            <label>Peran Pengguna</label>
            <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
              <option>Semua Peran</option>
              <option>Administrator</option>
              <option>Operator</option>
              <option>Pemanfaat</option>
            </select>
          </div>
          <div className="filter-group">
            <label>Status Akun</label>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option>Semua Status</option>
              <option>Aktif</option>
              <option>Non-aktif</option>
            </select>
          </div>
          <div className="master-filter-actions">
            <button className="btn btn-primary">Filter</button>
            <button className="btn btn-outline" onClick={resetFilters}>Reset</button>
          </div>
        </div>

        <div className="master-action-row">
          <div className="master-action-group">
            <button className="btn btn-primary" onClick={() => openForm('add')}>
              <i className="fa-solid fa-plus"></i> Tambah Akun
            </button>
            <button className="btn btn-outline" onClick={() => setActiveModal('role')}>
              <i className="fa-solid fa-shield-halved"></i> Kelola Role & Permission
            </button>
          </div>
          <div className="master-action-group">
            <button className="btn btn-outline"><i className="fa-solid fa-upload"></i> Import</button>
            <button className="btn btn-outline"><i className="fa-solid fa-download"></i> Export</button>
          </div>
        </div>
      </section>

      <section className="panel master-table-panel">
        <div className="panel-header master-table-header">
          <div>
            <div className="panel-title">Daftar Akun Pengguna</div>
            <div className="panel-subtitle">Menampilkan akun dengan akses ke dashboard HydroTrack.</div>
          </div>
          <span className="master-table-count">{filteredUsers.length} akun ditemukan</span>
        </div>

        <div className="table-container master-table-container">
          <table>
            <thead>
              <tr>
                <th>ID Pengguna</th>
                <th>Nama</th>
                <th>Email</th>
                <th>Peran</th>
                <th>Status</th>
                <th>Terakhir Login</th>
                <th style={{ textAlign: 'center' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id}>
                  <td><b>{user.id}</b></td>
                  <td>
                    <span className="master-user-name">{user.name}</span>
                  </td>
                  <td>{user.email}</td>
                  <td><span className="master-role-badge">{user.role}</span></td>
                  <td>
                    <span className={`master-status ${user.status === 'Aktif' ? 'is-active' : 'is-inactive'}`}>
                      <span></span>{user.status}
                    </span>
                  </td>
                  <td>{user.lastLogin}</td>
                  <td>
                    <div className="master-table-actions">
                      <button className="master-icon-button" title="Detail" onClick={() => openDetail(user)}>
                        <i className="fa-regular fa-eye"></i>
                      </button>
                      <button className="master-icon-button" title="Edit" onClick={() => openForm('edit', user)}>
                        <i className="fa-solid fa-pen"></i>
                      </button>
                      <button className="master-icon-button danger" title="Hapus" onClick={() => openDelete(user)}>
                        <i className="fa-regular fa-trash-can"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pagination">
          <div className="page-info">Menampilkan 1-{filteredUsers.length} dari 1,248 data</div>
          <div className="page-controls">
            <button className="page-btn"><i className="fa-solid fa-chevron-left"></i></button>
            <button className="page-btn active">1</button>
            <button className="page-btn">2</button>
            <button className="page-btn">3</button>
            <button className="page-btn">...</button>
            <button className="page-btn">8</button>
            <button className="page-btn"><i className="fa-solid fa-chevron-right"></i></button>
          </div>
        </div>
      </section>

      {activeModal === 'detail' && (
        <div className="master-modal-overlay" onMouseDown={closeModal}>
          <div className="master-modal-card master-modal-card--sm" onMouseDown={(event) => event.stopPropagation()}>
            <div className="master-modal-header">
              <h3>Detail Pengguna</h3>
              <button className="master-close-button" onClick={closeModal}><i className="fa-solid fa-xmark"></i></button>
            </div>
            <div className="master-modal-body">
              <div className="master-detail-profile">
                <div className="master-detail-avatar">{getInitials(selectedUser.name)}</div>
                <h4>{selectedUser.name}</h4>
                <p>{selectedUser.email}</p>
                <span className="master-role-badge">{selectedUser.role}</span>
              </div>
              <div className="master-info-grid">
                <div><span>ID Pengguna</span><strong>{selectedUser.id}</strong></div>
                <div><span>Status Akun</span><strong>{selectedUser.status}</strong></div>
                <div><span>Jabatan</span><strong>{selectedUser.position}</strong></div>
                <div><span>Kontak</span><strong>{selectedUser.phone}</strong></div>
              </div>
              <div className="master-activity-card">
                <span>Aktivitas Terakhir</span>
                <strong>Login ke sistem</strong>
                <small>{selectedUser.lastLogin} WIB</small>
              </div>
            </div>
            <div className="master-modal-footer">
              <button className="btn btn-outline" onClick={closeModal}>Tutup</button>
              <button className="btn btn-primary" onClick={() => openForm('edit', selectedUser)}>
                <i className="fa-solid fa-pen"></i> Edit Profil
              </button>
            </div>
          </div>
        </div>
      )}

      {activeModal === 'form' && (
        <div className="master-modal-overlay" onMouseDown={closeModal}>
          <div className="master-modal-card" onMouseDown={(event) => event.stopPropagation()}>
            <div className="master-modal-header">
              <h3>{formTitle}</h3>
              <button className="master-close-button" onClick={closeModal}><i className="fa-solid fa-xmark"></i></button>
            </div>
            <div className="master-modal-body master-form-grid">
              <div className="filter-group form-full">
                <label>Nama Lengkap</label>
                <input value={formData.name} onChange={(event) => setFormData({ ...formData, name: event.target.value })} placeholder="Masukkan nama lengkap" />
              </div>
              <div className="filter-group form-full">
                <label>Alamat Email</label>
                <input type="email" value={formData.email} onChange={(event) => setFormData({ ...formData, email: event.target.value })} placeholder="email@instansi.co.id" />
              </div>
              <div className="filter-group">
                <label>Peran (Role)</label>
                <select value={formData.role} onChange={(event) => setFormData({ ...formData, role: event.target.value })}>
                  <option value="">Pilih Role...</option>
                  <option>Administrator</option>
                  <option>Operator</option>
                  <option>Pemanfaat</option>
                </select>
              </div>
              <div className="filter-group">
                <label>Status</label>
                <select value={formData.status} onChange={(event) => setFormData({ ...formData, status: event.target.value })}>
                  <option>Aktif</option>
                  <option>Non-aktif</option>
                </select>
              </div>
              <div className="filter-group form-full">
                <label>Password Akun</label>
                <input type="password" value={formData.password} onChange={(event) => setFormData({ ...formData, password: event.target.value })} placeholder="Buat password (min. 8 karakter)" />
                <small>Biarkan kosong jika tidak ingin mengubah password pada mode edit.</small>
              </div>
            </div>
            <div className="master-modal-footer">
              <button className="btn btn-outline" onClick={closeModal}>Batal</button>
              <button className="btn btn-primary" onClick={closeModal}>Simpan Akun</button>
            </div>
          </div>
        </div>
      )}

      {activeModal === 'role' && (
        <div className="master-modal-overlay" onMouseDown={closeModal}>
          <div className="master-modal-card master-modal-card--wide" onMouseDown={(event) => event.stopPropagation()}>
            <div className="master-modal-header">
              <h3>Buat & Kelola Role Baru</h3>
              <button className="master-close-button" onClick={closeModal}><i className="fa-solid fa-xmark"></i></button>
            </div>
            <div className="master-modal-body">
              <div className="filter-group">
                <label>Nama Role Baru</label>
                <input placeholder="Contoh: Teknisi Lapangan" />
              </div>
              <div className="master-permission-list">
                {permissions.map((permission, index) => (
                  <label className="master-checkbox-item" key={permission}>
                    <input type="checkbox" defaultChecked={index === 0} />
                    <span>{permission}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="master-modal-footer">
              <button className="btn btn-outline" onClick={closeModal}>Batal</button>
              <button className="btn btn-primary" onClick={closeModal}>
                <i className="fa-solid fa-shield-check"></i> Simpan Role
              </button>
            </div>
          </div>
        </div>
      )}

      {activeModal === 'delete' && (
        <div className="master-modal-overlay" onMouseDown={closeModal}>
          <div className="master-modal-card master-modal-card--danger" onMouseDown={(event) => event.stopPropagation()}>
            <div className="master-danger-icon">
              <i className="fa-solid fa-triangle-exclamation"></i>
            </div>
            <h3>Hapus Akun Pengguna?</h3>
            <p>
              Apakah Anda yakin ingin menghapus akses akun untuk <b>{selectedUser.name}</b>? Akun akan dinonaktifkan dari sistem.
            </p>
            <div className="master-danger-actions">
              <button className="btn btn-outline" onClick={closeModal}>Batal</button>
              <button className="btn btn-danger" onClick={closeModal}>Ya, Hapus</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MasterAccount;
