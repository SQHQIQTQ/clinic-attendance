'use client';

import { useState } from 'react';
import StaffClockIn from '@/components/StaffClockIn';
import AdminDashboard from '@/components/AdminDashboard';

export default function Home() {
  const [view, setView] = useState<'staff' | 'admin'>('staff');

  return (
    <div className="relative">
      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={() => setView(view === 'staff' ? 'admin' : 'staff')}
          className="bg-white hover:bg-gray-50 text-gray-800 font-semibold py-3 px-6 rounded-lg shadow-lg transition-all transform hover:scale-105 border border-gray-200"
        >
          {view === 'staff' ? 'View Admin Dashboard' : 'Back to Clock In'}
        </button>
      </div>

      {view === 'staff' ? <StaffClockIn /> : <AdminDashboard />}
    </div>
  );
}
