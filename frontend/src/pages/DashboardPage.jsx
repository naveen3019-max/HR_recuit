const DashboardPage = ({ candidates }) => {
  const totals = {
    total: candidates.length,
    screening: candidates.filter((c) => c.recruitment_stage === "Screening").length,
    interview: candidates.filter((c) => c.recruitment_stage === "Interview").length,
    hired: candidates.filter((c) => c.recruitment_stage === "Hired").length
  };

  return (
    <section>
      <h2>Recruitment Dashboard</h2>
      <div className="stats-grid">
        <div className="panel stat-card">
          <p className="muted">Total Candidates</p>
          <h3>{totals.total}</h3>
        </div>
        <div className="panel stat-card">
          <p className="muted">In Screening</p>
          <h3>{totals.screening}</h3>
        </div>
        <div className="panel stat-card">
          <p className="muted">Interviews</p>
          <h3>{totals.interview}</h3>
        </div>
        <div className="panel stat-card">
          <p className="muted">Hired</p>
          <h3>{totals.hired}</h3>
        </div>
      </div>
    </section>
  );
};

export default DashboardPage;
