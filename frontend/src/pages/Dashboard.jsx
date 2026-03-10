import { Link } from "react-router-dom";
import { 
  Users, 
  Brain, 
  Star, 
  Clock, 
  ArrowRight,
  TrendingUp
} from "lucide-react";
import StatCard from "../components/StatCard";

const Dashboard = ({ candidates = [], recentReports = [] }) => {
  const totalCandidates = candidates.length;
  const analyzedCandidates = candidates.filter(c => c.aiSummary || c.ai_summary).length;
  const shortlisted = candidates.filter(c => 
    c.recruitment_stage === "OFFER" || c.recruitment_stage === "HIRED"
  ).length;
  const pendingReview = candidates.filter(c => 
    c.recruitment_stage === "APPLIED" || c.recruitment_stage === "SCREENING"
  ).length;

  const stats = [
    {
      title: "Total Candidates",
      value: totalCandidates,
      icon: Users,
      color: "primary",
    },
    {
      title: "Candidates Analyzed",
      value: analyzedCandidates,
      icon: Brain,
      color: "purple",
    },
    {
      title: "Shortlisted",
      value: shortlisted,
      icon: Star,
      color: "green",
    },
    {
      title: "Pending Review",
      value: pendingReview,
      icon: Clock,
      color: "yellow",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Overview of your candidate intelligence pipeline
          </p>
        </div>
        <Link to="/add-candidate" className="btn-primary">
          <span>Add New Candidate</span>
          <ArrowRight className="w-4 h-4 ml-2" />
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        {stats.map((stat) => (
          <StatCard
            key={stat.title}
            title={stat.title}
            value={stat.value}
            icon={stat.icon}
            color={stat.color}
          />
        ))}
      </div>

      {/* Recent Activity Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Recent Candidates */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">
              Recent Candidates
            </h2>
            <Link
              to="/candidates"
              className="text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              View all
            </Link>
          </div>
          
          {candidates.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No candidates yet</p>
              <Link
                to="/add-candidate"
                className="mt-3 inline-flex items-center text-sm font-medium text-primary-600 hover:text-primary-700"
              >
                Add your first candidate
                <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {candidates.slice(0, 5).map((candidate) => (
                <Link
                  key={candidate.id}
                  to={`/candidates/${candidate.id}`}
                  className="flex items-center justify-between p-3 sm:p-4 rounded-lg border border-gray-100 hover:border-primary-200 hover:bg-primary-50/30 transition-all duration-200"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-9 h-9 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center font-medium shrink-0">
                      {candidate.name?.charAt(0).toUpperCase() || "?"}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">{candidate.name}</p>
                      <p className="text-sm text-gray-500 truncate">
                        {candidate.current_role || candidate.currentRole || "Candidate"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {(candidate.aiSummary || candidate.ai_summary) && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                        <Brain className="w-3 h-3 mr-1" />
                        Analyzed
                      </span>
                    )}
                    <ArrowRight className="w-4 h-4 text-gray-400" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">
            Quick Actions
          </h2>
          <div className="space-y-3">
            <Link
              to="/add-candidate"
              className="flex items-center gap-4 p-4 rounded-lg border border-gray-100 hover:border-primary-200 hover:bg-primary-50/30 transition-all duration-200"
            >
              <div className="p-3 rounded-lg bg-primary-50 text-primary-600">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Add New Candidate</p>
                <p className="text-sm text-gray-500">
                  Input candidate info and run AI analysis
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400 ml-auto" />
            </Link>
            
            <Link
              to="/candidates"
              className="flex items-center gap-4 p-4 rounded-lg border border-gray-100 hover:border-primary-200 hover:bg-primary-50/30 transition-all duration-200"
            >
              <div className="p-3 rounded-lg bg-purple-50 text-purple-600">
                <Brain className="w-5 h-5" />
              </div>
              <div>
                <p className="font-medium text-gray-900">View All Reports</p>
                <p className="text-sm text-gray-500">
                  Browse all candidate analysis reports
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400 ml-auto" />
            </Link>

            <div className="flex items-center gap-4 p-4 rounded-lg bg-linear-to-r from-primary-50 to-purple-50 border border-primary-100">
              <div className="p-3 rounded-lg bg-white shadow-sm">
                <TrendingUp className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">AI-Powered Insights</p>
                <p className="text-sm text-gray-500">
                  {analyzedCandidates} of {totalCandidates} candidates analyzed
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
