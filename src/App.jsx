import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import LiveDispatch from "./pages/LiveDispatch";
import DriverManagement from "./pages/DriverManagement";
import AutomatedBookings from "./pages/AutomatedBookings";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="dispatch" element={<LiveDispatch />} />
          <Route path="drivers" element={<DriverManagement />} />
          <Route path="bookings" element={<AutomatedBookings />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
