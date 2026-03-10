const SearchBar = ({ value, onChange }) => {
  return (
    <input
      type="search"
      className="input"
      placeholder="Search by name, email, or LinkedIn URL"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
};

export default SearchBar;
