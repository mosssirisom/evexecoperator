import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import ErrorBoundary from "./components/ErrorBoundary";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
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
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Layout />}>
            <Route index element={<ErrorBoundary key="dashboard"><Dashboard /></ErrorBoundary>} />
            <Route path="dispatch" element={<ErrorBoundary key="dispatch"><LiveDispatch /></ErrorBoundary>} />
            <Route path="drivers" element={<ErrorBoundary key="drivers"><DriverManagement /></ErrorBoundary>} />
            <Route path="bookings" element={<ErrorBoundary key="bookings"><AutomatedBookings /></ErrorBoundary>} />
            <Route path="analytics" element={<ErrorBoundary key="analytics"><Analytics /></ErrorBoundary>} />
            <Route path="settings" element={<ErrorBoundary key="settings"><Settings /></ErrorBoundary>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
