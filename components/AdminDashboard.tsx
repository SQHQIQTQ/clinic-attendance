'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface AttendanceLog {
  id: string;
  staff_name: string;
  clock_in_time: string;
  clock_out_time: string | null;
  work_hours: number | null;
  status: string;
}

interface DailyAggregation {
  date: string;
  staff_name: string;
  totalHours: number;
  sessions: AttendanceLog[];
}

export default function AdminDashboard() {
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [aggregatedData, setAggregatedData] = useState<DailyAggregation[]>([]);
  const [loading, setLoading] = useState(true);

  const aggregateData = useCallback((data: AttendanceLog[]) => {
    const grouped: { [key: string]: DailyAggregation } = {};

    data.forEach((log) => {
      const date = new Date(log.clock_in_time).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
      const key = `${date}-${log.staff_name}`;

      if (!grouped[key]) {
        grouped[key] = {
          date,
          staff_name: log.staff_name,
          totalHours: 0,
          sessions: [],
        };
      }

      grouped[key].sessions.push(log);
      if (log.work_hours) {
        grouped[key].totalHours += parseFloat(log.work_hours.toString());
      }
    });

    const aggregated = Object.values(grouped).sort((a, b) => {
      return new Date(b.sessions[0].clock_in_time).getTime() -
             new Date(a.sessions[0].clock_in_time).getTime();
    });

    setAggregatedData(aggregated);
  }, []);

  const fetchAttendanceLogs = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('attendance_logs')
        .select('*')
        .order('clock_in_time', { ascending: false });

      if (error) throw error;

      setLogs(data || []);
      aggregateData(data || []);
    } catch (error) {
      console.error('Error fetching attendance logs:', error);
    } finally {
      setLoading(false);
    }
  }, [aggregateData]);

  useEffect(() => {
    fetchAttendanceLogs();

    const subscription = supabase
      .channel('attendance_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'attendance_logs' },
        () => {
          fetchAttendanceLogs();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchAttendanceLogs]);

  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Admin Dashboard</h1>
          <p className="text-gray-600">Monitor staff attendance and work hours</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-800 text-white">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Date</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Staff Name</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Sessions</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Total Daily Hours</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {aggregatedData.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      No attendance records found
                    </td>
                  </tr>
                ) : (
                  aggregatedData.map((item, index) => {
                    const isOvertime = item.totalHours > 8;
                    return (
                      <tr
                        key={index}
                        className={`hover:bg-gray-50 transition-colors ${
                          isOvertime ? 'bg-red-50' : ''
                        }`}
                      >
                        <td className="px-6 py-4 text-sm text-gray-700">{item.date}</td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          {item.staff_name}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          <div className="space-y-1">
                            {item.sessions.map((session) => (
                              <div key={session.id} className="text-xs">
                                <span className="font-medium">In:</span> {formatTime(session.clock_in_time)}
                                {' → '}
                                <span className="font-medium">Out:</span> {formatTime(session.clock_out_time)}
                                {session.work_hours && (
                                  <span className="ml-2 text-gray-500">
                                    ({parseFloat(session.work_hours.toString()).toFixed(2)}h)
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span
                            className={`font-bold ${
                              isOvertime ? 'text-red-600' : 'text-green-600'
                            }`}
                          >
                            {item.totalHours.toFixed(2)} hours
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {isOvertime ? (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              Overtime
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Normal
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Total Records</h3>
            <p className="text-3xl font-bold text-gray-800">{logs.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Active Sessions</h3>
            <p className="text-3xl font-bold text-green-600">
              {logs.filter((log) => log.status === 'working').length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Overtime Days</h3>
            <p className="text-3xl font-bold text-red-600">
              {aggregatedData.filter((item) => item.totalHours > 8).length}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
