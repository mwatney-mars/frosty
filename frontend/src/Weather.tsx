import { useState, useEffect } from 'react';
import { Cloud, Sun, MapPin, Loader2 } from 'lucide-react';

export default function WeatherWidget() {
  const [weather, setWeather] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchWeather() {
      try {
        const geoRes = await fetch('https://ipapi.co/json/');
        const geoData = await geoRes.json();
        const lat = geoData.latitude || 51.5074;
        const lon = geoData.longitude || -0.1278;

        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,is_day&timezone=auto`);
        const weatherData = await weatherRes.json();
        
        setWeather({
          temp: weatherData.current.temperature_2m,
          isDay: weatherData.current.is_day,
          city: geoData.city || 'Local'
        });
      } catch (err) {
        console.error("Failed to fetch weather", err);
      } finally {
        setLoading(false);
      }
    }
    fetchWeather();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="hidden sm:inline">Checking outside...</span>
      </div>
    );
  }

  if (!weather) return null;

  return (
    <div className="flex items-center gap-3 text-sm bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl px-3 py-1.5 shadow-sm">
      <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-medium">
        <MapPin className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">{weather.city}</span>
      </div>
      <div className="w-px h-4 bg-slate-200 dark:bg-slate-700"></div>
      <div className="flex items-center gap-1.5 text-amber-500 dark:text-amber-400 font-bold">
        {weather.isDay ? <Sun className="w-4 h-4 text-amber-500" /> : <Cloud className="w-4 h-4 text-slate-400" />}
        <span>{weather.temp}°C</span>
      </div>
    </div>
  );
}
