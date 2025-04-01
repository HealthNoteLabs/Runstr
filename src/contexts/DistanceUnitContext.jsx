import { createContext, useContext, useState, useEffect } from 'react';
import PropTypes from 'prop-types';

const DistanceUnitContext = createContext();

export const DistanceUnitProvider = ({ children }) => {
  const [distanceUnit, setDistanceUnit] = useState(
    () => localStorage.getItem('distanceUnit') || 'km'
  );

  useEffect(() => {
    localStorage.setItem('distanceUnit', distanceUnit);
  }, [distanceUnit]);

  const toggleDistanceUnit = () => {
    setDistanceUnit(prev => prev === 'km' ? 'mi' : 'km');
  };

  return (
    <DistanceUnitContext.Provider value={{ distanceUnit, toggleDistanceUnit }}>
      {children}
    </DistanceUnitContext.Provider>
  );
};

DistanceUnitProvider.propTypes = {
  children: PropTypes.node.isRequired
};

export const useDistanceUnit = () => {
  const context = useContext(DistanceUnitContext);
  if (!context) {
    throw new Error('useDistanceUnit must be used within a DistanceUnitProvider');
  }
  return context;
}; 