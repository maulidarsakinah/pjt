import './LogoutModal.css';

const LogoutModal = ({ isOpen, onClose, onConfirm }) => {
  return (
    <div className={`modal-overlay ${isOpen ? 'active' : ''}`}>
      <div className="modal-content">
        <div className="modal-icon">
          <i className="fa-solid fa-arrow-right-from-bracket"></i>
        </div>
        <h3 className="modal-title">Anda yakin ingin keluar?</h3>
        <p className="modal-desc">
          Sesi Anda akan diakhiri dan Anda harus masuk kembali untuk mengakses dashboard pemantauan.
        </p>
        <div className="modal-actions">
          <button className="btn btn-outline" onClick={onClose}>Batal</button>
          <button className="btn btn-danger" onClick={onConfirm}>Ya, Keluar</button>
        </div>
      </div>
    </div>
  );
};

export default LogoutModal;
