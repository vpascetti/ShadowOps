import '../styles/SectionNavBar.css';

export default function SectionNavBar({ sections }) {
  const handleScroll = (ref) => {
    if (ref && ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <nav className="section-nav-bar">
      <div className="section-nav-container">
        {sections.map((section) => (
          <button
            key={section.label}
            className="section-nav-button"
            onClick={() => handleScroll(section.ref)}
          >
            {section.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
