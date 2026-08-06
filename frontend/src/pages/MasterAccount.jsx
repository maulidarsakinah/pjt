import { useEffect, useMemo, useState } from "react";
import useAuth from "../contexts/useAuth";
import KPICard from "../components/KPICard";
import {
  createRole,
  createUser,
  getPermissions,
  getRolePermissions,
  getRoles,
  getUserSummary,
  getUsers,
  resetUserPassword,
  updateRole,
  updateRolePermissions,
  updateUser,
} from "../services/api";
import "./MasterAccount.css";

const PAGE_SIZE = 10;

const initialForm = {
  name: "",
  email: "",
  phone: "",
  roleId: "",
  status: "1",
  password: "",
};

const masterKpiDescriptions = {
  total: "Total seluruh akun pengguna yang tercatat pada aplikasi HydroTrack.",
  admin:
    "Jumlah akun dengan role administrator yang memiliki akses pengelolaan sistem.",
  operator:
    "Jumlah akun operator yang bertugas melakukan pemantauan data lapangan.",
  active:
    "Jumlah akun aktif yang saat ini dapat digunakan untuk mengakses aplikasi.",
};

const STATIC_ROLES = [
  { id: 1, name: "Administrator" },
  { id: 2, name: "Operator" },
  { id: 3, name: "Viewer" },
];

const STATIC_PERMISSIONS = [
  { id: 1, action: "View Dashboard" },
  { id: 2, action: "Manage Users" },
  { id: 3, action: "Manage Stations" },
];

const STATIC_SUMMARY = {
  total: 3,
  admin: 1,
  operator: 1,
  active: 3,
};

const STATIC_USERS = [
  {
    id: 1,
    name: "Admin User",
    email: "admin@gmail.com",
    phone: "08123456789",
    roles: ["Administrator"],
    role_id: 1,
    status: "1",
    last_login_at: new Date().toISOString(),
  },
  {
    id: 2,
    name: "PJT User",
    email: "pjt@gmail.com",
    phone: "08123456780",
    roles: ["Operator"],
    role_id: 2,
    status: "1",
    last_login_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 3,
    name: "Viewer User",
    email: "viewer@gmail.com",
    phone: "08123456781",
    roles: ["Viewer"],
    role_id: 3,
    status: "1",
    last_login_at: new Date(Date.now() - 172800000).toISOString(),
  },
];

function getInitials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function normalizeUser(user) {
  const roles = Array.isArray(user.roles)
    ? user.roles.map((role) => (typeof role === "string" ? role : role.name))
    : [];

  return {
    ...user,
    id: `USR-${String(user.id).padStart(3, "0")}`,
    numericId: user.id,
    role: user.role_name || roles.join(", ") || "-",
    roleNames: roles,
    status: user.status === "1" ? "Aktif" : "Non-aktif",
    lastLogin: user.last_login_at
      ? new Date(user.last_login_at).toLocaleString("id-ID")
      : "-",
  };
}

function useMediaQuery(query) {
  const [matches, setMatches] = useState(
    () => window.matchMedia(query).matches,
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const handleChange = (event) => setMatches(event.matches);

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [query]);

  return matches;
}

function pageNumbers(currentPage, totalPages) {
  const pages = new Set([
    1,
    totalPages,
    currentPage - 1,
    currentPage,
    currentPage + 1,
  ]);
  return [...pages]
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);
}

