import { Link, Route, Routes } from "react-router-dom";
import { Home } from "./pages/Home";
import { CreateListing } from "./pages/CreateListing";
import { Login } from "./pages/Login";
import { ListingDetail } from "./pages/ListingDetail";
import { Uitleg } from "./pages/Uitleg";
import { clearToken, getToken } from "./lib/api";

function App() {
  return (
    <div className="app">
      <nav>
        <Link to="/">OpenBod</Link>
        <Link to="/uitleg">Uitleg</Link>
        {getToken() ? (
          <button
            onClick={() => {
              clearToken();
              window.location.reload();
            }}
          >
            Uitloggen
          </button>
        ) : (
          <Link to="/login">Inloggen</Link>
        )}
      </nav>
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/woningen/nieuw" element={<CreateListing />} />
          <Route path="/woningen/:id" element={<ListingDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/uitleg" element={<Uitleg />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
