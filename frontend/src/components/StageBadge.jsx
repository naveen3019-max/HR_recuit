const stageClass = {
  Applied: "badge-applied",
  Screening: "badge-screening",
  Interview: "badge-interview",
  Offer: "badge-offer",
  Hired: "badge-hired",
  Rejected: "badge-rejected"
};

const StageBadge = ({ stage }) => {
  return <span className={`stage-badge ${stageClass[stage] || ""}`}>{stage}</span>;
};

export default StageBadge;
