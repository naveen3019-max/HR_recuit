import { Link } from "react-router-dom";
import StageBadge from "./StageBadge";

const CandidateTable = ({ candidates }) => {
  return (
    <div className="panel table-wrapper">
      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Company</th>
            <th>Role</th>
            <th>Status</th>
            <th>Skills</th>
            <th>Experience</th>
            <th>Location</th>
            <th>Stage</th>
            <th>Profile</th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((candidate) => (
            <tr key={candidate.id}>
              <td>{candidate.name}</td>
              <td>{candidate.email || "N/A"}</td>
              <td>{candidate.phone || "N/A"}</td>
              <td>{candidate.current_company || "N/A"}</td>
              <td>{candidate.current_role || "N/A"}</td>
              <td>{candidate.open_to_work ? "Open to Work" : "Not Open"}</td>
              <td>{candidate.skills.join(", ")}</td>
              <td>{candidate.experience_years} yrs</td>
              <td>{candidate.location || "N/A"}</td>
              <td>
                <StageBadge stage={candidate.recruitment_stage} />
              </td>
              <td>
                <Link to={`/candidates/${candidate.id}`}>View</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default CandidateTable;
