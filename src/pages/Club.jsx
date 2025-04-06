import { Routes, Route } from 'react-router-dom';
import { ClubsList } from '../components/Clubs/ClubsList';
import { ClubCreate } from '../components/Clubs/ClubCreate';
import { ClubDetail } from '../components/Clubs/ClubDetail';

export const Club = () => {
  return (
    <div className="club-page">
      <Routes>
        <Route path="/" element={<ClubsList />} />
        <Route path="/create" element={<ClubCreate />} />
        <Route path="/detail/:clubId" element={<ClubDetail />} />
      </Routes>
    </div>
  );
}; 