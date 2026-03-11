import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import StageBadge from "../components/StageBadge";
import api from "../services/api";

const formatTimelineEvent = (item) => {
  if (item.action === "LINKEDIN_IMPORT") {
    return "Candidate imported from LinkedIn RSC";
  }

  if (item.action === "CANDIDATE_STAGE_UPDATED") {
    return `Stage changed to ${item.metadata?.stage || "updated stage"}`;
  }

  if (item.action === "CANDIDATE_NOTE_ADDED") {
    return "Note added by recruiter";
  }

  return item.action.replaceAll("_", " ");
};

const CandidateProfilePage = () => {
  const { id } = useParams();
  const [candidate, setCandidate] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  useEffect(() => {
    const fetchCandidate = async () => {
      const { data } = await api.get(`/candidates/${id}`);
      setCandidate(data);
    };

    fetchCandidate();
  }, [id]);

  const generateSummary = async () => {
    if (!candidate) {
      return;
    }

    setSummaryLoading(true);
    const { data } = await api.post("/ai/candidate-summary", {
      candidateId: candidate.id,
      name: candidate.name,
      skills: candidate.skills,
      experience_years: candidate.experience_years,
      education: candidate.education,
      location: candidate.location
    });

    setCandidate({ ...candidate, ai_summary: data.summary });
    setSummaryLoading(false);
  };

  if (!candidate) {
    return <p>Loading profile...</p>;
  }

  return (
    <section className="panel profile-card">
      <div className="profile-header">
        <div>
          <h2>{candidate.name}</h2>
          <p className="muted">{candidate.email || "Email unavailable"}</p>
        </div>
        <StageBadge stage={candidate.recruitment_stage} />
      </div>
      <p>
        <strong>LinkedIn:</strong>{" "}
        {candidate.linkedin_url ? (
          <a href={candidate.linkedin_url} target="_blank" rel="noreferrer">
            {candidate.linkedin_url}
          </a>
        ) : (
          "N/A"
        )}
      </p>
      <p>
        <strong>Experience:</strong> {candidate.experience_years} years
      </p>
      <p>
        <strong>Phone:</strong> {candidate.phone || "N/A"}
      </p>
      <p>
        <strong>Current Company:</strong> {candidate.current_company || "N/A"}
      </p>
      <p>
        <strong>Current Role:</strong> {candidate.current_role || "N/A"}
      </p>
      <p>
        <strong>Open to Work:</strong> {candidate.open_to_work ? "Yes" : "No"}
      </p>
      <p>
        <strong>Skills:</strong> {candidate.skills.join(", ")}
      </p>
      <p>
        <strong>Education:</strong> {candidate.education || "N/A"}
      </p>
      <p>
        <strong>Location:</strong> {candidate.location || "N/A"}
      </p>
      <p>
        <strong>GitHub:</strong>{" "}
        {candidate.github_url ? (
          <a href={candidate.github_url} target="_blank" rel="noreferrer">
            {candidate.github_url}
          </a>
        ) : (
          "N/A"
        )}
      </p>
      <p>
        <strong>Resume:</strong>{" "}
        {candidate.resume_url ? (
          <a href={candidate.resume_url} target="_blank" rel="noreferrer">
            View Resume
          </a>
        ) : (
          "N/A"
        )}
      </p>
      <div className="panel inner-panel">
        <h3>AI Candidate Summary</h3>
        <p>{candidate.ai_summary || "No summary generated yet."}</p>
        <button type="button" className="btn" onClick={generateSummary} disabled={summaryLoading}>
          {summaryLoading ? "Generating..." : "Generate Summary"}
        </button>
      </div>
      <div className="panel inner-panel">
        <h3>Activity Timeline</h3>
        {(candidate.activity_timeline || []).length === 0 && <p>No activity yet.</p>}
        {(candidate.activity_timeline || []).map((item) => (
          <div key={item.id} className="timeline-item">
            <p className="timeline-title">{formatTimelineEvent(item)}</p>
            <p className="muted small">
              {new Date(item.created_at).toLocaleString()} {item.actor?.name ? `by ${item.actor.name}` : ""}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default CandidateProfilePage;
