import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  Brain,
  ArrowRight,
  Users,
  Filter,
  ChevronDown,
} from "lucide-react";

const CandidatesList = ({ candidates = [] }) => {
  const [search, setSearch] = useState("");
  const [filterStage, setFilterStage] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const stages = [
    { value: "", label: "All Stages" },
    { value: "APPLIED", label: "Applied" },
    { value: "SCREENING", label: "Screening" },
    { value: "INTERVIEW", label: "Interview" },
    { value: "OFFER", label: "Offer" },
    { value: "HIRED", label: "Hired" },
    { value: "REJECTED", label: "Rejected" },
  ];

  const filteredCandidates = candidates.filter((candidate) => {
    const matchesSearch =
      !search ||
      candidate.name?.toLowerCase().includes(search.toLowerCase()) ||
      candidate.email?.toLowerCase().includes(search.toLowerCase()) ||
      candidate.skills?.some((s) =>
        s.toLowerCase().includes(search.toLowerCase())
      );

    const matchesStage =
      !filterStage || candidate.recruitment_stage === filterStage;

    return matchesSearch && matchesStage;
  });

  const getStageColor = (stage) => {
    const colors = {
      APPLIED: "bg-gray-100 text-gray-700",
      SCREENING: "bg-blue-100 text-blue-700",
      INTERVIEW: "bg-purple-100 text-purple-700",
      OFFER: "bg-green-100 text-green-700",
      HIRED: "bg-emerald-100 text-emerald-700",
      REJECTED: "bg-red-100 text-red-700",
    };
    return colors[stage] || "bg-gray-100 text-gray-700";
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            All Candidates
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {filteredCandidates.length} candidate
            {filteredCandidates.length !== 1 ? "s" : ""} found
          </p>
        </div>
        <Link to="/add-candidate" className="btn-primary">
          Add Candidate
        </Link>
      </div>

      {/* Search and Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search Input */}
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="w-5 h-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, or skills..."
              className="input-field pl-12"
            />
          </div>

          {/* Stage Filter */}
          <div className="relative sm:w-48">
            <select
              value={filterStage}
              onChange={(e) => setFilterStage(e.target.value)}
              className="input-field appearance-none pr-10"
            >
              {stages.map((stage) => (
                <option key={stage.value} value={stage.value}>
                  {stage.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Candidates List */}
      {filteredCandidates.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 text-gray-400 rounded-full mb-4">
            <Users className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {search || filterStage ? "No matches found" : "No candidates yet"}
          </h3>
          <p className="text-gray-500 mb-6">
            {search || filterStage
              ? "Try adjusting your search or filters"
              : "Add your first candidate to get started"}
          </p>
          {!search && !filterStage && (
            <Link to="/add-candidate" className="btn-primary inline-flex">
              Add Candidate
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCandidates.map((candidate) => (
            <Link
              key={candidate.id}
              to={`/candidates/${candidate.id}`}
              className="card p-4 sm:p-5 flex items-center justify-between hover:shadow-md hover:border-primary-200 transition-all duration-200 group"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {/* Avatar */}
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary-100 text-primary-600 rounded-xl flex items-center justify-center font-semibold text-base sm:text-lg shrink-0">
                  {candidate.name?.charAt(0).toUpperCase() || "?"}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors truncate">
                      {candidate.name}
                    </h3>
                    {(candidate.ai_summary || candidate.aiSummary) && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 shrink-0">
                        <Brain className="w-3 h-3 mr-1" />
                        Analyzed
                      </span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-gray-500 mt-0.5 truncate">
                    {candidate.email}
                  </p>
                  {candidate.skills?.length > 0 && (
                    <div className="hidden sm:flex flex-wrap gap-1.5 mt-2">
                      {candidate.skills.slice(0, 3).map((skill, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded"
                        >
                          {skill}
                        </span>
                      ))}
                      {candidate.skills.length > 3 && (
                        <span className="px-2 py-0.5 text-xs text-gray-400">
                          +{candidate.skills.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Side */}
              <div className="flex items-center gap-2 sm:gap-4 shrink-0 ml-2">
                <span
                  className={`hidden sm:inline-flex px-3 py-1 text-xs font-medium rounded-full ${getStageColor(
                    candidate.recruitment_stage
                  )}`}
                >
                  {candidate.recruitment_stage?.replace("_", " ") || "Applied"}
                </span>
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-300 group-hover:text-primary-500 transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default CandidatesList;
