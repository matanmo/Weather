// Weather App JavaScript
// This file handles fetching weather data and calculating comparisons using PFI

// Location will be detected automatically from IP
let LOCATION = null;

// Check if running on mobile
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// DOM elements
const weatherData = document.querySelector('.weather-data');
const error = document.getElementById('error');

// Helper function to fetch with timeout
async function fetchWithTimeout(url, options = {}, timeout = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    throw err;
  }
}

// Precipitation logic functions
function determinePrecipitationType(rainProb, snowProb) {
  // Only show precipitation if probability > 30%
  if (rainProb <= 30 && snowProb <= 30) {
    return null;
  }
  
  // Return the type with higher probability
  if (rainProb > snowProb) {
    return { type: 'rain', probability: rainProb };
  } else {
    return { type: 'snow', probability: snowProb };
  }
}

function getPrecipitationDisplay(precipitationData) {
  if (!precipitationData) {
    return { icon: '', label: '', show: false };
  }
  
  const { type, probability } = precipitationData;
  let icon, label;
  
  if (type === 'rain') {
    icon = '<span class="material-symbols-sharp">rainy</span>';
    if (probability > 60) {
      label = 'Rain expected';
    } else {
      label = 'Likely to rain';
    }
  } else if (type === 'snow') {
    icon = '<span class="material-symbols-sharp">ac_unit</span>';
    if (probability > 60) {
      label = 'Snow expected';
    } else {
      label = 'Likely to snow';
    }
  }
  
  return { icon, label, show: true };
}

// Hazard detection functions
function detectHazards(weatherData) {
  // Priority order: Fire Risk > Extreme Heat > Heavy Rain/Flood > Snow/Ice > Extreme Cold > Strong Winds
  
  const daily = weatherData.daily;
  const hazards = [];
  
  // Process each day
  for (let i = 0; i < daily.time.length; i++) {
    const tempMax = daily.apparent_temperature_max[i];
    const tempMin = daily.apparent_temperature_min[i];
    const humidity = daily.relative_humidity_2m_mean[i];
    const wind = daily.windspeed_10m_max[i];
    const precipitation = daily.precipitation_sum[i];
    const precipProb = daily.precipitation_probability_max[i];
    
    let detectedHazard = null;
    
    // Check hazards in priority order
    // 1. Fire Risk: temp ≥ 32°C AND humidity ≤ 30% AND wind ≥ 25 km/h
    if (tempMax >= 32 && humidity <= 30 && wind >= 25) {
      detectedHazard = 'Fire Risk';
    }
    // 2. Extreme Heat: apparent_temperature_max ≥ 38°C
    else if (tempMax >= 38) {
      detectedHazard = 'Extreme Heat';
    }
    // 3. Heavy Rain/Flood: precipitation_sum ≥ 30-40 mm/day AND probability ≥ 70%
    else if (precipitation >= 30 && precipProb >= 70) {
      detectedHazard = 'Heavy Rain';
    }
    // 4. Snow/Ice: snowfall > 0 AND temp ≤ 0°C (simplified - using precipitation and temp)
    else if (precipitation > 0 && tempMin <= 0) {
      detectedHazard = 'Snow/Ice';
    }
    // 5. Extreme Cold: apparent_temperature_min ≤ 0°C
    else if (tempMin <= 0) {
      detectedHazard = 'Extreme Cold';
    }
    // 6. Strong Winds: windspeed_10m_max ≥ 50 km/h
    else if (wind >= 50) {
      detectedHazard = 'Strong Winds';
    }
    
    hazards.push(detectedHazard);
  }
  
  return hazards;
}

