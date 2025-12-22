import { BrowserRouter, Route, Routes } from "react-router-dom";
import { MainLayout } from "./layout/MainLayout";
import ProjectsPage from "./pages/ProjectsPage";
import ClaimsPage from "./pages/ClaimsPage";
import ClaimDetailPage from "./pages/ClaimDetailPage";
import MarketPage from "./pages/MarketPage";
import RetirePage from "./pages/RetirePage";
import AuditPage from "./pages/AuditPage";
import AdminAddAuditorPage from "./pages/AdminAddAuditorPage";
import HomeRedirect from "./components/HomeRedirect";

function App() {
  return (
    <BrowserRouter>
      <MainLayout>
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/claims" element={<ClaimsPage />} />
          <Route path="/claims/:claimId" element={<ClaimDetailPage />} />
          <Route path="/market" element={<MarketPage />} />
          <Route path="/retire" element={<RetirePage />} />
          <Route path="/audit" element={<AuditPage />} />
          <Route path="/admin/add-auditor" element={<AdminAddAuditorPage />} />
        </Routes>
      </MainLayout>
    </BrowserRouter>
  );
}

export default App;
