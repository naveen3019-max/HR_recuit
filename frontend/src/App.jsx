import { Navigate, Route, Routes } from "react-router-dom";
import { useEffect, useState } from "react";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import AddCandidate from "./pages/AddCandidate";
import CandidatesList from "./pages/CandidatesList";
import CandidateReport from "./pages/CandidateReport";
import EmployeeMonitoring from "./pages/EmployeeMonitoring";
import CandidateMatching from "./pages/CandidateMatching";
import JobRoleMatching from "./pages/JobRoleMatching";
import TalentSearch from "./pages/TalentSearch";
import AttritionDashboard from "./pages/AttritionDashboard";
import Login from "./pages/Login";
import api from "./services/api";
import { useAuth } from "./context/AuthContext";

const App = () => {
  const { user, loading } = useAuth();
  const [candidates, setCandidates] = useState([]);

  const fetchCandidates = async () => {
    try {
      const { data } = await api.get("/candidates");
      setCandidates(data);
    } catch (err) {
      console.error("Failed to fetch candidates:", err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchCandidates();
    }
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500">
          <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard candidates={candidates} />} />
        <Route path="/add-candidate" element={<AddCandidate />} />
        <Route path="/candidates" element={<CandidatesList candidates={candidates} />} />
        <Route path="/candidates/:id" element={<CandidateReport />} />
        <Route path="/employees" element={<EmployeeMonitoring />} />
        <Route path="/attrition" element={<AttritionDashboard />} />
        <Route path="/candidate-matching" element={<CandidateMatching />} />
        <Route path="/job-roles" element={<JobRoleMatching />} />
        <Route path="/talent-search" element={<TalentSearch />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
};

export default App;