function getHazardDisplay(hazardType) {
  if (!hazardType) {
    return { icon: '', label: '', show: false };
  }
  
  let icon, label;
  
  switch (hazardType) {
    case 'Fire Risk':
      icon = '<span class="material-symbols-sharp">mode_heat</span>';
      label = 'Fire Risk';
      break;
    case 'Extreme Heat':
      icon = '<span class="material-symbols-sharp">heat</span>';
      label = 'Extreme Heat';
      break;
    case 'Heavy Rain':
      icon = '<span class="material-symbols-sharp">flood</span>';
      label = 'Heavy Rain';
      break;
    case 'Snow/Ice':
      icon = '<span class="material-symbols-sharp">severe_cold</span>';
      label = 'Snow/Ice';
      break;
    case 'Extreme Cold':
      icon = '<span class="material-symbols-sharp">severe_cold</span>';
      label = 'Extreme Cold';
      break;
    case 'Strong Winds':
      icon = '<span class="material-symbols-sharp">air</span>';
      label = 'Strong Winds';
      break;
    default:
      return { icon: '', label: '', show: false };
  }
  
  return { icon, label, show: true };
}

// Show loading progress
function showLoadingProgress(step) {
  const comparison = weatherData.querySelector('.comparison');
  comparison.innerHTML = 'Loading...<br>&nbsp;';
}

// Main function to start the weather app
async function initWeatherApp() {
  try {
    console.log('Starting weather app...'); // Debug log
    
    // 🔧 DEBUG: Check mock mode status
    console.log('🔧 DEBUG: window.TESTING_MODE =', window.TESTING_MODE);
    console.log('🔧 DEBUG: typeof window.TESTING_MODE =', typeof window.TESTING_MODE);
    console.log('🔧 DEBUG: window.mockConfig =', window.mockConfig);
    console.log('🔧 DEBUG: typeof window.mockConfig =', typeof window.mockConfig);
    
    // Check if mock mode is active
    if (window.TESTING_MODE) {
      console.log('🔧 MOCK MODE ACTIVE - Using test data instead of real API');
      console.log('Mock config:', window.mockConfig);
    } else {
      console.log('🌤️ REAL API MODE - Fetching live weather data');
    }
    
    // Hide any previous errors
    error.style.display = 'none';
    
    // Check if we're in mock mode
    if (window.TESTING_MODE) {
      // Mock mode - skip API calls and use mock data directly
      showLoadingProgress('Mock mode...');
      console.log('Skipping API calls in mock mode...'); // Debug log
      
      // Generate mock comparisons directly from mock config
      const mockComparisons = generateMockComparisons();
      
      // Display results
      showLoadingProgress('Finalizing...');
      console.log('Displaying mock results...'); // Debug log
      displayResults(mockComparisons);
      
    } else {
      // Real API mode - normal flow
      // Get location from IP first
      showLoadingProgress('Getting location...');
      console.log('Getting location from IP...'); // Debug log
      await getLocationFromIP();
      
      // Fetch weather data for 7 days (today + 6 future days)
      showLoadingProgress('Fetching weather...');
      console.log('Fetching weather data...'); // Debug log
      const weatherData = await fetchWeatherData();
      
      // Calculate PFI for each day
      showLoadingProgress('Calculating...');
      console.log('Calculating PFI...'); // Debug log
      const pfiData = calculatePFI(weatherData);
      
      // Generate comparison data with percentages
      showLoadingProgress('Generating...');
      console.log('Generating comparisons...'); // Debug log
      const comparisons = generateComparisons(pfiData, weatherData.current.temperature_2m, weatherData);
      
      // Display results
      showLoadingProgress('Finalizing...');
      console.log('Displaying results...'); // Debug log
      displayResults(comparisons);
    }
    
  } catch (err) {
    console.error('Error in initWeatherApp:', err);
    
    // Try to show fallback data instead of just an error
    try {
      showFallbackData();
      showError(`Using sample data. API error: ${err.message}`);
    } catch (fallbackErr) {
      console.error('Fallback also failed:', fallbackErr);
      showError(`Failed to load weather data: ${err.message}`);
    }
  }
}

