/*
  # Create Attendance Logs Table

  1. New Tables
    - `attendance_logs`
      - `id` (uuid, primary key) - Unique identifier for each attendance record
      - `staff_name` (text) - Name of the staff member
      - `clock_in_time` (timestamptz) - Timestamp when staff clocked in
      - `clock_out_time` (timestamptz, nullable) - Timestamp when staff clocked out
      - `work_hours` (numeric, nullable) - Total hours worked (calculated on clock out)
      - `status` (text) - Current status of the attendance record (working/completed)
      - `created_at` (timestamptz) - Record creation timestamp

  2. Security
    - Enable RLS on `attendance_logs` table
    - Add policy for public read access (for admin dashboard)
    - Add policy for public insert/update access (for clock in/out)
    
  Note: This is a clinic attendance system, so we allow public access for simplicity.
  In a production environment, you would add proper authentication and restrict access.
*/

CREATE TABLE IF NOT EXISTS attendance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_name text NOT NULL,
  clock_in_time timestamptz NOT NULL DEFAULT now(),
  clock_out_time timestamptz,
  work_hours numeric,
  status text NOT NULL DEFAULT 'working',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access"
  ON attendance_logs
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access"
  ON attendance_logs
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access"
  ON attendance_logs
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_attendance_staff_name ON attendance_logs(staff_name);
CREATE INDEX IF NOT EXISTS idx_attendance_clock_in_time ON attendance_logs(clock_in_time);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance_logs(status);
