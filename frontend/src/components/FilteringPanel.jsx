const FilteringPanel = ({ filters, onFiltersChange }) => {
  const updateFilter = (key, value) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  return (
    <div className="panel filter-panel">
      <h3>Filters</h3>
      <input
        className="input"
        placeholder="Skills (comma-separated)"
        value={filters.skills}
        onChange={(event) => updateFilter("skills", event.target.value)}
      />
      <input
        className="input"
        type="number"
        placeholder="Min experience"
        value={filters.experienceMin}
        onChange={(event) => updateFilter("experienceMin", event.target.value)}
      />
      <input
        className="input"
        type="number"
        placeholder="Max experience"
        value={filters.experienceMax}
        onChange={(event) => updateFilter("experienceMax", event.target.value)}
      />
      <input
        className="input"
        placeholder="Location"
        value={filters.location}
        onChange={(event) => updateFilter("location", event.target.value)}
      />
      <input
        className="input"
        placeholder="Email"
        value={filters.email}
        onChange={(event) => updateFilter("email", event.target.value)}
      />
      <input
        className="input"
        placeholder="LinkedIn URL"
        value={filters.linkedin}
        onChange={(event) => updateFilter("linkedin", event.target.value)}
      />
      <select
        className="input"
        value={filters.stage}
        onChange={(event) => updateFilter("stage", event.target.value)}
      >
        <option value="">All stages</option>
        <option value="Applied">Applied</option>
        <option value="Screening">Screening</option>
        <option value="Interview">Interview</option>
        <option value="Offer">Offer</option>
        <option value="Hired">Hired</option>
        <option value="Rejected">Rejected</option>
      </select>
    </div>
  );
};

export default FilteringPanel;
