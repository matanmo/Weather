// Mock Mode Configuration for Weather App
// Toggle this to switch between real API and mock data

// 🔧 TESTING_MODE: true = use mock data, false = real API
window.TESTING_MODE = true;

// Force mock mode to be true (in case of any issues)
if (typeof window !== 'undefined') {
  window.TESTING_MODE = true;
  console.log('🔧 FORCED: Mock mode is now TRUE');
}

// 🧪 QUICK TESTING GUIDE:
// 1. Set TESTING_MODE = true to enable mock mode
// 2. Edit the PFI values below to test different temperature scenarios
// 3. Refresh the page to see changes
// 4. Set TESTING_MODE = false to return to real API mode

// Mock configuration for each day
// Each day now has an actual PFI value (in Celsius) instead of trend data
// PFI values represent how the weather "feels" - similar to apparent temperature
// 
// FeelChange thresholds (based on percentage difference):
// <5%: Same as yesterday
// 5-15%: A bit hotter/colder
// 15-35%: Noticeably hotter/colder  
// >35%: Significantly hotter/colder
//
// Test the new "significantly" threshold by changing today's PFI:
// - For "significantly hotter": set today.pfi to 25+ (8°C+ difference = 40%+)
// - For "significantly colder": set today.pfi to 9- (8°C+ difference = 40%+)
//
// Precipitation testing:
// - Rain: 31-60% = "Likely to rain", >60% = "Rain"
// - Snow: 31-60% = "Likely to snow", >60% = "Snow"
// - Higher probability wins between rain and snow
//
// Hazard testing:
// - Fire Risk: temp ≥ 32°C AND humidity ≤ 30% AND wind ≥ 25 km/h
// - Extreme Heat: apparent_temperature_max ≥ 38°C
// - Heavy Rain/Flood: precipitation_sum ≥ 30-40 mm/day AND probability ≥ 70%
// - Snow/Ice: snowfall > 0 AND temp ≤ 0°C
// - Extreme Cold: apparent_temperature_min ≤ 0°C
// - Strong Winds: windspeed_10m_max ≥ 50 km/h
window.mockConfig = [
  { day: 'yesterday', pfi: 21, precipitation: { rain: 15, snow: 5 }, hazard: null },    // Yesterday: 17°C (baseline for comparison)
  { day: 'today', pfi: 7, precipitation: { rain: 40, snow: 20 }, hazard: 'Heavy Rain' },        // Today: 25°C (significantly hotter: +8°C = +47%)
  { day: 'tomorrow', pfi: 38, precipitation: { rain: 10, snow: 0 }, hazard: 'Extreme Heat' },     // Tomorrow: 26°C (warmer)
  { day: 'day3', pfi: 16, precipitation: { rain: 70, snow: 15 }, hazard: null },         // Day 3: 19°C (cooler)
  { day: 'day4', pfi: 24, precipitation: { rain: 25, snow: 0 }, hazard: null },         // Day 4: 24°C (moderate)
  { day: 'day5', pfi: 19, precipitation: { rain: 0, snow: 0 }, hazard: 'Strong Winds' },          // Day 5: 28°C (hot)
  { day: 'day6', pfi: 0, precipitation: { rain: 20, snow: 40 }, hazard: 'Snow/Ice' },         // Day 6: 21°C (pleasant)
  { day: 'day7', pfi: 43, precipitation: { rain: 30, snow: 25 }, hazard: 'Fire Risk' }          // Day 7: 23°C (additional day)
];

// Function to get mock configuration for a specific day
function getMockConfig(day) {
  if (!window.TESTING_MODE) return null; // Return null if not in testing mode
  return window.mockConfig.find(d => d.day === day);
}

// Add console log to confirm mock mode is loaded
console.log('🔧 Mock config loaded! TESTING_MODE =', window.TESTING_MODE);
console.log('📊 Mock data available:', window.mockConfig);
console.log('🕐 Mock config loaded at:', new Date().toLocaleTimeString()); 