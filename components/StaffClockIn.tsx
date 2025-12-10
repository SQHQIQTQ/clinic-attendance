'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

const staffMembers = [
  'Dr. Smith',
  'Dr. Johnson',
  'Nurse Sarah',
  'Nurse Mike',
  'Receptionist Lisa',
];

export default function StaffClockIn() {
  const [selectedStaff, setSelectedStaff] = useState('');
  const [isWorking, setIsWorking] = useState(false);
  const [clockInTime, setClockInTime] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  const checkActiveSession = async (staffName: string) => {
    if (!staffName) return;

    try {
      const { data, error } = await supabase
        .from('attendance_logs')
        .select('*')
        .eq('staff_name', staffName)
        .is('clock_out_time', null)
        .order('clock_in_time', { ascending: false })
        .maybeSingle();

      if (error) throw error;
      setIsWorking(!!data);
      setClockInTime(data ? data.clock_in_time : null);
    } catch (error) {
      console.error('Error checking active session:', error);
    }
  };

  useEffect(() => {
    if (selectedStaff) {
      checkActiveSession(selectedStaff);
    }
  }, [selectedStaff]);

  const handleClockIn = async () => {
    if (!selectedStaff) {
      showToast('Please select a staff member', 'error');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('attendance_logs')
        .insert({
          staff_name: selectedStaff,
          clock_in_time: new Date().toISOString(),
          status: 'working',
        });

      if (error) throw error;

      setIsWorking(true);
      setClockInTime(new Date().toISOString());
      showToast(`${selectedStaff} clocked in successfully!`);
    } catch (error) {
      console.error('Error clocking in:', error);
      showToast('Failed to clock in. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!selectedStaff) {
      showToast('Please select a staff member', 'error');
      return;
    }

    setLoading(true);
    try {
      const { data: activeSession, error: fetchError } = await supabase
        .from('attendance_logs')
        .select('*')
        .eq('staff_name', selectedStaff)
        .is('clock_out_time', null)
        .order('clock_in_time', { ascending: false })
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!activeSession) {
        showToast('No active session found', 'error');
        return;
      }

      const clockOutTime = new Date();
      const clockInTime = new Date(activeSession.clock_in_time);
      const workHours = (clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);

      const { error: updateError } = await supabase
        .from('attendance_logs')
        .update({
          clock_out_time: clockOutTime.toISOString(),
          work_hours: workHours.toFixed(2),
          status: 'completed',
        })
        .eq('id', activeSession.id);

      if (updateError) throw updateError;

      setIsWorking(false);
      setClockInTime(null);
      showToast(`${selectedStaff} clocked out successfully! Work hours: ${workHours.toFixed(2)}h`);
    } catch (error) {
      console.error('Error clocking out:', error);
      showToast('Failed to clock out. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2 text-center">
            Clinic Attendance
          </h1>
          <p className="text-gray-500 text-center mb-8">Track your work hours</p>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Staff Member
            </label>
            <select
              value={selectedStaff}
              onChange={(e) => setSelectedStaff(e.target.value)}
              className="w-full px-4 py-3 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-medium"
              disabled={loading}
            >
              <option value="" className="text-gray-500">Choose staff...</option>
              {staffMembers.map((staff) => (
                <option key={staff} value={staff} className="text-gray-900">
                  {staff}
                </option>
              ))}
            </select>
          </div>

          {selectedStaff && (
            <div className="space-y-4">
              {!isWorking ? (
                <button
                  onClick={handleClockIn}
                  disabled={loading}
                  className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 px-6 rounded-lg transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                  {loading ? 'Processing...' : 'CLOCK IN'}
                </button>
              ) : (
                <button
                  onClick={handleClockOut}
                  disabled={loading}
                  className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-4 px-6 rounded-lg transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                  {loading ? 'Processing...' : 'CLOCK OUT'}
                </button>
              )}

              <div className="mt-6">
                {isWorking && clockInTime ? (
                  <div className="inline-flex items-center justify-center w-full px-4 py-3 bg-green-100 text-green-800 rounded-lg border border-green-300 font-semibold text-lg">
                    <div className="flex flex-col items-center">
                      <span className="text-sm text-green-700 font-normal mb-1">Working since</span>
                      <span className="text-xl font-bold">{new Date(clockInTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                ) : (
                  <div className="inline-flex items-center justify-center w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-lg border border-gray-300 font-semibold text-lg">
                    <span className="text-center">Ready to clock in</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {toast.show && (
        <div className="fixed bottom-6 right-6 animate-slide-up">
          <div className={`px-6 py-4 rounded-lg shadow-lg ${
            toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
          } text-white font-medium`}>
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}
