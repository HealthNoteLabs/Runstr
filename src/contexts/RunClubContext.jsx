import { createContext, useContext, useState, useEffect } from 'react';
import PropTypes from 'prop-types';

const RunClubContext = createContext();

export const useRunClub = () => {
  const context = useContext(RunClubContext);
  if (!context) {
    throw new Error('useRunClub must be used within a RunClubProvider');
  }
  return context;
};

export const RunClubProvider = ({ children }) => {
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load clubs from localStorage on mount
  useEffect(() => {
    const loadClubs = () => {
      const storedClubs = localStorage.getItem('runClubs');
      if (storedClubs) {
        try {
          const parsedClubs = JSON.parse(storedClubs);
          setClubs(parsedClubs);
        } catch (error) {
          console.error('Error loading run clubs:', error);
        }
      }
      setLoading(false);
    };

    loadClubs();
  }, []);

  // Save clubs to localStorage whenever they change
  useEffect(() => {
    if (!loading) {
      localStorage.setItem('runClubs', JSON.stringify(clubs));
    }
  }, [clubs, loading]);

  const createClub = (name, managerId) => {
    const newClub = {
      id: crypto.randomUUID(),
      name,
      managerId,
      memberIds: [managerId], // Manager is automatically a member
      createdAt: new Date().toISOString(),
      monthlyFee: 2000,
      managerFee: 20000
    };

    setClubs(prevClubs => [...prevClubs, newClub]);
    return newClub;
  };

  const joinClub = (clubId, userId) => {
    setClubs(prevClubs => 
      prevClubs.map(club => {
        if (club.id === clubId && !club.memberIds.includes(userId)) {
          return {
            ...club,
            memberIds: [...club.memberIds, userId]
          };
        }
        return club;
      })
    );
  };

  const getClubById = (clubId) => {
    return clubs.find(club => club.id === clubId);
  };

  const getUserClubs = (userId) => {
    return clubs.filter(club => 
      club.memberIds.includes(userId) || club.managerId === userId
    );
  };

  const value = {
    clubs,
    loading,
    createClub,
    joinClub,
    getClubById,
    getUserClubs
  };

  return (
    <RunClubContext.Provider value={value}>
      {children}
    </RunClubContext.Provider>
  );
};

RunClubProvider.propTypes = {
  children: PropTypes.node.isRequired
}; 