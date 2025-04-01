import { createContext, useContext, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useRunClub } from './RunClubContext';

const EventContext = createContext();

export const useEvent = () => {
  const context = useContext(EventContext);
  if (!context) {
    throw new Error('useEvent must be used within an EventProvider');
  }
  return context;
};

export const EventProvider = ({ children }) => {
  const { getClubById } = useRunClub();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load events from localStorage on mount
  useEffect(() => {
    const loadEvents = () => {
      const storedEvents = localStorage.getItem('clubEvents');
      if (storedEvents) {
        try {
          const parsedEvents = JSON.parse(storedEvents);
          setEvents(parsedEvents);
        } catch (error) {
          console.error('Error loading club events:', error);
        }
      }
      setLoading(false);
    };

    loadEvents();
  }, []);

  // Save events to localStorage whenever they change
  useEffect(() => {
    if (!loading) {
      localStorage.setItem('clubEvents', JSON.stringify(events));
    }
  }, [events, loading]);

  const createEvent = (clubId, managerId, name, description, startTime, endTime, distance) => {
    const club = getClubById(clubId);
    if (!club || club.managerId !== managerId) return null;

    const newEvent = {
      id: crypto.randomUUID(),
      clubId,
      name,
      description,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      distance,
      createdBy: managerId,
      leaderboard: []
    };

    setEvents(prevEvents => [...prevEvents, newEvent]);
    return newEvent;
  };

  const getClubEvents = (clubId) => {
    return events.filter(event => event.clubId === clubId);
  };

  const getActiveEvent = (clubId) => {
    const now = new Date();
    return events.find(event => 
      event.clubId === clubId && 
      new Date(event.startTime) <= now && 
      new Date(event.endTime) >= now
    );
  };

  const submitEventResult = (eventId, userId, userName, distance, time) => {
    const event = events.find(e => e.id === eventId);
    if (!event) return null;

    const now = new Date();
    if (now < new Date(event.startTime) || now > new Date(event.endTime)) {
      return null;
    }

    const entry = {
      userId,
      userName,
      distance,
      time,
      pace: time / distance, // time per km
      submittedAt: now.toISOString()
    };

    setEvents(prevEvents =>
      prevEvents.map(e => {
        if (e.id === eventId) {
          return {
            ...e,
            leaderboard: [...e.leaderboard, entry]
          };
        }
        return e;
      })
    );

    return entry;
  };

  const getEventLeaderboard = (eventId) => {
    const event = events.find(e => e.id === eventId);
    if (!event) return [];

    return [...event.leaderboard].sort((a, b) => {
      if (b.distance !== a.distance) return b.distance - a.distance;
      return a.pace - b.pace; // lower pace is better
    });
  };

  const value = {
    events,
    loading,
    createEvent,
    getClubEvents,
    getActiveEvent,
    submitEventResult,
    getEventLeaderboard
  };

  return (
    <EventContext.Provider value={value}>
      {children}
    </EventContext.Provider>
  );
};

EventProvider.propTypes = {
  children: PropTypes.node.isRequired
}; 