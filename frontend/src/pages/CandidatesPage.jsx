import CandidateTable from "../components/CandidateTable";
import FilteringPanel from "../components/FilteringPanel";
import SearchBar from "../components/SearchBar";

const CandidatesPage = ({ candidates, filters, setFilters, search, setSearch }) => {
  return (
    <section className="candidates-layout">
      <div className="candidates-main">
        <div className="section-header">
          <h2>Candidates</h2>
          <SearchBar value={search} onChange={setSearch} />
        </div>
        <CandidateTable candidates={candidates} />
      </div>
      <FilteringPanel filters={filters} onFiltersChange={setFilters} />
    </section>
  );
};

export default CandidatesPage;
