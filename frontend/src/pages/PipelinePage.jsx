import StageBadge from "../components/StageBadge";

const stages = ["Applied", "Screening", "Interview", "Offer", "Hired", "Rejected"];

const PipelinePage = ({ candidates, onStageChange }) => {
  return (
    <section>
      <h2>Recruitment Pipeline</h2>
      <div className="pipeline-grid">
        {stages.map((stage) => (
          <div className="panel pipeline-column" key={stage}>
            <div className="pipeline-title-row">
              <h3>{stage}</h3>
              <StageBadge stage={stage} />
            </div>
            {candidates
              .filter((candidate) => candidate.recruitment_stage === stage)
              .map((candidate) => (
                <div className="pipeline-card" key={candidate.id}>
                  <p className="pipeline-name">{candidate.name}</p>
                  <p className="muted small">{candidate.skills.join(", ")}</p>
                  <select
                    className="input"
                    value={candidate.recruitment_stage}
                    onChange={(event) => onStageChange(candidate.id, event.target.value)}
                  >
                    {stages.map((nextStage) => (
                      <option value={nextStage} key={nextStage}>
                        {nextStage}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
          </div>
        ))}
      </div>
    </section>
  );
};

export default PipelinePage;
