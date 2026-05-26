import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from '@/widgets/app-layout';
import Home from '@/pages/Home';
import Tournament from '@/pages/Tournament';
import Player from '@/pages/Player';
import Team from '@/pages/Team';
import SoloPlayer from '@/pages/SoloPlayer';
import Schedule from '@/pages/Schedule';
import FeedPage from '@/pages/FeedPage';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import SteamAuthCallback from '@/pages/SteamAuthCallback';
import CreateTournament from '@/pages/CreateTournament';
import Settings from '@/pages/Settings';
import Finance from '@/pages/Finance';
import AdminStudio from '@/pages/AdminStudio';
import AdminStudioGuard from '@/components/AdminStudioGuard';
import AdminFinance from '@/pages/AdminFinance';
import DnaLab from '@/pages/DnaLab';
import DnaMapRedirect from '@/pages/DnaMapRedirect';
import Ladder from '@/pages/Ladder';

export default function AppRouter() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<Home />} />
        <Route path="/feed" element={<FeedPage />} />
        <Route path="/dna-lab" element={<DnaLab />} />
        <Route path="/dna-map" element={<DnaMapRedirect />} />
        <Route path="/ladder" element={<Ladder />} />
        <Route path="/tournament/:id" element={<Tournament />} />
        <Route path="/tournament/:id/edit" element={<CreateTournament />} />
        <Route path="/tournament/:tournamentId/team/:teamName" element={<Team />} />
        <Route path="/tournament/:tournamentId/solo/:playerName" element={<SoloPlayer />} />
        <Route path="/player/:name" element={<Player />} />
        <Route path="/schedule" element={<Schedule />} />
        <Route path="/tournaments" element={<Schedule />} />
        <Route path="/admin/studio" element={<AdminStudioGuard><AdminStudio /></AdminStudioGuard>} />
        <Route path="/admin/finance" element={<AdminFinance />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/auth/steam" element={<SteamAuthCallback />} />
        <Route path="/create-tournament" element={<CreateTournament />} />
        <Route path="/create" element={<CreateTournament />} />
        <Route path="/finance" element={<Finance />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}
