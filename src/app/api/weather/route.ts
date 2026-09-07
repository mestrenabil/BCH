import { NextResponse } from 'next/server'

// Cache weather data for 30 minutes
let cachedWeather: { data: WeatherData; timestamp: number } | null = null
const CACHE_DURATION = 30 * 60 * 1000 // 30 minutes

interface WeatherData {
  temperature: number
  humidity: number
  windSpeed: number
  description: string
  descriptionAr: string
  city: string
  icon: string
}

// Map English weather descriptions to Arabic
function translateWeatherToArabic(desc: string): string {
  const lower = desc.toLowerCase()
  if (lower.includes('sunny') || lower.includes('clear')) return 'مشمس'
  if (lower.includes('partly cloudy')) return 'غائم جزئياً'
  if (lower.includes('cloudy') || lower.includes('overcast')) return 'غائم'
  if (lower.includes('light rain') || lower.includes('light drizzle')) return 'مطر خفيف'
  if (lower.includes('rain') || lower.includes('shower')) return 'ماطر'
  if (lower.includes('thunder') || lower.includes('storm')) return 'عاصفة رعدية'
  if (lower.includes('fog') || lower.includes('mist')) return 'ضبابي'
  if (lower.includes('haze')) return 'ضباب خفيف'
  if (lower.includes('wind')) return 'عاصف'
  if (lower.includes('snow')) return 'ثلج'
  return desc
}

export async function GET() {
  // Return cached data if still valid
  if (cachedWeather && Date.now() - cachedWeather.timestamp < CACHE_DURATION) {
    return NextResponse.json(cachedWeather.data)
  }

  try {
    const res = await fetch('https://wttr.in/Morocco?format=j1', {
      next: { revalidate: 1800 }, // 30 minutes cache
    })

    if (!res.ok) {
      throw new Error(`Weather API returned ${res.status}`)
    }

    const data = await res.json()
    const current = data.current_condition?.[0]

    if (!current) {
      throw new Error('No current weather data')
    }

    const weatherData: WeatherData = {
      temperature: parseInt(current.temp_C || '0'),
      humidity: parseInt(current.humidity || '0'),
      windSpeed: parseInt(current.windspeedKmph || '0'),
      description: current.weatherDesc?.[0]?.value || 'N/A',
      descriptionAr: translateWeatherToArabic(current.weatherDesc?.[0]?.value || ''),
      city: 'المغرب',
      icon: current.weatherCode === '113' ? '☀️' :
            current.weatherCode === '116' ? '⛅' :
            current.weatherCode === '119' || current.weatherCode === '122' ? '☁️' :
            parseInt(current.weatherCode || '0') >= 200 && parseInt(current.weatherCode || '0') < 300 ? '⛈️' :
            parseInt(current.weatherCode || '0') >= 300 && parseInt(current.weatherCode || '0') < 600 ? '🌧️' :
            parseInt(current.weatherCode || '0') >= 600 && parseInt(current.weatherCode || '0') < 700 ? '❄️' :
            parseInt(current.weatherCode || '0') >= 700 && parseInt(current.weatherCode || '0') < 800 ? '🌫️' :
            '🌤️',
    }

    // Update cache
    cachedWeather = { data: weatherData, timestamp: Date.now() }

    return NextResponse.json(weatherData)
  } catch (error) {
    console.error('Weather API error:', error)
    // Return stale cache if available, otherwise error
    if (cachedWeather) {
      return NextResponse.json(cachedWeather.data)
    }
    return NextResponse.json(
      { error: 'Failed to fetch weather data' },
      { status: 500 }
    )
  }
}
