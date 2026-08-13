import { Link } from "react-router-dom";
import "./NotFound.css";

const NotFound = ({
  title = "404 - Halaman Tidak Ditemukan",
  message = "Halaman yang Anda cari tidak ada atau akun Anda tidak memiliki izin (permission) yang sesuai untuk mengaksesnya.",
}) => {
  return (
    <div className="not-found-page">
      <div className="not-found-card">
        <div className="not-found-icon">
          <i className="fa-solid fa-shield-cat" />
        </div>
        <h1 className="not-found-title">{title}</h1>
        <p className="not-found-message">{message}</p>
        <div className="not-found-actions">
          <Link to="/admin" className="btn btn-primary">
            <i className="fa-solid fa-house" style={{ marginRight: "6px" }} />
            Kembali ke Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