const MasterMobileRow = ({ user, openDetail, openForm, openDelete }) => (
  <li>
    <div className="master-mobile-log">
      <span className="master-mobile-log-main">
        <span className="master-mobile-log-topline">
          <strong>{user.name}</strong>
          <span
            className={`master-mobile-status ${user.status === "Aktif" ? "is-active" : "is-inactive"}`}
          >
            {user.status}
          </span>
        </span>
        <span className="master-mobile-log-meta">
          <span>{user.email}</span>
          <span className="master-role-badge">{user.role}</span>
        </span>
        <div className="master-mobile-actions">
          <div className="master-mobile-actions-left">
            <button
              className="master-icon-button"
              type="button"
              title="Detail"
              onClick={() => openDetail(user)}
            >
              <i className="fa-regular fa-eye" />
            </button>
            <button
              className="master-icon-button"
              type="button"
              title="Edit"
              onClick={() => openForm("edit", user)}
            >
              <i className="fa-solid fa-pen" />
            </button>
            <button
              className="master-icon-button danger"
              type="button"
              title="Nonaktifkan"
              onClick={() => openDelete(user)}
            >
              <i className="fa-solid fa-user-slash" />
            </button>
          </div>
          <span className="master-mobile-last-login">{user.lastLogin}</span>
        </div>
      </span>
    </div>
  </li>
);

