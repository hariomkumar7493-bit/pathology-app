import { useState, useEffect } from 'react';
import { 
  Users, 
  FileText, 
  CheckCircle,
  Clock,
} from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../api';

const COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getDashboard().then(setStats).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div></div>;
  if (!stats) return <div className="text-center py-12 text-gray-500">Failed to load dashboard data. Make sure the server is running.</div>;

  const statCards = [
    { label: 'Total Patients', value: stats.totalPatients, icon: Users, color: 'bg-blue-500' },
    { label: "Today's Tests", value: stats.todayTests, icon: FileText, color: 'bg-green-500' },
    { label: 'Pending Reports', value: stats.pendingReports, icon: Clock, color: 'bg-orange-500' },
    { label: 'Completed Reports', value: stats.completedReports, icon: CheckCircle, color: 'bg-purple-500' },
  ];

  const pieData = (stats.categoryStats || []).map((c, i) => ({
    name: c.name,
    value: c.count,
    color: COLORS[i % COLORS.length],
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Overview of your laboratory performance</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => (
          <div key={index} className="card hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-500">{stat.label}</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
              </div>
              <div className={`${stat.color} p-2 sm:p-3 rounded-lg`}>
                <stat.icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Test Categories */}
        {pieData.length > 0 && (
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">Tests by Category</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" nameKey="name">
                  {pieData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 mt-2">
              {pieData.map((cat, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }}></div>
                    <span className="text-gray-600">{cat.name}</span>
                  </div>
                  <span className="font-medium text-gray-900">{cat.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Reports */}
        <div className={`card ${pieData.length > 0 ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Recent Reports</h3>
            <Clock className="w-5 h-5 text-gray-400" />
          </div>
          <div className="space-y-3">
            {(stats.recentReports || []).map((report) => (
              <div key={report.id} className="flex items-center gap-3 sm:gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  report.status === 'Completed' ? 'bg-green-100' : 'bg-yellow-100'
                }`}>
                  {report.status === 'Completed' ? (
                    <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                  ) : (
                    <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{report.patient_name}</p>
                  <p className="text-xs text-gray-500 truncate">{report.investigation || 'N/A'}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                    report.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>{report.status}</span>
                  <p className="text-xs text-gray-400 mt-1 hidden sm:block">Ref: {report.ref_no}</p>
                </div>
              </div>
            ))}
            {(!stats.recentReports || stats.recentReports.length === 0) && (
              <p className="text-sm text-gray-400 text-center py-6">No reports yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