// Get approximate location from IP address
async function getLocationFromIP() {
  try {
    console.log('Fetching location from ipapi.co...'); // Debug log
    console.log('User agent:', navigator.userAgent); // Debug log
    console.log('Is mobile:', isMobile); // Debug log
    
    const response = await fetchWithTimeout('https://ipapi.co/json/', {}, 15000);
    
    if (!response.ok) {
      throw new Error(`IP API failed: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('IP API response:', data); // Debug log
    
    LOCATION = {
      latitude: data.latitude,
      longitude: data.longitude
    };
    
    console.log('Location detected:', data.city, data.country);
  } catch (err) {
    console.error('Failed to get location from IP, using default:', err);
    // Fallback to Tel Aviv if IP location fails
    LOCATION = {
      latitude: 32.08,
      longitude: 34.78
    };
    console.log('Using fallback location:', LOCATION);
  }
}

// Fetch weather data from Open-Meteo API for 7 days (1 past + 6 future)
async function fetchWeatherData() {
  try {
    // Get current temperature and daily forecast
    const currentUrl = `https://api.open-meteo.com/v1/forecast?latitude=${LOCATION.latitude}&longitude=${LOCATION.longitude}&current=temperature_2m&timezone=auto`;
    const dailyUrl = `https://api.open-meteo.com/v1/forecast?latitude=${LOCATION.latitude}&longitude=${LOCATION.longitude}&daily=apparent_temperature_min,apparent_temperature_max,cloudcover_mean,precipitation_probability_max,precipitation_sum,windspeed_10m_max,relative_humidity_2m_mean&timezone=auto&past_days=1&forecast_days=6`;
    
    console.log('Fetching current temperature from:', currentUrl); // Debug log
    console.log('Fetching daily forecast from:', dailyUrl); // Debug log
    
    // Fetch both current and daily data
    const [currentResponse, dailyResponse] = await Promise.all([
      fetchWithTimeout(currentUrl),
      fetchWithTimeout(dailyUrl)
    ]);
    
    if (!currentResponse.ok) {
      throw new Error(`Current weather API failed: ${currentResponse.status} ${currentResponse.statusText}`);
    }
    
    if (!dailyResponse.ok) {
      throw new Error(`Daily weather API failed: ${dailyResponse.status} ${dailyResponse.statusText}`);
    }
    
    const currentData = await currentResponse.json();
    const dailyData = await dailyResponse.json();
    
    // Combine the data
    const combinedData = {
      current: currentData.current,
      daily: dailyData.daily
    };
    
    console.log('Weather API response received'); // Debug log
    return combinedData;
    
  } catch (err) {
    console.error('Error fetching weather data:', err);
    throw new Error(`Weather API error: ${err.message}`);
  }
}

// Calculate PFI (Perceived Feel Index) for each day
function calculatePFI(weatherData) {
  const daily = weatherData.daily;
  const pfiData = [];
  
  console.log('Raw weather data received:', weatherData); // Debug log
  console.log('Daily data structure:', daily); // Debug log
  console.log('Number of days:', daily.time.length); // Debug log
  
  // Process each day (7 days: 1 past + 6 future)
  for (let i = 0; i < daily.time.length; i++) {
    const apparentTempMin = daily.apparent_temperature_min[i];
    const apparentTempMax = daily.apparent_temperature_max[i];
    const cloudcover = daily.cloudcover_mean[i];
    
    // Get precipitation probability (Open-Meteo provides max probability for the day)
    const precipitationProb = daily.precipitation_probability_max[i] || 0;
    
    console.log(`Day ${i}:`, { apparentTempMin, apparentTempMax, cloudcover, precipitationProb }); // Debug log
    
    // Calculate average apparent temperature
    const avgApparentTemp = (apparentTempMin + apparentTempMax) / 2;
    
    // Calculate cloud adjustment: 0.02 * (50 - cloudcover_mean)
    const cloudAdj = 0.02 * (50 - cloudcover);
    
    // Calculate PFI: average apparent temperature + cloud adjustment
    const pfi = avgApparentTemp + cloudAdj;
    
    // For now, we'll use the same precipitation probability for both rain and snow
    // In a real implementation, you might want to use temperature to determine if it's rain or snow
    // For simplicity, we'll assume it's rain if temperature > 0°C, snow if ≤ 0°C
    const avgTemp = (apparentTempMin + apparentTempMax) / 2;
    const precipitation = {
      rain: avgTemp > 0 ? precipitationProb : 0,
      snow: avgTemp <= 0 ? precipitationProb : 0
    };
    
    pfiData.push({
      date: daily.time[i],
      pfi: pfi,
      avgApparentTemp: avgApparentTemp,
      cloudcover: cloudcover,
      precipitation: precipitation
    });
  }
  
  console.log('Processed PFI data:', pfiData); // Debug log
  return pfiData;
}

// Generate comparison data with percentages and 10% threshold
function generateComparisons(pfiData, currentTemp, weatherData) {
  console.log('generateComparisons called with:', pfiData); // Debug log
  
  if (pfiData.length < 7) { // 1 past day + 6 future days
    console.error('Not enough weather data. Expected 7, got:', pfiData.length);
    throw new Error('Not enough weather data');
  }
  
  const yesterday = pfiData[0];
  const today = pfiData[1];
  
  console.log('Yesterday data:', yesterday); // Debug log
  console.log('Today data:', today); // Debug log
  
  // Calculate today vs yesterday difference using actual PFI data
  const todayVsYesterdayDiff = today.pfi - yesterday.pfi;
  
  // Generate today comparison
  const todayComparison = generateComparisonData(todayVsYesterdayDiff, 'Today');
  
  // Generate week PFI values (skip yesterday, start from today)
  const weekPFI = generateWeekPFI(pfiData.slice(1));
  
  // Generate precipitation data for today and week
  const todayPrecipitation = today.precipitation ? 
    getPrecipitationDisplay(determinePrecipitationType(today.precipitation.rain, today.precipitation.snow)) : 
    { icon: '', label: '', show: false };
  
  const weekPrecipitation = [];
  for (let i = 1; i < pfiData.length; i++) { // Skip yesterday, start from today
    const dayData = pfiData[i];
    if (dayData.precipitation) {
      weekPrecipitation.push(getPrecipitationDisplay(determinePrecipitationType(dayData.precipitation.rain, dayData.precipitation.snow)));
    } else {
      weekPrecipitation.push({ icon: '', label: '', show: false });
    }
  }
  
  // Generate hazard data for today and week
  const hazards = detectHazards(weatherData);
  const todayHazard = getHazardDisplay(hazards[1]); // Index 1 is today (after yesterday)
  
  const weekHazards = [];
  for (let i = 1; i < hazards.length; i++) { // Skip yesterday, start from today
    weekHazards.push(getHazardDisplay(hazards[i]));
  }
  
  return {
    todayPFI: today.pfi,
    todayComparison: todayComparison,
    weekPFI: weekPFI,
    todayPrecipitation: todayPrecipitation,
    weekPrecipitation: weekPrecipitation,
    todayHazard: todayHazard,
    weekHazards: weekHazards
  };
}

// Generate comparison data with percentage and arrow
function generateComparisonData(difference, dayName) {
  // Convert temperature difference to percentage (1°C ≈ 5%)
  // This percentage is used internally for feelChange thresholds, not displayed to user
  const percentage = Math.round(difference * 5);
  
  let arrow;
  let comparison;
  
  // Apply new thresholds for feelChange labels:
  // <5%: Same as yesterday
  // 5-15%: A bit hotter / colder
  // 15-35%: Noticeably hotter / colder
  // >35%: Significantly hotter / colder
  if (percentage > 35) {
    arrow = '↑';
    comparison = 'significantly_hotter';
  } else if (percentage > 15) {
    arrow = '↑';
    comparison = 'noticeably_hotter';
  } else if (percentage > 5) {
    arrow = '↑';
    comparison = 'hotter';
  } else if (percentage < -35) {
    arrow = '↓';
    comparison = 'significantly_colder';
  } else if (percentage < -15) {
    arrow = '↓';
    comparison = 'noticeably_colder';
  } else if (percentage < -5) {
    arrow = '↓';
    comparison = 'colder';
  } else {
    arrow = '-';
    comparison = 'same';
  }
  
  // Only show percentage if it's 5% or larger
  const fullDisplay = Math.abs(percentage) >= 5 ? `${arrow} ${Math.abs(percentage)}%` : arrow;
  
  // Return HTML structure for proper display
  const htmlDisplay = Math.abs(percentage) >= 5 ? 
    `${arrow}<br>${Math.abs(percentage)}%` : 
    arrow;
  
  return {
    arrow: arrow,
    percentage: Math.abs(percentage),
    comparison: comparison,
    fullDisplay: fullDisplay,
    htmlDisplay: htmlDisplay
  };
}

  // Generate mock comparisons directly from mock config
function generateMockComparisons() {
  console.log('Generating mock comparisons from config...'); // Debug log
  
  // Get today's mock data
  const todayMock = getMockConfig('today');
  const yesterdayMock = getMockConfig('yesterday') || { pfi: 20 }; // Fallback for yesterday
  
  // Calculate today vs yesterday difference for comparison text
  const todayVsYesterdayDiff = todayMock.pfi - yesterdayMock.pfi;
  
  // Generate today comparison based on PFI difference
  // Using the same thresholds as the real API logic
  // 1°C ≈ 5%, so 3°C ≈ 15%, 7°C ≈ 35%
  let comparison;
  if (todayVsYesterdayDiff > 7) {
    comparison = 'significantly_hotter';
  } else if (todayVsYesterdayDiff > 3) {
    comparison = 'noticeably_hotter';
  } else if (todayVsYesterdayDiff > 1) {
    comparison = 'hotter';
  } else if (todayVsYesterdayDiff < -7) {
    comparison = 'significantly_colder';
  } else if (todayVsYesterdayDiff < -3) {
    comparison = 'noticeably_colder';
  } else if (todayVsYesterdayDiff < -1) {
    comparison = 'colder';
  } else {
    comparison = 'same';
  }
  
  const todayComparison = {
    comparison: comparison
  };
  
  // Generate week PFI values
  const pfiValues = [];
  
  // Get today's date and generate day names starting from tomorrow
  const today = new Date();
  const dayNames = [];
  
  // Generate 6 day names starting from tomorrow (skip today)
  for (let i = 1; i <= 6; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
    dayNames.push(dayName);
  }
  
  // Map mock days to display order and get PFI values
  const mockDayOrder = ['yesterday', 'today', 'tomorrow', 'day3', 'day4', 'day5', 'day6', 'day7'];
  
  mockDayOrder.forEach(dayKey => {
    const mockData = getMockConfig(dayKey);
    if (mockData && mockData.pfi !== undefined) {
      pfiValues.push(mockData.pfi);
    } else {
      pfiValues.push(22); // Default fallback
    }
  });
  
  // Generate precipitation data for today and week
  const todayPrecipitation = todayMock && todayMock.precipitation ? 
    getPrecipitationDisplay(determinePrecipitationType(todayMock.precipitation.rain, todayMock.precipitation.snow)) : 
    { icon: '', label: '', show: false };
  
  const weekPrecipitation = [];
  const weekMockDays = ['tomorrow', 'day3', 'day4', 'day5', 'day6', 'day7'];
  weekMockDays.forEach(dayKey => {
    const mockData = getMockConfig(dayKey);
    if (mockData && mockData.precipitation) {
      weekPrecipitation.push(getPrecipitationDisplay(determinePrecipitationType(mockData.precipitation.rain, mockData.precipitation.snow)));
    } else {
      weekPrecipitation.push({ icon: '', label: '', show: false });
    }
  });
  
  // Generate hazard data for today and week from mock config
  const todayHazard = todayMock && todayMock.hazard ? 
    getHazardDisplay(todayMock.hazard) : 
    { icon: '', label: '', show: false };
  
  const weekHazards = [];
  weekMockDays.forEach(dayKey => {
    const mockData = getMockConfig(dayKey);
    if (mockData && mockData.hazard) {
      weekHazards.push(getHazardDisplay(mockData.hazard));
    } else {
      weekHazards.push({ icon: '', label: '', show: false });
    }
  });
  
  return {
    todayPFI: pfiValues[1], // Today's PFI (index 1, after yesterday)
    todayComparison: todayComparison,
    weekPFI: { dayNames, pfiValues: pfiValues.slice(2) }, // Skip yesterday and today, show tomorrow through day7
    todayPrecipitation: todayPrecipitation,
    weekPrecipitation: weekPrecipitation,
    todayHazard: todayHazard,
    weekHazards: weekHazards
  };
}

// Generate week forecast trends
function generateWeekPFI(pfiData) {
  const pfiValues = [];
  
  // Get today's date and generate day names starting from tomorrow
  const today = new Date();
  const dayNames = [];
  
  // Generate 6 day names starting from tomorrow (skip today)
  for (let i = 1; i <= 6; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
    dayNames.push(dayName);
  }
  
  console.log('pfiData received:', pfiData); // Debug log
  console.log('Generated day names:', dayNames); // Debug log
  
  // pfiData contains: [today, tomorrow, day3, day4, day5, day6]
  // We need 6 PFI values for the week display
  for (let i = 0; i < 6; i++) {
    if (pfiData[i] && typeof pfiData[i].pfi === 'number') {
      pfiValues.push(pfiData[i].pfi);
    } else {
      console.warn(`Missing or invalid PFI data for day ${i}:`, pfiData[i]);
      pfiValues.push(null); // Fallback if data is missing
    }
  }
  
  return { dayNames, pfiValues };
}

// Display the results in the HTML
function displayResults(comparisons) {
  // Get weather data elements directly
  const comparison = weatherData.querySelector('.comparison');
  const weekDays = weatherData.querySelector('.week-days');
  const pfiValue = weatherData.querySelector('.pfi-value');
  
  // Update today's PFI value
  if (comparisons.todayPFI !== undefined) {
    pfiValue.textContent = `${Math.round(comparisons.todayPFI)}°`;
  }
  
  // Update today comparison with the exact phrasing requested
  const comparisonText = comparisons.todayComparison.comparison;
  let displayText;
  
  if (comparisonText === 'significantly_colder') {
    displayText = 'Significantly colder<br>than yesterday';
  } else if (comparisonText === 'noticeably_colder') {
    displayText = 'Noticeably colder<br>than yesterday';
  } else if (comparisonText === 'colder') {
    displayText = 'A bit colder than<br>yesterday';
  } else if (comparisonText === 'significantly_hotter') {
    displayText = 'Significantly hotter<br>than yesterday';
  } else if (comparisonText === 'noticeably_hotter') {
    displayText = 'Noticeably hotter<br>than yesterday';
  } else if (comparisonText === 'hotter') {
    displayText = 'A bit hotter than<br>yesterday';
  } else {
    displayText = 'About the same as<br>yesterday';
  }
  
  comparison.innerHTML = displayText;
  
  // Update today's precipitation and hazard (hazard takes priority)
  const precipitationToday = weatherData.querySelector('.precipitation-today');
  const hazardToday = weatherData.querySelector('.hazard-today');
  
  if (comparisons.todayHazard && comparisons.todayHazard.show) {
    // Hazard takes priority - show hazard, hide precipitation
    const hazardIcon = hazardToday.querySelector('.hazard-icon');
    const hazardLabel = hazardToday.querySelector('.hazard-label');
    
    hazardIcon.innerHTML = comparisons.todayHazard.icon;
    hazardLabel.textContent = comparisons.todayHazard.label;
    hazardToday.style.display = 'flex';
    precipitationToday.style.display = 'none';
  } else if (comparisons.todayPrecipitation && comparisons.todayPrecipitation.show) {
    // No hazard, show precipitation
    const precipitationIcon = precipitationToday.querySelector('.precipitation-icon');
    const precipitationLabel = precipitationToday.querySelector('.precipitation-label');
    
    precipitationIcon.innerHTML = comparisons.todayPrecipitation.icon;
    precipitationLabel.textContent = comparisons.todayPrecipitation.label;
    precipitationToday.style.display = 'flex';
    hazardToday.style.display = 'none';
  } else {
    // Neither hazard nor precipitation
    precipitationToday.style.display = 'none';
    hazardToday.style.display = 'none';
  }
  
  // Update week forecast with PFI values and precipitation
  const dayItems = weekDays.querySelectorAll('.day-item');
  comparisons.weekPFI.dayNames.forEach((dayName, index) => {
    const dayItem = dayItems[index];
    const dayNameEl = dayItem.querySelector('.day-name');
    const dayPfiEl = dayItem.querySelector('.day-pfi');
    const precipitationWeek = dayItem.querySelector('.precipitation-week');
    const precipitationIcon = precipitationWeek.querySelector('.precipitation-icon');
    
    dayNameEl.textContent = dayName;
    
    // Display PFI value for each day
    if (comparisons.weekPFI.pfiValues[index] !== undefined) {
      dayPfiEl.textContent = `${Math.round(comparisons.weekPFI.pfiValues[index])}°`;
    } else {
      dayPfiEl.textContent = '--°';
    }
    
    // Display precipitation icon for each day (only if no hazard)
    const hazardWeek = dayItem.querySelector('.hazard-week');
    const hazardIcon = hazardWeek.querySelector('.hazard-icon');
    
    if (comparisons.weekHazards && comparisons.weekHazards[index] && comparisons.weekHazards[index].show) {
      // Hazard takes priority - show hazard, hide precipitation
      hazardIcon.innerHTML = comparisons.weekHazards[index].icon;
      hazardWeek.style.display = 'flex';
      precipitationWeek.style.display = 'none';
    } else if (comparisons.weekPrecipitation && comparisons.weekPrecipitation[index] && comparisons.weekPrecipitation[index].show) {
      // No hazard, show precipitation
      precipitationIcon.innerHTML = comparisons.weekPrecipitation[index].icon;
      precipitationWeek.style.display = 'flex';
      hazardWeek.style.display = 'none';
    } else {
      // Neither hazard nor precipitation
      precipitationWeek.style.display = 'none';
      hazardWeek.style.display = 'none';
    }
  });
}

// Show fallback data if APIs fail
function showFallbackData() {
  console.log('Showing fallback data...'); // Debug log
  
  const comparison = weatherData.querySelector('.comparison');
  const pfiValue = weatherData.querySelector('.pfi-value');
  
  // Show sample data
  comparison.innerHTML = '<strong>Sample</strong> data<br>for testing';
  pfiValue.textContent = '22°';
  
  // Update week days with sample PFI values
  const dayItems = weatherData.querySelectorAll('.day-item');
  const samplePFI = [25, 20, 28, 23, 26, 21];
  
  dayItems.forEach((dayItem, index) => {
    const dayPfiEl = dayItem.querySelector('.day-pfi');
    dayPfiEl.textContent = `${samplePFI[index]}°`;
  });
}

// Show error message
function showError(message) {
  error.textContent = message;
  error.style.display = 'block';
  
  // Show retry button for mobile users
  const retryBtn = document.getElementById('retry');
  if (retryBtn) {
    retryBtn.style.display = 'block';
  }
}

// Retry function for mobile users
function retryApp() {
  console.log('Retrying app...'); // Debug log
  
  // Hide error and retry button
  error.style.display = 'none';
  const retryBtn = document.getElementById('retry');
  if (retryBtn) {
    retryBtn.style.display = 'none';
  }
  
  // Restart the app
  initWeatherApp();
}

// Start the app when the page loads
document.addEventListener('DOMContentLoaded', initWeatherApp); 