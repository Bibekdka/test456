/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Project, DelayWeatherLog } from '../types';
import { CloudSun, CloudRain, Thermometer, Timer, AlertTriangle, Activity, Calendar, ListFilter, CheckCircle2, Trash2, Plus, Sun, Cloud, Snowflake, Flame, Zap, Compass, RefreshCw, Pencil } from 'lucide-react';

interface DelayWeatherTrackerProps {
  activeProject: Project | null;
  delayWeatherLogs: DelayWeatherLog[];
  onAddDelayWeatherLog: (log: DelayWeatherLog) => void;
  onUpdateDelayWeatherLog: (log: DelayWeatherLog) => void;
  onDeleteDelayWeatherLog: (id: string) => void;
  onFetchWeather?: (p: Project) => Promise<void>;
  isWeatherFetching?: boolean;
}

export default function DelayWeatherTracker({
  activeProject,
  delayWeatherLogs,
  onAddDelayWeatherLog,
  onUpdateDelayWeatherLog,
  onDeleteDelayWeatherLog,
  onFetchWeather,
  isWeatherFetching = false,
}: DelayWeatherTrackerProps) {
  const [showForm, setShowForm] = useState(false);
  const [filterDelayOnly, setFilterDelayOnly] = useState(false);
  const [weatherFilter, setWeatherFilter] = useState<string>('all');
  const [editingLog, setEditingLog] = useState<DelayWeatherLog | null>(null);

  // Form State
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [weather, setWeather] = useState<'sunny' | 'cloudy' | 'rainy' | 'stormy' | 'extreme_heat' | 'cold'>('sunny');
  const [temperature, setTemperature] = useState('25');
  const [isDelay, setIsDelay] = useState(false);
  const [delayHours, setDelayHours] = useState('');
  const [delayReason, setDelayReason] = useState<'none' | 'rain' | 'labour_shortage' | 'material_delay' | 'power_cut' | 'machinery_breakdown' | 'other'>('rain');
  const [delayNotes, setDelayNotes] = useState('');

  if (!activeProject) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-3">
        <div className="bg-slate-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto text-slate-500">
          <CloudSun className="w-6 h-6" />
        </div>
        <h3 className="font-semibold text-slate-700">No Construction Site Selected</h3>
        <p className="text-slate-400 text-sm max-w-sm mx-auto">
          Please select or create an active project site in the <strong>Projects</strong> tab to view delays and weather logs.
        </p>
      </div>
    );
  }

  // Filter logs for selected project
  const projectLogs = delayWeatherLogs
    .filter(l => l.projectId === activeProject.id)
    .sort((a, b) => b.date.localeCompare(a.date));

  const handleEditClick = (log: DelayWeatherLog) => {
    setEditingLog(log);
    setDate(log.date);
    setWeather(log.weather);
    setTemperature(log.temperature || '25');
    setIsDelay(log.isDelay);
    setDelayHours(log.delayHours !== undefined ? log.delayHours.toString() : '');
    setDelayReason(log.delayReason || 'rain');
    setDelayNotes(log.delayNotes || '');
    setShowForm(true);
    document.getElementById('delay-tracker-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingLog) {
      const updatedLog: DelayWeatherLog = {
        ...editingLog,
        date,
        weather,
        temperature: temperature ? temperature : undefined,
        isDelay,
        delayHours: isDelay && delayHours ? Number(delayHours) : undefined,
        delayReason: isDelay ? delayReason : undefined,
        delayNotes: isDelay && delayNotes ? delayNotes : undefined,
      };
      onUpdateDelayWeatherLog(updatedLog);
    } else {
      const newLog: DelayWeatherLog = {
        id: 'dw_' + Math.random().toString(36).substr(2, 9),
        projectId: activeProject.id,
        date,
        weather,
        temperature: temperature ? temperature : undefined,
        isDelay,
        delayHours: isDelay && delayHours ? Number(delayHours) : undefined,
        delayReason: isDelay ? delayReason : undefined,
        delayNotes: isDelay && delayNotes ? delayNotes : undefined,
      };
      onAddDelayWeatherLog(newLog);
    }

    setShowForm(false);
    resetForm();
  };

  const resetForm = () => {
    setDate(new Date().toISOString().split('T')[0]);
    setWeather('sunny');
    setTemperature('25');
    setIsDelay(false);
    setDelayHours('');
    setDelayReason('rain');
    setDelayNotes('');
    setEditingLog(null);
  };

  // Weather Icon and Color Maps
  const weatherIcons: Record<string, React.ReactNode> = {
    sunny: <Sun className="w-5 h-5 text-amber-500" />,
    cloudy: <Cloud className="w-5 h-5 text-slate-400" />,
    rainy: <CloudRain className="w-5 h-5 text-indigo-500" />,
    stormy: <CloudRain className="w-5 h-5 text-indigo-700 animate-bounce" />,
    extreme_heat: <Flame className="w-5 h-5 text-rose-500 animate-pulse" />,
    cold: <Snowflake className="w-5 h-5 text-sky-400" />,
  };

  const weatherLabels: Record<string, string> = {
    sunny: 'Sunny Weather',
    cloudy: 'Overcast / Cloudy',
    rainy: 'Monsoon Rain / Showers',
    stormy: 'Severe Storms',
    extreme_heat: 'Extreme Dry Heat',
    cold: 'Freezing / Winter Cold',
  };

  const reasonLabels: Record<string, string> = {
    none: 'Smooth Progress / No Disruption',
    rain: 'Heavy Rains / Wet Soil / Storms',
    labour_shortage: 'Worker Attendance Deficit / Strikes',
    material_delay: 'Supply Chain / Delayed Transport',
    power_cut: 'Electricity Cut / Grid Blackout',
    machinery_breakdown: 'Concrete Mixer / Plant Failure',
    other: 'Other Administrative / Local Hurdles',
  };

  // Calculations for Widgets
  const totalDays = projectLogs.length;
  const totalDisruptions = projectLogs.filter(l => l.isDelay).length;
  const totalDelayHours = projectLogs.reduce((sum, l) => sum + (l.delayHours || 0), 0);
  
  // Frequency list of delay reasons
  const delayStats: Record<string, number> = {};
  projectLogs.forEach(l => {
    if (l.isDelay && l.delayReason) {
      delayStats[l.delayReason] = (delayStats[l.delayReason] || 0) + 1;
    }
  });

  const leadingDisruption = Object.entries(delayStats).sort((a, b) => b[1] - a[1])[0]?.[0] || 'None';

  // Apply filters
  const filteredLogs = projectLogs.filter(l => {
    if (filterDelayOnly && !l.isDelay) return false;
    if (weatherFilter !== 'all' && l.weather !== weatherFilter) return false;
    return true;
  });

  return (
    <div id="delay-tracker-section" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-800">Site Delay & Weather Tracker</h2>
          <p className="text-slate-500 text-sm">
            Site: <strong className="text-slate-700">{activeProject.name}</strong> {activeProject.location && <span>({activeProject.location})</span>} • Track daily climate conditions, evaluate project downtime reasons, and justify contractor liquid damages timeline claims.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {activeProject.location && onFetchWeather && (
            <button
              onClick={() => onFetchWeather(activeProject)}
              disabled={isWeatherFetching}
              className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 px-4 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer disabled:opacity-50"
              title="Auto-fetch and sync climate data from the project's start date to today"
            >
              <RefreshCw className={`w-4 h-4 ${isWeatherFetching ? 'animate-spin' : ''}`} />
              <span>{isWeatherFetching ? 'Syncing Weather...' : 'Sync Online Weather'}</span>
            </button>
          )}
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer shadow-sm shrink-0"
          >
            <Plus className="w-4 h-4" />
            {showForm ? 'Close Entry Form' : 'Log Daily Climate & Delay'}
          </button>
        </div>
      </div>

      {!activeProject.location && (
        <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider">Historical Weather Sync Disabled</h4>
            <p className="text-slate-600 text-xs leading-relaxed">
              To automatically fetch historical weather and temperature data from the day work started (<strong>{activeProject.startDate}</strong>), click <strong className="text-slate-800">Edit Project</strong> in the Projects tab and specify a site city/town location (e.g., "Guwahati, Assam").
            </p>
          </div>
        </div>
      )}

      {/* Analytics widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center gap-3">
          <div className="p-2.5 bg-slate-900 text-white rounded-lg shrink-0">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <p className="text-slate-400 font-semibold text-[10px] uppercase tracking-wider">Days Logged</p>
            <p className="text-lg font-bold text-slate-800 mt-0.5">{totalDays} Workdays</p>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center gap-3">
          <div className="p-2.5 bg-slate-900 text-white rounded-lg shrink-0">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <p className="text-slate-400 font-semibold text-[10px] uppercase tracking-wider">Disruption Days</p>
            <p className="text-lg font-bold text-slate-800 mt-0.5">{totalDisruptions} Days Delay</p>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center gap-3">
          <div className="p-2.5 bg-slate-900 text-white rounded-lg shrink-0">
            <Timer className="w-4 h-4 text-rose-500 animate-pulse" />
          </div>
          <div>
            <p className="text-slate-400 font-semibold text-[10px] uppercase tracking-wider">Downtime Sum</p>
            <p className="text-lg font-bold text-slate-800 mt-0.5">{totalDelayHours} Man-Hours</p>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center gap-3">
          <div className="p-2.5 bg-slate-900 text-white rounded-lg shrink-0">
            <Activity className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <p className="text-slate-400 font-semibold text-[10px] uppercase tracking-wider">Major Disruption Catalyst</p>
            <p className="text-xs font-bold text-slate-800 mt-0.5 capitalize truncate" title={leadingDisruption}>
              {leadingDisruption === 'None' ? 'No delays recorded' : reasonLabels[leadingDisruption] || leadingDisruption}
            </p>
          </div>
        </div>
      </div>

      {/* Form Log Panel */}
      {showForm && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <h3 className="font-semibold text-slate-800 border-b border-slate-100 pb-2">
            {editingLog ? 'Edit Weather & Disruption Record' : 'Record Weather & Disruption Warnings'}
          </h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Select Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono text-slate-700 bg-white"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Weather Condition</label>
              <select
                value={weather}
                onChange={(e) => setWeather(e.target.value as any)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
              >
                <option value="sunny">☀️ Sunny / Clear Skies</option>
                <option value="cloudy">☁️ Overcast / Cloudy</option>
                <option value="rainy">🌧️ Rainy / Showers</option>
                <option value="stormy">⛈️ Stormy / High Winds</option>
                <option value="extreme_heat">🥵 Extreme Summer Heat</option>
                <option value="cold">❄️ Freezing Winter Cold</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Approx Temperature (°C)</label>
              <div className="relative">
                <span className="absolute right-3 top-2 text-slate-400 text-sm font-mono">°C</span>
                <input
                  type="number"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                  placeholder="e.g. 26"
                  className="w-full border border-slate-200 rounded-lg pl-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono text-slate-700"
                />
              </div>
            </div>

            <div className="md:col-span-3 border-t border-slate-100 pt-3 flex items-center gap-2.5">
              <input
                type="checkbox"
                id="is-disruption"
                checked={isDelay}
                onChange={(e) => setIsDelay(e.target.checked)}
                className="w-4 h-4 text-slate-900 border-slate-300 rounded focus:ring-slate-900"
              />
              <label htmlFor="is-disruption" className="text-sm font-semibold text-slate-700 cursor-pointer select-none">
                Did any site delay, strike, or work disruption occur on this date?
              </label>
            </div>

            {isDelay && (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Downtime Duration (Hours)</label>
                  <input
                    type="number"
                    value={delayHours}
                    onChange={(e) => setDelayHours(e.target.value)}
                    placeholder="e.g. 3"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Primary Delay Reason</label>
                  <select
                    value={delayReason}
                    onChange={(e) => setDelayReason(e.target.value as any)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                    required
                  >
                    <option value="rain">🌧️ Monsoon Rains / Wet Soil / Storms</option>
                    <option value="labour_shortage">👷 Labour Deficit / Strikes</option>
                    <option value="material_delay">🚚 Supply Chain / Delayed Transport</option>
                    <option value="power_cut">⚡ Electricity Cut / Grid Blackout</option>
                    <option value="machinery_breakdown">⚙️ Concrete Mixer / Plant Failure</option>
                    <option value="other">📌 Other Administrative / Local Hurdles</option>
                  </select>
                </div>

                <div className="md:col-span-3 space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Disruption Mitigation & Resolution Notes</label>
                  <textarea
                    rows={2}
                    value={delayNotes}
                    onChange={(e) => setDelayNotes(e.target.value)}
                    placeholder="Briefly state why the delay occurred and what mitigation actions were implemented (e.g. 'Pumping out water from basement', 'Sourced PPC Cement from secondary supplier to maintain target schedule')"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                    required
                  />
                </div>
              </>
            )}

            <div className="col-span-1 md:col-span-3 pt-2 flex justify-end gap-3 border-t border-slate-100 mt-2">
              <button
                type="button"
                onClick={() => { setShowForm(false); resetForm(); }}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2 rounded-lg text-sm font-medium cursor-pointer"
              >
                {editingLog ? 'Update Log Record' : 'Save Log Record'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Weather Filters Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs font-semibold text-slate-600">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1">
            <ListFilter className="w-3.5 h-3.5 text-slate-400" /> Filter Logs:
          </span>

          <button
            onClick={() => setWeatherFilter('all')}
            className={`px-3 py-1.5 rounded-lg border font-bold transition cursor-pointer ${
              weatherFilter === 'all'
                ? 'bg-slate-900 border-slate-900 text-white'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            All Conditions
          </button>

          {Object.keys(weatherLabels).map(type => (
            <button
              key={type}
              onClick={() => setWeatherFilter(type)}
              className={`px-2.5 py-1.5 rounded-lg border text-[11px] transition cursor-pointer flex items-center gap-1 ${
                weatherFilter === type
                  ? 'bg-slate-900 border-slate-900 text-white'
                  : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100'
              }`}
            >
              <span>{type === 'sunny' ? '☀️' : type === 'cloudy' ? '☁️' : type === 'rainy' ? '🌧️' : type === 'stormy' ? '⛈️' : type === 'extreme_heat' ? '🥵' : '❄️'}</span>
              <span className="capitalize">{type.replace('_', ' ')}</span>
            </button>
          ))}
        </div>

        <button
          onClick={() => setFilterDelayOnly(!filterDelayOnly)}
          className={`px-3 py-1.5 rounded-lg border font-bold transition flex items-center gap-1.5 cursor-pointer ${
            filterDelayOnly
              ? 'bg-amber-100 border-amber-300 text-amber-900'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Show Work Disruptions Only</span>
        </button>
      </div>

      {/* Historical Logs List */}
      {filteredLogs.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-200 rounded-xl p-12 text-center space-y-4">
          <CloudSun className="w-12 h-12 text-slate-300 mx-auto" />
          <div>
            <h3 className="font-semibold text-slate-700">No Weather/Delay Records</h3>
            <p className="text-slate-400 text-sm max-w-sm mx-auto mt-1">
              There are no weather data or disruption warnings registered. Keep a clean log of site climate conditions to resolve claims smoothly.
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add Day Log
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs text-slate-500">
            <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-5 py-3">Calendar Date</th>
                <th className="px-5 py-3">Weather Condition</th>
                <th className="px-5 py-3">Temperature</th>
                <th className="px-5 py-3">Disruption / Downtime?</th>
                <th className="px-5 py-3">Delay Reason & Action taken</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/50 transition">
                  <td className="px-5 py-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                    {log.date}
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {weatherIcons[log.weather] || <Compass className="w-4 h-4 text-slate-400" />}
                      <span className="font-semibold text-slate-700">{weatherLabels[log.weather] || log.weather}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 font-mono font-semibold text-slate-800 whitespace-nowrap">
                    {log.temperature ? `${log.temperature}°C` : 'N/A'}
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    {log.isDelay ? (
                      <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 text-[10px] font-bold px-2.5 py-1 rounded border border-rose-200">
                        ⚠️ Delay: {log.delayHours} Hours
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2.5 py-1 rounded border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5" /> No Disruption
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    {log.isDelay ? (
                      <div className="space-y-0.5 max-w-sm">
                        <p className="font-semibold text-slate-800">{reasonLabels[log.delayReason!] || log.delayReason}</p>
                        <p className="text-slate-400 text-[11px] leading-relaxed italic">{log.delayNotes}</p>
                      </div>
                    ) : (
                      <span className="text-slate-400 italic">Smooth, uninterrupted progress.</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleEditClick(log)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition cursor-pointer"
                        title="Edit weather/delay log"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Delete this weather/delay log record?')) {
                            onDeleteDelayWeatherLog(log.id);
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                        title="Delete log"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
