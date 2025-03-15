import { useState } from 'react';
import { Link } from 'react-router-dom';

export const MenuBar = () => {
  const [isOpen, setIsOpen] = useState(false);

  const menuItems = [
    { name: 'DASHBOARD', path: '/' },
    { name: 'STATS', path: '/history' },
    //{ name: 'GOALS', path: '/goals' },
    { name: 'RUNSTR FEED', path: '/club' },
    //{ name: 'RUN CLUB', path: '/team' },
    //{ name: 'COMPETITIONS', path: '/events' },
    { name: 'WAVLAKE', path: '/music' },
    { name: 'WALLET', path: '/nwc' }
  ];

  const toggleMenu = () => {
    setIsOpen(!isOpen);
    // Prevent body scrolling when menu is open
    document.body.style.overflow = isOpen ? 'auto' : 'hidden';
  };

  // Ensure body scrolling is restored when component unmounts
  const closeMenu = () => {
    setIsOpen(false);
    document.body.style.overflow = 'auto';
  };

  return (
    <header className="menu-header">
      <h1 className="app-title">RUNSTR</h1>

      <button
        className="hamburger-menu"
        onClick={toggleMenu}
        aria-label="Toggle menu"
      >
        <span></span>
        <span></span>
        <span></span>
      </button>

      <nav className={`sidebar-nav ${isOpen ? 'open' : ''}`}>
        <ul className="menu-list">
          {menuItems.map((item) => (
            <li key={item.name} className="menu-item">
              <Link to={item.path} onClick={closeMenu}>
                {item.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {isOpen && <div className="overlay" onClick={closeMenu}></div>}
    </header>
  );
};
