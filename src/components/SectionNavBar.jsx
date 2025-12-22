import '../styles/SectionNavBar.css';

export default function SectionNavBar({ sections, activeLabel }) {
  const handleScroll = (ref) => {
    if (ref && ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <nav className="section-nav-bar" aria-label="Section navigation">
      <div className="section-nav-container">
        {sections.map((section) => (
          <button
            key={section.label}
            type="button"
            aria-current={activeLabel === section.label ? 'true' : undefined}
            className={`section-nav-button ${activeLabel === section.label ? 'active' : ''}`}
            onClick={() => handleScroll(section.ref)}
          >
            {section.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
