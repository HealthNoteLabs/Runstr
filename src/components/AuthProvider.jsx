import { useState } from 'react';
import { AuthContext } from '../contexts/AuthContext.jsx';
import PropTypes from 'prop-types';

export const AuthProvider = ({ children }) => {
  const [profile, setProfile] = useState(() => {
    const stored = localStorage.getItem('nostrProfile');
    return stored ? JSON.parse(stored) : null;
  });

  const [wallet, setWallet] = useState(null);

  return (
    <AuthContext.Provider
      value={{
        profile,
        setProfile,
        wallet,
        setWallet
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired
};
