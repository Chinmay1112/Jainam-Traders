import React from 'react';
import AdminDashboard from './admin-dashboard';

export const metadata = {
  title: 'Admin Management Portal | Jainam Traders',
  description: 'Manage store orders, inventory reservations, verified customer reviews, and shop settings.',
};

export default function AdminPage() {
  return <AdminDashboard />;
}