const MasterAccount = () => {
  const { user } = useAuth();
  const isDemoUser = Boolean(user?.is_demo);
  const isMobile = useMediaQuery("(max-width: 760px)");
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({
    search: "",
    roleId: "",
    status: "",
  });
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [summary, setSummary] = useState({
    total: 0,
    admin: 0,
    operator: 0,
    active: 0,
  });
  const [roles, setRoles] = useState([]);
  const [permissionCatalog, setPermissionCatalog] = useState([]);
  const [activeModal, setActiveModal] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [formTitle, setFormTitle] = useState("Tambah Akun Baru");
  const [formData, setFormData] = useState(initialForm);
  const [roleName, setRoleName] = useState("");
  const [selectedPermissionIds, setSelectedPermissionIds] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const totalPages = Math.max(1, Math.ceil(totalUsers / PAGE_SIZE));
  const visiblePages = useMemo(
    () => pageNumbers(page, totalPages),
    [page, totalPages],
  );

  useEffect(() => {
    let active = true;

    if (isDemoUser) {
      setSummary(STATIC_SUMMARY);
      setRoles(STATIC_ROLES);
      setPermissionCatalog(STATIC_PERMISSIONS);
      return;
    }

    Promise.all([
      getUserSummary(),
      getRoles({ limit: 500 }),
      getPermissions({ limit: 500 }),
    ])
      .then(([summaryResponse, roleResponse, permissionResponse]) => {
        if (!active) return;
        setSummary(summaryResponse.data);
        setRoles(roleResponse.data || []);
        setPermissionCatalog(permissionResponse.data || []);
      })
      .catch((error) => active && setErrorMessage(error.message));

    return () => {
      active = false;
    };
  }, [reloadKey, isDemoUser]);

  useEffect(() => {
    let active = true;
    const query = {
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    };

    if (appliedFilters.search) query.search = appliedFilters.search;
    if (appliedFilters.roleId) query.role_id = appliedFilters.roleId;
    if (appliedFilters.status) query.status = appliedFilters.status;

    if (isDemoUser) {
      let filteredUsers = [...STATIC_USERS];
      if (query.search) {
        const searchLower = query.search.toLowerCase();
        filteredUsers = filteredUsers.filter(u =>
          u.name.toLowerCase().includes(searchLower) ||
          u.email.toLowerCase().includes(searchLower) ||
          u.roles.join(", ").toLowerCase().includes(searchLower)
        );
      }
      if (query.role_id) {
        filteredUsers = filteredUsers.filter(u => String(u.role_id) === String(query.role_id));
      }
      if (query.status) {
        filteredUsers = filteredUsers.filter(u => String(u.status) === String(query.status));
      }

      setUsers(filteredUsers.slice(query.offset, query.offset + query.limit).map(normalizeUser));
      setTotalUsers(filteredUsers.length);
      setLoading(false);
      return;
    }

    getUsers(query)
      .then((response) => {
        if (!active) return;
        setUsers((response.data || []).map(normalizeUser));
        setTotalUsers(Number(response.total) || 0);
      })
      .catch((error) => active && setErrorMessage(error.message))
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, [appliedFilters, page, reloadKey, isDemoUser]);

  const closeModal = () => {
    setActiveModal(null);
    setSaving(false);
    setSelectedRole(null);
  };

  const openDetail = (user) => {
    setSelectedUser(user);
    setActiveModal("detail");
  };

  const openForm = (mode, user = null) => {
    setSelectedUser(user);
    setFormTitle(mode === "edit" ? "Edit Akun Pengguna" : "Tambah Akun Baru");
    setFormData(
      user
        ? {
            name: user.name,
            email: user.email,
            phone: user.phone || "",
            roleId:
              roles.find((role) => user.roleNames.includes(role.name))?.id ||
              "",
            status: user.status === "Aktif" ? "1" : "0",
            password: "",
          }
        : initialForm,
    );
    setErrorMessage("");
    setActiveModal("form");
  };

  const openRoleForm = async (role = null) => {
    setSelectedRole(role);
    if (role) {
      setRoleName(role.name);
      try {
        const res = await getRolePermissions(role.id);
        setSelectedPermissionIds((res.data || []).map(p => p.id));
      } catch (err) {
        setErrorMessage(err.message);
      }
    } else {
      setRoleName("");
      setSelectedPermissionIds([]);
    }
    setActiveModal("role");
  };

  const openRoleList = () => {
    setActiveModal("role-list");
  };

  const openDelete = (user) => {
    setSelectedUser(user);
    setActiveModal("delete");
  };

  const applyFilters = () => {
    setLoading(true);
    setErrorMessage("");
    setPage(1);
    setAppliedFilters({
      search: searchTerm.trim(),
      roleId: roleFilter,
      status: statusFilter,
    });
  };

  const resetFilters = () => {
    setLoading(true);
    setErrorMessage("");
    setSearchTerm("");
    setRoleFilter("");
    setStatusFilter("");
    setPage(1);
    setAppliedFilters({ search: "", roleId: "", status: "" });
  };

  const refreshData = () => {
    setLoading(true);
    setErrorMessage("");
    setReloadKey((current) => current + 1);
  };

  const travelToPage = (nextPage) => {
    if (nextPage === page || nextPage < 1 || nextPage > totalPages) return;
    setLoading(true);
    setErrorMessage("");
    setPage(nextPage);
  };

  const saveUser = async () => {
    if (isDemoUser) {
      alert("Aksi ini dinonaktifkan untuk akun demo.");
      closeModal();
      return;
    }
    setSaving(true);
    setErrorMessage("");
    const body = {
      name: formData.name,
      email: formData.email,
      phone: formData.phone || null,
      status: formData.status,
      role_ids: formData.roleId ? [Number(formData.roleId)] : [],
    };

    try {
      if (selectedUser?.numericId) {
        await updateUser(selectedUser.numericId, body);
        if (formData.password) {
          await resetUserPassword(selectedUser.numericId, formData.password);
        }
      } else {
        await createUser({ ...body, password: formData.password });
      }
      closeModal();
      refreshData();
    } catch (error) {
      setErrorMessage(error.message);
      setSaving(false);
    }
  };

  const deactivateUser = async () => {
    if (isDemoUser) {
      alert("Aksi ini dinonaktifkan untuk akun demo.");
      closeModal();
      return;
    }
    if (!selectedUser) return;
    setSaving(true);
    try {
      await updateUser(selectedUser.numericId, { status: "0" });
      closeModal();
      refreshData();
    } catch (error) {
      setErrorMessage(error.message);
      setSaving(false);
    }
  };

  const togglePermission = (permissionId) => {
    setSelectedPermissionIds((current) =>
      current.includes(permissionId)
        ? current.filter((id) => id !== permissionId)
        : [...current, permissionId],
    );
  };

  const saveRole = async () => {
    if (isDemoUser) {
      alert("Aksi ini dinonaktifkan untuk akun demo.");
      closeModal();
      return;
    }
    setSaving(true);
    setErrorMessage("");
    try {
      if (selectedRole) {
        await updateRole(selectedRole.id, { name: roleName, guard_name: "web" });
        await updateRolePermissions(selectedRole.id, selectedPermissionIds);
      } else {
        const response = await createRole({ name: roleName, guard_name: "web" });
        await updateRolePermissions(response.data.id, selectedPermissionIds);
      }
      setRoleName("");
      setSelectedPermissionIds([]);
      setSelectedRole(null);
      closeModal();
      refreshData();
    } catch (error) {
      setErrorMessage(error.message);
      setSaving(false);
    }
  };

  const exportUsers = () => {
    const headers = [
      "ID",
      "Nama",
      "Email",
      "Telepon",
      "Role",
      "Status",
      "Terakhir Login",
    ];
    const rows = users.map((user) => [
      user.id,
      user.name,
      user.email,
      user.phone || "",
      user.role,
      user.status,
      user.lastLogin,
    ]);
    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((value) => `"${String(value).replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `master-akun-page-${page}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const firstShown = totalUsers === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastShown = Math.min(page * PAGE_SIZE, totalUsers);

  return (
    <div className="view-section master-account-page">
      <div className="header-section master-account-header">
        <div>
          <h1>Master Akun</h1>
          <p>Kelola pengguna, role, dan perizinan akses aplikasi HydroTrack.</p>
        </div>
      </div>

      <div className="kpi-grid master-kpi-grid">
        {[
          [
            "Total Pengguna",
            summary.total,
            "fa-users",
            "ALL",
            "#3A4BCF",
            "Seluruh tenant dan operator",
            masterKpiDescriptions.total,
          ],
          [
            "Admin",
            summary.admin,
            "fa-user-shield",
            "ADMIN",
            "#d97706",
            "Role administrator aktif",
            masterKpiDescriptions.admin,
          ],
          [
            "Operator",
            summary.operator,
            "fa-headset",
            "OPS",
            "#059669",
            "Tim pemantauan lapangan",
            masterKpiDescriptions.operator,
          ],
          [
            "Akun Aktif",
            summary.active,
            "fa-circle-check",
            "LIVE",
            "#0891b2",
            "Akses siap digunakan",
            masterKpiDescriptions.active,
          ],
        ].map(
          ([title, value, icon, badge, accent, description, information]) => (
            <div
              className="master-kpi-card-wrap"
              key={title}
              title={information}
            >
              <KPICard
                title={title}
                value={String(value)}
                icon={icon}
                badge={badge}
                accent={accent}
                descText={description}
              />
            </div>
          ),
        )}
      </div>

      <section className="panel master-table-panel">
        <div className="panel-header master-table-header">
          <div>
            <div className="panel-title">Daftar Akun Pengguna</div>
            <div className="panel-subtitle">
              Data akun dan akses langsung dari database.
            </div>
          </div>
          <span className="master-table-count">{totalUsers} akun</span>
        </div>

        <div className="master-table-tools">
          <div className="master-filter-row">
            <div className="filter-group">
              <label>Cari Pengguna</label>
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && applyFilters()}
                placeholder="Nama, email, atau ID"
              />
            </div>
            <div className="filter-group">
              <label>Peran Pengguna</label>
              <select
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value)}
              >
                <option value="">Semua peran</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label>Status Akun</label>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="">Semua status</option>
                <option value="1">Aktif</option>
                <option value="0">Non-aktif</option>
              </select>
            </div>
            <div className="master-filter-actions">
              <button
                className="btn btn-primary"
                type="button"
                onClick={applyFilters}
              >
                Terapkan
              </button>
              <button
                className="btn btn-outline"
                type="button"
                onClick={resetFilters}
              >
                Reset
              </button>
            </div>
          </div>

          <div className="master-action-row">
            <div className="master-action-group">
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => openForm("add")}
              >
                <i className="fa-solid fa-plus" /> Tambah Akun
              </button>
              <button
                className="btn btn-outline"
                type="button"
                onClick={openRoleList}
              >
                <i className="fa-solid fa-list" /> Daftar Role
              </button>
            </div>
            <button
              className="btn btn-outline"
              type="button"
              onClick={exportUsers}
              disabled={!users.length}
            >
              <i className="fa-solid fa-download" /> Export halaman
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="master-feedback is-error" role="alert">
            {errorMessage}
          </div>
        )}

        <div
          className="table-container master-table-container"
          aria-busy={loading}
        >
          {loading ? (
            <div className="master-empty-state">Memuat data akun…</div>
          ) : users.length === 0 ? (
            <div className="master-empty-state">
              Tidak ada akun yang sesuai dengan filter.
            </div>
          ) : isMobile ? (
            <ul className="master-mobile-list">
              {users.map((user) => (
                <MasterMobileRow
                  key={user.numericId}
                  user={user}
                  openDetail={openDetail}
                  openForm={openForm}
                  openDelete={openDelete}
                />
              ))}
            </ul>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>ID Pengguna</th>
                  <th>Nama</th>
                  <th>Email</th>
                  <th>Peran</th>
                  <th>Status</th>
                  <th>Terakhir Login</th>
                  <th className="master-actions-heading">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.numericId}>
                    <td>
                      <b>{user.id}</b>
                    </td>
                    <td>
                      <span className="master-user-name">{user.name}</span>
                    </td>
                    <td>{user.email}</td>
                    <td>
                      <span className="master-role-badge">{user.role}</span>
                    </td>
                    <td>
                      <span
                        className={`master-status ${user.status === "Aktif" ? "is-active" : "is-inactive"}`}
                      >
                        <span />
                        {user.status}
                      </span>
                    </td>
                    <td>{user.lastLogin}</td>
                    <td>
                      <div className="master-table-actions">
                        <button
                          className="master-icon-button"
                          type="button"
                          title="Detail"
                          onClick={() => openDetail(user)}
                        >
                          <i className="fa-regular fa-eye" />
                        </button>
                        <button
                          className="master-icon-button"
                          type="button"
                          title="Edit"
                          onClick={() => openForm("edit", user)}
                        >
                          <i className="fa-solid fa-pen" />
                        </button>
                        <button
                          className="master-icon-button danger"
                          type="button"
                          title="Nonaktifkan"
                          onClick={() => openDelete(user)}
                        >
                          <i className="fa-solid fa-user-slash" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <nav className="pagination" aria-label="Navigasi halaman akun">
          <div className="page-info">
            Menampilkan {firstShown}–{lastShown} dari {totalUsers} data
          </div>
          <div className="page-controls">
            <button
              className="page-btn"
              type="button"
              disabled={page === 1 || loading}
              onClick={() => travelToPage(page - 1)}
              aria-label="Halaman sebelumnya"
            >
              <i className="fa-solid fa-chevron-left" />
            </button>
            {visiblePages.map((pageNumber, index) => {
              const previous = visiblePages[index - 1];
              return (
                <span className="master-page-item" key={pageNumber}>
                  {previous && pageNumber - previous > 1 && (
                    <span className="master-page-gap">…</span>
                  )}
                  <button
                    className={`page-btn ${pageNumber === page ? "active" : ""}`}
                    type="button"
                    aria-current={pageNumber === page ? "page" : undefined}
                    onClick={() => travelToPage(pageNumber)}
                  >
                    {pageNumber}
                  </button>
                </span>
              );
            })}
            <button
              className="page-btn"
              type="button"
              disabled={page === totalPages || loading}
              onClick={() => travelToPage(page + 1)}
              aria-label="Halaman berikutnya"
            >
              <i className="fa-solid fa-chevron-right" />
            </button>
          </div>
        </nav>
      </section>

      {activeModal === "detail" && selectedUser && (
        <div className="master-modal-overlay" onMouseDown={closeModal}>
          <div
            className="master-modal-card master-modal-card--sm"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="master-modal-header">
              <h3>Detail Pengguna</h3>
              <button
                className="master-close-button"
                type="button"
                onClick={closeModal}
                aria-label="Tutup"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <div className="master-modal-body">
              <div className="master-detail-profile">
                <div className="master-detail-avatar">
                  {getInitials(selectedUser.name)}
                </div>
                <h4>{selectedUser.name}</h4>
                <p>{selectedUser.email}</p>
                <span className="master-role-badge">{selectedUser.role}</span>
              </div>
              <div className="master-info-grid">
                <div>
                  <span>ID Pengguna</span>
                  <strong>{selectedUser.id}</strong>
                </div>
                <div>
                  <span>Status Akun</span>
                  <strong>{selectedUser.status}</strong>
                </div>
                <div>
                  <span>Telepon</span>
                  <strong>{selectedUser.phone || "-"}</strong>
                </div>
                <div>
                  <span>Perusahaan</span>
                  <strong>{selectedUser.company_id || "-"}</strong>
                </div>
              </div>
              <div className="master-activity-card">
                <span>Login terakhir</span>
                <strong>{selectedUser.lastLogin}</strong>
              </div>
            </div>
            <div className="master-modal-footer">
              <button
                className="btn btn-outline"
                type="button"
                onClick={closeModal}
              >
                Tutup
              </button>
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => openForm("edit", selectedUser)}
              >
                <i className="fa-solid fa-pen" /> Edit profil
              </button>
            </div>
          </div>
        </div>
      )}

      {activeModal === "form" && (
        <div className="master-modal-overlay" onMouseDown={closeModal}>
          <div
            className="master-modal-card"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="master-modal-header">
              <h3>{formTitle}</h3>
              <button
                className="master-close-button"
                type="button"
                onClick={closeModal}
                aria-label="Tutup"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <div className="master-modal-body master-form-grid">
              <div className="filter-group form-full">
                <label>Nama lengkap</label>
                <input
                  value={formData.name}
                  onChange={(event) =>
                    setFormData({ ...formData, name: event.target.value })
                  }
                />
              </div>
              <div className="filter-group form-full">
                <label>Alamat email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(event) =>
                    setFormData({ ...formData, email: event.target.value })
                  }
                />
              </div>
              <div className="filter-group form-full">
                <label>Nomor telepon</label>
                <input
                  value={formData.phone}
                  onChange={(event) =>
                    setFormData({ ...formData, phone: event.target.value })
                  }
                />
              </div>
              <div className="filter-group">
                <label>Peran</label>
                <select
                  value={formData.roleId}
                  onChange={(event) =>
                    setFormData({ ...formData, roleId: event.target.value })
                  }
                >
                  <option value="">Tanpa role</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="filter-group">
                <label>Status</label>
                <select
                  value={formData.status}
                  onChange={(event) =>
                    setFormData({ ...formData, status: event.target.value })
                  }
                >
                  <option value="1">Aktif</option>
                  <option value="0">Non-aktif</option>
                </select>
              </div>
              <div className="filter-group form-full">
                <label>
                  {selectedUser ? "Password baru (opsional)" : "Password"}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(event) =>
                    setFormData({ ...formData, password: event.target.value })
                  }
                  minLength={8}
                />
                <small>
                  Minimal 8 karakter. Kosongkan saat edit jika password tidak
                  berubah.
                </small>
              </div>
            </div>
            <div className="master-modal-footer">
              <button
                className="btn btn-outline"
                type="button"
                onClick={closeModal}
              >
                Batal
              </button>
              <button
                className="btn btn-primary"
                type="button"
                onClick={saveUser}
                disabled={saving}
              >
                {saving ? "Menyimpan…" : "Simpan akun"}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeModal === "role" && (
        <div className="master-modal-overlay" onMouseDown={closeModal}>
          <div
            className="master-modal-card master-modal-card--wide"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="master-modal-header" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <button
                className="master-icon-button"
                type="button"
                onClick={openRoleList}
                aria-label="Kembali ke Daftar Role"
                style={{ padding: '6px', margin: '-6px 0 -6px -6px' }}
              >
                <i className="fa-solid fa-arrow-left" />
              </button>
              <h3 style={{ margin: 0 }}>{selectedRole ? "Edit Role" : "Buat role baru"}</h3>
            </div>
            <div className="master-modal-body">
              <div className="filter-group">
                <label>Nama role</label>
                <input
                  value={roleName}
                  onChange={(event) => setRoleName(event.target.value)}
                  placeholder="Contoh: Teknisi Lapangan"
                />
              </div>
              <div className="master-permission-heading">
                <strong>Permission database</strong>
                <span>
                  {selectedPermissionIds.length} dipilih dari{" "}
                  {permissionCatalog.length}
                </span>
              </div>
              <div className="master-permission-list">
                {permissionCatalog.length ? (
                  permissionCatalog.map((permission) => (
                    <label className="master-checkbox-item" key={permission.id}>
                      <input
                        type="checkbox"
                        checked={selectedPermissionIds.includes(permission.id)}
                        onChange={() => togglePermission(permission.id)}
                      />
                      <span>{permission.name}</span>
                    </label>
                  ))
                ) : (
                  <div className="master-empty-state">
                    Belum ada permission di database.
                  </div>
                )}
              </div>
            </div>
            <div className="master-modal-footer">
              <button
                className="btn btn-outline"
                type="button"
                onClick={openRoleList}
              >
                Kembali
              </button>
              <button
                className="btn btn-primary"
                type="button"
                onClick={saveRole}
                disabled={saving || !roleName.trim()}
              >
                {saving ? "Menyimpan…" : "Simpan role"}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeModal === "role-list" && (
        <div className="master-modal-overlay" onMouseDown={closeModal}>
          <div
            className="master-modal-card master-modal-card--wide"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="master-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <h3 style={{ margin: 0 }}>Daftar Role</h3>
                <button
                  className="btn btn-primary"
                  type="button"
                  onClick={() => openRoleForm()}
                  style={{ padding: '6px 12px', fontSize: '13px' }}
                >
                  <i className="fa-solid fa-plus" style={{ marginRight: '6px' }} /> Buat Role
                </button>
              </div>
              <button
                className="master-close-button"
                type="button"
                onClick={closeModal}
                aria-label="Tutup"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <div className="master-modal-body">
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Nama Role</th>
                      <th className="master-actions-heading">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roles.length > 0 ? (
                      roles.map((role) => (
                        <tr key={role.id}>
                          <td><b>{role.id}</b></td>
                          <td><span className="master-role-badge">{role.name}</span></td>
                          <td>
                            <div className="master-table-actions">
                              <button
                                className="master-icon-button"
                                type="button"
                                title="Edit Role"
                                onClick={() => openRoleForm(role)}
                              >
                                <i className="fa-solid fa-pen" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="3">
                          <div className="master-empty-state">Tidak ada role.</div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="master-modal-footer">
              <button
                className="btn btn-outline"
                type="button"
                onClick={closeModal}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {activeModal === "delete" && selectedUser && (
        <div className="master-modal-overlay" onMouseDown={closeModal}>
          <div
            className="master-modal-card master-modal-card--danger"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="master-danger-icon">
              <i className="fa-solid fa-user-slash" />
            </div>
            <h3>Nonaktifkan akun?</h3>
            <p>
              Akses <b>{selectedUser.name}</b> akan dihentikan. Data pengguna
              tetap tersimpan.
            </p>
            <div className="master-danger-actions">
              <button
                className="btn btn-outline"
                type="button"
                onClick={closeModal}
              >
                Batal
              </button>
              <button
                className="btn btn-danger"
                type="button"
                onClick={deactivateUser}
                disabled={saving}
              >
                {saving ? "Memproses…" : "Nonaktifkan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MasterAccount;
