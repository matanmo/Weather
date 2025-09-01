// Weather App JavaScript
// This file handles fetching weather data and calculating comparisons using PFI

// Location will be detected automatically from IP
let LOCATION = null;
let isWeatherAppRunning = false; // Prevent multiple simultaneous weather app calls

// Check if running on mobile
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// DOM elements
const weatherData = document.querySelector('.weather-data');
const error = document.getElementById('error');

// ---- LOCATION SEARCH FUNCTIONALITY ----
let currentLocationName = "Loading..."; // Placeholder until location is detected
let ipBasedLocationName = "Loading..."; // Placeholder until location is detected
let ipLocationDetected = false; // Track if IP location has been successfully detected
let fuse; // Fuse.js instance for fuzzy searching
let isDismissing = false; // Flag to prevent focus events during dismiss

// Load saved location from localStorage on startup
function loadSavedLocation() {
  const savedLocation = localStorage.getItem('weatherAppLocation');
  if (savedLocation) {
    try {
      const locationData = JSON.parse(savedLocation);
      currentLocationName = locationData.name;
      LOCATION = {
        latitude: locationData.latitude,
        longitude: locationData.longitude
      };
      // Update search input if available
      if (searchInput) {
        searchInput.value = currentLocationName;
        resizeSearchInput();
      }
      console.log('Loaded saved location:', currentLocationName);
      return true; // Indicates we have a saved location
    } catch (err) {
      console.error('Error parsing saved location:', err);
      localStorage.removeItem('weatherAppLocation'); // Clear corrupted data
    }
  }
  return false; // No saved location
}

// Save location to localStorage
function saveLocation(name, latitude, longitude) {
  const locationData = {
    name: name,
    latitude: latitude,
    longitude: longitude
  };
  localStorage.setItem('weatherAppLocation', JSON.stringify(locationData));
  console.log('Saved location to localStorage:', locationData);
}

// Get search elements
const searchInput = document.getElementById('search-input');
const searchResults = document.querySelector('.search-results');
const dismissBtn = document.querySelector('.search-dismiss');

// Validate that all elements were found
console.log('Search elements found:', {
  searchInput: searchInput,
  searchResults: searchResults,
  dismissBtn: dismissBtn
});

if (!searchInput || !searchResults || !dismissBtn) {
  console.error('Some search elements not found!');
  // Don't return - just log the error and continue
}

// iOS-specific touch handling for search input
if (searchInput && isMobile) {
  // Enhanced touch handling for iOS devices
  searchInput.addEventListener('touchstart', function(e) {
    // Ensure input is ready for iOS interaction
    this.style.webkitUserSelect = 'text';
    this.style.webkitTouchCallout = 'default';
  });
  
  console.log('iOS touch handling enhanced for search input');
}

// Setup Fuse.js for fuzzy searching with typo tolerance
function setupFuse(data) {
  fuse = new Fuse(data, {
    keys: ["name", "country", "admin1"],
    threshold: 0.4, // controls typo tolerance (lower = more strict)
    includeScore: true
  });
}

// Fetch locations from Open-Meteo Geocoding API
async function fetchLocations(query) {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=10&language=en&format=json`;
    console.log('Fetching from URL:', url); // Debug log
    
    const response = await fetch(url);
    const data = await response.json();
    
    console.log('API response:', data); // Debug log
    
    if (data.results && data.results.length > 0) {
      setupFuse(data.results);
      return data.results;
    }
    return [];
  } catch (err) {
    console.error('Error fetching locations:', err);
    return [];
  }
}

// Render search results in the existing container
function renderResults(results) {
  // Skip if we're in the middle of dismissing
  if (isDismissing) {
    console.log('=== RENDERING SKIPPED - DISMISSING ==='); // Debug log
    return;
  }
  
  console.log('=== RENDERING RESULTS ==='); // Debug log
  
  // Clear existing results
  searchResults.innerHTML = "";
  console.log('Cleared previous results'); // Debug log
  
  // Always add current location result at the top (based on IP, not last selection)
  const currentLocationResult = document.createElement("div");
  currentLocationResult.classList.add("search-result");
  
  // First search result should ALWAYS show IP-based location
  let displayLocationName;
  if (ipLocationDetected && ipBasedLocationName && ipBasedLocationName !== "Loading...") {
    // We have a valid IP location - use it
    displayLocationName = ipBasedLocationName;
  } else {
    // IP location not detected yet - show generic placeholder
    displayLocationName = "Current location";
  }
  
  // Create icon and location name with proper spacing
  const locationIcon = document.createElement("span");
  locationIcon.classList.add("material-symbols-sharp", "location-icon");
  locationIcon.textContent = "near_me";
  
  const locationText = document.createElement("span");
  locationText.classList.add("location-text");
  locationText.textContent = displayLocationName;
  
  // Clear existing content and add icon + text
  currentLocationResult.innerHTML = "";
  currentLocationResult.appendChild(locationIcon);
  currentLocationResult.appendChild(locationText);
  
  // Handle current location selection
  currentLocationResult.onclick = function() {
    console.log('=== CURRENT LOCATION CLICKED ==='); // Debug log
    console.log('Returning to IP-based location:', ipBasedLocationName); // Debug log
    
    // Update search input to show IP-based location name
    searchInput.value = ipBasedLocationName;
    // Update the stored previous value for future focus/blur cycles
    searchInput.dataset.previousValue = ipBasedLocationName;
    console.log('Search input now shows:', ipBasedLocationName); // Debug log
    
    // Clear results
    searchResults.innerHTML = "";
    searchResults.classList.remove('has-results'); // Hide container
    
    // Resize input to fit new content
    resizeSearchInput();
    
    // Show weather data
    weatherData.classList.remove('search-hidden');
    
    // Hide dismiss button since search is no longer focused
    dismissBtn.classList.remove('search-visible');
    
    // Clear saved location from localStorage since we're returning to IP location
    localStorage.removeItem('weatherAppLocation');
    console.log('Cleared saved location from localStorage');
    
    // Reset LOCATION to force fresh IP detection
    LOCATION = null;
    
    // Reset IP location detection flag to ensure fresh detection
    ipLocationDetected = false;
    
    // Refresh weather for current location
    console.log('Refreshing weather for current location...'); // Debug log
    initWeatherApp();
  };
  
  searchResults.appendChild(currentLocationResult);
  console.log('Current location result added'); // Debug log
  
  if (results.length === 0) {
    console.log('No additional results to render'); // Debug log
    searchResults.classList.add('has-results'); // Show container for current location result
    return;
  }
  
  console.log('Creating', results.length, 'additional result items'); // Debug log
  
      // Create and append each result
    results.forEach((place, index) => {
      console.log(`Creating result ${index}:`, place.name); // Debug log
      
      const resultItem = document.createElement("div");
      resultItem.classList.add("search-result");
      
      // Build full location name with all available details
      let fullLocationName = place.name;
      
      // Add state/province if available
      if (place.admin1 && place.admin1 !== place.name) {
        fullLocationName += `, ${place.admin1}`;
      }
      
      // Add country
      fullLocationName += `, ${place.country}`;
      
      resultItem.textContent = fullLocationName;
    
    // Simple click handler
    resultItem.onclick = function() {
      console.log('=== CLICKED RESULT ==='); // Debug log
      console.log('Selected:', place.name); // Debug log
      console.log('Place data:', place); // Debug log
      
      // Build full location name with all available details for storage
      let fullLocationName = place.name;
      
      // Add state/province if available
      if (place.admin1 && place.admin1 !== place.name) {
        fullLocationName += `, ${place.admin1}`;
      }
      
      // Add country
      fullLocationName += `, ${place.country}`;
      
      // Update location with full name
      currentLocationName = fullLocationName;
      LOCATION = {
        latitude: place.latitude,
        longitude: place.longitude
      };
      
      // Save the selected location to localStorage
      saveLocation(currentLocationName, place.latitude, place.longitude);
      
      console.log('Updated currentLocationName:', currentLocationName); // Debug log
      console.log('Updated LOCATION:', LOCATION); // Debug log
      
      // Update search input to show selected location
      searchInput.value = currentLocationName;
      // Update the stored previous value for future focus/blur cycles
      searchInput.dataset.previousValue = currentLocationName;
      console.log('Search input now shows:', searchInput.value); // Debug log
      
      // Start transition to hide results
      searchResults.classList.remove('has-results'); // Start fade out transition
      
      // Wait for transition to complete before clearing content
      setTimeout(() => {
        // Clear results after transition
        searchResults.innerHTML = "";
        
        // Resize input to fit new content
        resizeSearchInput();
        
        // Show weather data
        weatherData.classList.remove('search-hidden');
        
        // Hide dismiss button since search is no longer focused
        dismissBtn.classList.remove('search-visible');
        
        // Refresh weather for new location
        console.log('About to call initWeatherApp()...'); // Debug log
        console.log('Current LOCATION before call:', LOCATION); // Debug log
        console.log('Current currentLocationName before call:', currentLocationName); // Debug log
        
        initWeatherApp();
        
        console.log('initWeatherApp() called'); // Debug log
      }, 250); // Wait for CSS transition to complete
    };
    
    // Add to DOM
    searchResults.appendChild(resultItem);
    console.log(`Result ${index} added`); // Debug log
  });
  
  console.log('All results rendered, total in DOM:', searchResults.children.length); // Debug log
}

// Debounce function to avoid excessive API calls
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Handle search input with debouncing
const debouncedSearch = debounce(async (query) => {
  // Skip if we're in the middle of dismissing
  if (isDismissing) {
    console.log('=== SEARCH SKIPPED - DISMISSING ==='); // Debug log
    return;
  }
  
  console.log('=== SEARCH TRIGGERED ==='); // Debug log
  console.log('Query:', query); // Debug log
  
  if (!query.trim()) {
    console.log('Empty query, showing only current location'); // Debug log
    // Show only current location when query is empty
    await showCurrentLocationResult();
    return;
  }
  
  console.log('Fetching locations...'); // Debug log
  const locations = await fetchLocations(query);
  console.log('API returned:', locations.length, 'locations'); // Debug log
  
  let results = locations;
  
  // Use Fuse.js for fuzzy searching if available
  if (fuse && locations.length > 0) {
    const fuzzyResults = fuse.search(query);
    if (fuzzyResults.length > 0) {
      results = fuzzyResults.map(r => r.item);
    }
  }
  
  console.log('Rendering', results.length, 'results'); // Debug log
  renderResults(results);
}, 300);

// Search input event listeners
searchInput.addEventListener('input', (e) => {
  // Skip if we're in the middle of dismissing
  if (isDismissing) {
    return;
  }
  
  console.log('=== SEARCH INPUT EVENT ==='); // Debug log
  console.log('Search input value:', e.target.value); // Debug log
  const query = e.target.value.trim();
  console.log('Query to search:', query); // Debug log
  debouncedSearch(query);
});

// Test if search input is working
searchInput.addEventListener('keydown', (e) => {
  // Skip if we're in the middle of dismissing
  if (isDismissing) {
    return;
  }
  
  console.log('=== KEYDOWN EVENT ==='); // Debug log
  console.log('Key pressed:', e.key); // Debug log
});

// On focus - clear input for typing and hide weather data
searchInput.addEventListener('focus', async () => {
  // Skip if we're in the middle of dismissing
  if (isDismissing) {
    return;
  }
  
  console.log('=== SEARCH FOCUSED ==='); // Debug log
  // Store the current value before clearing
  searchInput.dataset.previousValue = searchInput.value;
  searchInput.value = "";
  // Hide weather data with opacity transition
  weatherData.classList.add('search-hidden');
  // Show dismiss button
  dismissBtn.classList.add('search-visible');
  
  // Show current location result immediately
  await showCurrentLocationResult();
});

// On blur - restore previous value and show weather data
searchInput.addEventListener('blur', () => {
  // Skip if we're in the middle of dismissing
  if (isDismissing) {
    return;
  }
  
  console.log('=== SEARCH BLURRED ==='); // Debug log
  setTimeout(() => {
    // Only restore if no result was clicked and input is empty
    if (searchResults.children.length > 0 && !searchInput.value.trim()) {
      console.log('No result clicked and input empty, restoring previous value'); // Debug log
      searchInput.value = searchInput.dataset.previousValue || currentLocationName;
      
      // Start transition to hide search results
      searchResults.classList.remove('has-results'); // Start fade out transition
      
      // Wait for transition to complete before clearing content
      setTimeout(() => {
        searchResults.innerHTML = "";
      }, 250); // Wait for CSS transition to complete
    }
    // Show weather data with opacity transition
    weatherData.classList.remove('search-hidden');
    // Hide dismiss button
    dismissBtn.classList.remove('search-visible');
  }, 150); // Reduced delay for faster response
});

// Dismiss button functionality
dismissBtn.addEventListener('click', () => {
  // Set flag to prevent focus events during dismiss
  isDismissing = true;
  
  // Start transition to hide search results
  searchResults.classList.remove('has-results'); // Start fade out transition
  
  // Reset search input to current location name
  searchInput.value = currentLocationName;
  
  // Update the stored previous value for future focus/blur cycles
  searchInput.dataset.previousValue = currentLocationName;
  
  // Show weather data
  weatherData.classList.remove('search-hidden');
  
  // Remove focus from search input
  searchInput.blur();
  
  // Wait for search results transition to complete before clearing content
  setTimeout(() => {
    // Clear search results after transition
    searchResults.innerHTML = "";
    
    // Delay hiding dismiss button to allow transition to complete
    setTimeout(() => {
      // Hide dismiss button after transition
      dismissBtn.classList.remove('search-visible');
      
      // Resize input to fit new content after button is hidden
      setTimeout(() => {
        resizeSearchInput();
      }, 50);
    }, 250); // Wait for CSS transition to complete
  }, 250); // Wait for search results transition to complete
  
  // Reset flag after a longer delay to ensure all animations complete
  setTimeout(() => {
    isDismissing = false;
  }, 650); // Increased delay to account for both transitions
});



// Function to resize search input to fit content
function resizeSearchInput() {
  if (searchInput) {
    // Create a temporary span to measure text width
    const tempSpan = document.createElement('span');
    tempSpan.style.visibility = 'hidden';
    tempSpan.style.position = 'absolute';
    tempSpan.style.whiteSpace = 'pre';
    tempSpan.style.font = window.getComputedStyle(searchInput).font;
    tempSpan.textContent = searchInput.value || currentLocationName;
    
    document.body.appendChild(tempSpan);
    const textWidth = tempSpan.offsetWidth;
    document.body.removeChild(tempSpan);
    
    // Add padding and some extra space
    const totalWidth = Math.min(textWidth + 32, 200); // 32px for padding, max 200px
    
    // Set width without transition to avoid animation
    searchInput.style.transition = 'none';
    searchInput.style.width = totalWidth + 'px';
    
    // Force a reflow to apply the width change
    searchInput.offsetHeight;
    
    // Restore transition
    searchInput.style.transition = '';
    
    console.log('Resized search input to:', totalWidth, 'px for text:', searchInput.value || currentLocationName);
  }
}

// Function to show current location result
async function showCurrentLocationResult() {
  // Skip if we're in the middle of dismissing
  if (isDismissing) {
    console.log('=== SHOW CURRENT LOCATION SKIPPED - DISMISSING ==='); // Debug log
    return;
  }
  
  // Try to refresh IP location if needed
  await refreshIPLocationIfNeeded();
  
  // Clear any existing results
  searchResults.innerHTML = "";
  
  // Create current location result
  const currentLocationResult = document.createElement("div");
  currentLocationResult.classList.add("search-result");
  
  // First search result should ALWAYS show IP-based location
  let displayLocationName;
  if (ipLocationDetected && ipBasedLocationName && ipBasedLocationName !== "Loading...") {
    // We have a valid IP location - use it
    displayLocationName = ipBasedLocationName;
  } else {
    // IP location not detected yet - show generic placeholder
    displayLocationName = "Current location";
  }
  
  // Create icon and location name with proper spacing
  const locationIcon = document.createElement("span");
  locationIcon.classList.add("material-symbols-sharp", "location-icon");
  locationIcon.textContent = "near_me";
  
  const locationText = document.createElement("span");
  locationText.classList.add("location-text");
  locationText.textContent = displayLocationName;
  
  // Clear existing content and add icon + text
  currentLocationResult.innerHTML = "";
  currentLocationResult.appendChild(locationIcon);
  currentLocationResult.appendChild(locationText);
  
  // Handle current location selection
  currentLocationResult.onclick = function() {
    console.log('=== CURRENT LOCATION CLICKED ==='); // Debug log
    console.log('Returning to IP-based location:', displayLocationName); // Debug log
    
    // Update search input to show the display location name
    searchInput.value = displayLocationName;
    // Update the stored previous value for future focus/blur cycles
    searchInput.dataset.previousValue = displayLocationName;
    console.log('Search input now shows:', displayLocationName); // Debug log
    
    // Start transition to hide results
    searchResults.classList.remove('has-results'); // Start fade out transition
    
    // Wait for transition to complete before clearing content
    setTimeout(() => {
      // Clear results after transition
      searchResults.innerHTML = "";
      
      // Resize input to fit new content
      resizeSearchInput();
      
      // Show weather data
      weatherData.classList.remove('search-hidden');
      
      // Hide dismiss button since search is no longer focused
      dismissBtn.classList.remove('search-visible');
      
      // Clear saved location from localStorage since we're returning to IP location
      localStorage.removeItem('weatherAppLocation');
      console.log('Cleared saved location from localStorage');
      
      // Reset LOCATION to force fresh IP detection
      LOCATION = null;
      
      // Reset IP location detection flag to ensure fresh detection
      ipLocationDetected = false;
      
      // Refresh weather for current location
      console.log('Refreshing weather for current location...'); // Debug log
      initWeatherApp();
    }, 250); // Wait for CSS transition to complete
  };
  
  searchResults.appendChild(currentLocationResult);
  searchResults.classList.add('has-results'); // Show container
  console.log('Current location result shown'); // Debug log
}

// Search functionality will be initialized after DOM loads
console.log('Search functionality setup complete, waiting for DOM...'); // Debug log

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
  
  let icon, label, colorClass;
  
  switch (hazardType) {
    case 'Fire Risk':
      icon = '<span class="material-symbols-sharp">mode_heat</span>';
      label = 'Fire Risk';
      colorClass = 'hazard-hot';
      break;
    case 'Extreme Heat':
      icon = '<span class="material-symbols-sharp">heat</span>';
      label = 'Extreme Heat';
      colorClass = 'hazard-hot';
      break;
    case 'Heavy Rain':
      icon = '<span class="material-symbols-sharp">flood</span>';
      label = 'Heavy Rain';
      colorClass = 'hazard-cold';
      break;
    case 'Snow/Ice':
      icon = '<span class="material-symbols-sharp">severe_cold</span>';
      label = 'Snow/Ice';
      colorClass = 'hazard-cold';
      break;
    case 'Extreme Cold':
      icon = '<span class="material-symbols-sharp">severe_cold</span>';
      label = 'Extreme Cold';
      colorClass = 'hazard-cold';
      break;
    case 'Strong Winds':
      icon = '<span class="material-symbols-sharp">air</span>';
      label = 'Strong Winds';
      colorClass = 'hazard-wind';
      break;
    default:
      return { icon: '', label: '', show: false };
  }
  
  return { icon, label, show: true, colorClass };
}

// Show loading progress
function showLoadingProgress(step) {
  const comparison = weatherData.querySelector('.comparison');
  comparison.innerHTML = 'Loading...<br>&nbsp;';
}

// Main function to start the weather app
async function initWeatherApp() {
  // Prevent multiple simultaneous calls
  if (isWeatherAppRunning) {
    console.log('Weather app already running, skipping...'); // Debug log
    return;
  }
  
  isWeatherAppRunning = true;
  
  try {
    console.log('Starting weather app...'); // Debug log
    console.log('Current LOCATION:', LOCATION); // Debug log
    console.log('Current location name:', currentLocationName); // Debug log
    
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
      // Check if we already have a location (from search selection or saved location)
      if (LOCATION && LOCATION.latitude && LOCATION.longitude) {
        console.log('Using existing location from search:', LOCATION); // Debug log
        showLoadingProgress('Using selected location...');
      } else {
        // Check for saved location first, then IP location if none saved
        showLoadingProgress('Getting location...');
        console.log('Checking for saved location...'); // Debug log
        const hasSavedLocation = loadSavedLocation();
        
        if (!hasSavedLocation) {
          console.log('No saved location, getting from IP...'); // Debug log
          await getLocationFromIP();
        } else {
          console.log('Using saved location:', currentLocationName); // Debug log
        }
      }
      
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
  } finally {
    // Reset the flag when done
    isWeatherAppRunning = false;
  }
}

// Get approximate location from IP address
async function getLocationFromIP() {
  try {
    console.log('Fetching location from IP detection services...'); // Debug log
    console.log('User agent:', navigator.userAgent); // Debug log
    console.log('Is mobile:', isMobile); // Debug log
    
    // Try multiple IP detection services for better reliability
    const ipServices = [
      'https://ipapi.co/json/',
      'https://ipinfo.io/json',
      'https://api.ipify.org?format=json',
      'https://httpbin.org/ip'
    ];
    
    let locationData = null;
    let lastError = null;
    
    // Try each service until one works
    for (const serviceUrl of ipServices) {
      try {
        console.log(`Trying IP service: ${serviceUrl}`); // Debug log
        
        const response = await fetchWithTimeout(serviceUrl, {}, 8000);
        
        if (!response.ok) {
          throw new Error(`Service failed: ${response.status}`);
        }
        
        const data = await response.json();
        console.log(`Service ${serviceUrl} response:`, data); // Debug log
        
        // Parse different response formats
        if (data.latitude && data.longitude) {
          // ipapi.co format
          locationData = {
            latitude: data.latitude,
            longitude: data.longitude,
            city: data.city,
            country: data.country
          };
          break;
        } else if (data.loc) {
          // ipinfo.io format - loc is "lat,lng"
          const [lat, lng] = data.loc.split(',').map(Number);
          if (lat && lng) {
            locationData = {
              latitude: lat,
              longitude: lng,
              city: data.city,
              country: data.country
            };
            break;
          }
        } else if (data.ip) {
          // ipify.org format - just IP, skip this one
          continue;
        }
        
      } catch (err) {
        console.log(`Service ${serviceUrl} failed:`, err.message); // Debug log
        lastError = err;
        continue; // Try next service
      }
    }
    
    if (locationData) {
      LOCATION = {
        latitude: locationData.latitude,
        longitude: locationData.longitude
      };
      
      // Update current location name when detected from IP
      if (locationData.city) {
        const ipLocationName = `${locationData.city}, ${locationData.country}`;
        currentLocationName = ipLocationName;
        ipBasedLocationName = ipLocationName; // Store IP-based location separately
        ipLocationDetected = true; // Mark that IP location has been successfully detected
        if (searchInput) {
          searchInput.value = currentLocationName;
          // Resize input to fit the new location name
          resizeSearchInput();
        }
      }
      
      console.log('Location detected:', locationData.city, locationData.country);
    } else {
      throw new Error('All IP detection services failed');
    }
    
  } catch (err) {
    console.error('Failed to get location from IP, using default:', err);
    // Fallback to default coordinates if IP location fails
    LOCATION = {
      latitude: 32.08,
      longitude: 34.78
    };
    // Set generic fallback names
    currentLocationName = "Location unavailable";
    ipBasedLocationName = "Location unavailable";
    ipLocationDetected = true; // Mark that we have a fallback location
    if (searchInput) {
      searchInput.value = currentLocationName;
      resizeSearchInput();
    }
    console.log('Using fallback location:', LOCATION);
  }
}

// Fetch weather data from Open-Meteo API for 7 days (1 past + 6 future)
async function fetchWeatherData() {
  try {
    // Get current temperature and daily forecast
    const currentUrl = `https://api.open-meteo.com/v1/forecast?latitude=${LOCATION.latitude}&longitude=${LOCATION.longitude}&current=temperature_2m&timezone=auto`;
    const dailyUrl = `https://api.open-meteo.com/v1/forecast?latitude=${LOCATION.latitude}&longitude=${LOCATION.longitude}&daily=apparent_temperature_min,apparent_temperature_max,cloudcover_mean,precipitation_probability_max,precipitation_sum,windspeed_10m_max,relative_humidity_2m_mean&timezone=auto&past_days=1&forecast_days=7`;
    
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
  // CRITICAL FIX: Use the SAME data source as generateWeekPFI for perfect alignment
  // generateWeekPFI uses pfiData.slice(1), so precipitation must also use pfiData.slice(1)
  const slicedData = pfiData.slice(1); // [today, tomorrow, day3, day4, day5, day6]
  console.log('🔍 DEBUG: pfiData structure:', pfiData);
  console.log('🔍 DEBUG: pfiData.slice(1):', slicedData);
  console.log('🚨 CRITICAL FIX ACTIVE: Using slicedData for precipitation alignment');
  
  // CRITICAL FIX: The precipitation data MUST align with the day names generated by generateWeekPFI
  // Since generateWeekPFI now uses actual API dates, precipitation must also use the same approach
  // We need to process the data in the EXACT same order as the day names
  
  // IMPORTANT: The day names are generated from API dates in generateWeekPFI
  // So we need to process precipitation data in the same order
  // BUT: The day names start from index 1 in generateWeekPFI, so precipitation must also start from index 1
  // BUT: The day names start from index 1 in generateWeekPFI, so precipitation must also start from index 1
  for (let i = 1; i < 7; i++) { // Start from index 1 (same as generateWeekPFI day names)
    // Use the same data source and indexing as generateWeekPFI
    const dayData = slicedData[i]; // Use the sliced data (same as generateWeekPFI)
    
    console.log(`🔍 DEBUG: Processing precipitation for day ${i-1} using sliced data index ${i}:`, dayData);
    
    if (dayData && dayData.precipitation) {
      const precipDisplay = getPrecipitationDisplay(determinePrecipitationType(dayData.precipitation.rain, dayData.precipitation.snow));
      console.log(`🔍 DEBUG: Precipitation display for day ${i-1}:`, precipDisplay);
      weekPrecipitation.push(precipDisplay);
    } else {
      weekPrecipitation.push({ icon: '', label: '', show: false });
    }
  }
  console.log('🔍 DEBUG: Final weekPrecipitation array:', weekPrecipitation);
  
  // CRITICAL DEBUG: Show the exact alignment between day names and precipitation data
  console.log('🚨 CRITICAL DEBUG: Day names and precipitation alignment check:');
  for (let i = 0; i < 6; i++) {
    const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'][i];
    const precipData = weekPrecipitation[i];
    console.log(`🚨 Day ${i} (${dayName}): ${precipData.show ? 'SHOWS ' + precipData.label : 'shows nothing'}`);
  }
  
  // Generate hazard data for today and week
  const hazards = detectHazards(weatherData);
  const todayHazard = getHazardDisplay(hazards[1]); // Index 1 is today (after yesterday)
  
  const weekHazards = [];
  // CRITICAL FIX: Use the SAME data source as generateWeekPFI for perfect alignment
  // generateWeekPFI uses pfiData.slice(1), so hazards must also use hazards.slice(1)
  const slicedHazards = hazards.slice(1); // [today, tomorrow, day3, day4, day5, day6]
  
  // FIX: Generate hazard data using the SAME data source as generateWeekPFI
  // This ensures perfect alignment between day names and hazard data
  // Since precipitation now starts from index 1, hazards must also start from index 1
  for (let i = 1; i < 7; i++) { // Start from index 1 (same as precipitation and day names)
    const hazardData = slicedHazards[i]; // Use the sliced hazards data (same as generateWeekPFI)
    weekHazards.push(getHazardDisplay(hazardData));
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
  
  // CRITICAL FIX: Use ACTUAL dates from API data instead of calculating them dynamically
  // This ensures perfect alignment between actual dates and day names
  const dayNames = [];
  
  // Generate day names from ACTUAL API dates (starting from tomorrow)
  for (let i = 1; i < 7; i++) { // Start from tomorrow (index 1), go to day6 (index 6)
    if (pfiData[i] && pfiData[i].date) {
      // Parse the actual API date and format it
      const apiDate = new Date(pfiData[i].date);
      const dayName = apiDate.toLocaleDateString('en-US', { weekday: 'short' });
      dayNames.push(dayName);
      console.log(`🔍 DEBUG: generateWeekPFI - Day ${i} date: ${pfiData[i].date} → ${dayName}`);
    } else {
      // Fallback if date is missing
      const fallbackDate = new Date();
      fallbackDate.setDate(fallbackDate.getDate() + i);
      const dayName = fallbackDate.toLocaleDateString('en-US', { weekday: 'short' });
      dayNames.push(dayName);
      console.log(`🔍 DEBUG: generateWeekPFI - Day ${i} fallback date → ${dayName}`);
    }
  }
  
  console.log('Generated day names from API dates:', dayNames); // Debug log
  
  // CRITICAL FIX: Day names start from tomorrow, so data must also start from tomorrow
  // pfiData contains: [today, tomorrow, day3, day4, day5, day6]
  // Day names: [Sun, Mon, Tue, Wed, Thu, Fri] (starting from tomorrow)
  // To align: tomorrow's PFI for "Sun", day3's PFI for "Mon", day4's PFI for "Tue", etc.
  console.log('🔍 DEBUG: generateWeekPFI - pfiData received:', pfiData);
  console.log('🔍 DEBUG: generateWeekPFI - dayNames generated:', dayNames);
  // CRITICAL FIX: Day names start from tomorrow, so data must also start from tomorrow
  // pfiData contains: [today, tomorrow, day3, day4, day5, day6]
  // Day names: [actual day names from API dates]
  // To align: tomorrow's PFI for first day, day3's PFI for second day, etc.
  for (let i = 1; i < 7; i++) { // Start from tomorrow (index 1), go to day6 (index 6)
    console.log(`🔍 DEBUG: generateWeekPFI - Processing index ${i}:`, pfiData[i]);
    if (pfiData[i] && typeof pfiData[i].pfi === 'number') {
      pfiValues.push(pfiData[i].pfi);
      console.log(`🔍 DEBUG: generateWeekPFI - Added PFI value for index ${i}:`, pfiData[i].pfi);
    } else {
      console.warn(`Missing or invalid PFI data for day ${i}:`, pfiData[i]);
      pfiValues.push(null); // Fallback if data is missing
    }
  }
  console.log('🔍 DEBUG: generateWeekPFI - Final pfiValues:', pfiValues);
  
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
    
    // Apply color class based on hazard type
    hazardIcon.className = `hazard-icon ${comparisons.todayHazard.colorClass}`;
    hazardLabel.className = `hazard-label ${comparisons.todayHazard.colorClass}`;
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
  console.log('🔍 DEBUG: displayResults - weekPFI.dayNames:', comparisons.weekPFI.dayNames);
  console.log('🔍 DEBUG: displayResults - weekPFI.pfiValues:', comparisons.weekPFI.pfiValues);
  console.log('🔍 DEBUG: displayResults - weekPrecipitation:', comparisons.weekPrecipitation);
  console.log('🔍 DEBUG: displayResults - weekHazards:', comparisons.weekHazards);
  
  comparisons.weekPFI.dayNames.forEach((dayName, index) => {
    const dayItem = dayItems[index];
    const dayNameEl = dayItem.querySelector('.day-name');
    const dayPfiEl = dayItem.querySelector('.day-pfi');
    const precipitationWeek = dayItem.querySelector('.precipitation-week');
    const precipitationIcon = precipitationWeek.querySelector('.precipitation-icon');
    
    dayNameEl.textContent = dayName;
    console.log(`🔍 DEBUG: displayResults - Processing day ${index}: "${dayName}"`);
    
    // Display PFI value for each day
    if (comparisons.weekPFI.pfiValues[index] !== undefined) {
      dayPfiEl.textContent = `${Math.round(comparisons.weekPFI.pfiValues[index])}°`;
      console.log(`🔍 DEBUG: displayResults - Day ${index} "${dayName}" PFI: ${comparisons.weekPFI.pfiValues[index]}°`);
    } else {
      dayPfiEl.textContent = '--°';
      console.log(`🔍 DEBUG: displayResults - Day ${index} "${dayName}" PFI: --°`);
    }
    
    // Display precipitation icon for each day (only if no hazard)
    const hazardWeek = dayItem.querySelector('.hazard-week');
    const hazardIcon = hazardWeek.querySelector('.hazard-icon');
    
    if (comparisons.weekHazards && comparisons.weekHazards[index] && comparisons.weekHazards[index].show) {
      // Hazard takes priority - show hazard, hide precipitation
      // Apply color class based on hazard type
      hazardIcon.className = `hazard-icon ${comparisons.weekHazards[index].colorClass}`;
      hazardIcon.innerHTML = comparisons.weekHazards[index].icon;
      hazardWeek.style.display = 'flex';
      precipitationWeek.style.display = 'none';
      console.log(`🔍 DEBUG: displayResults - Day ${index} "${dayName}" showing HAZARD:`, comparisons.weekHazards[index]);
    } else if (comparisons.weekPrecipitation && comparisons.weekPrecipitation[index] && comparisons.weekPrecipitation[index].show) {
      // No hazard, show precipitation
      precipitationIcon.innerHTML = comparisons.weekPrecipitation[index].icon;
      precipitationWeek.style.display = 'flex';
      hazardWeek.style.display = 'none';
      console.log(`🔍 DEBUG: displayResults - Day ${index} "${dayName}" showing PRECIPITATION:`, comparisons.weekPrecipitation[index]);
    } else {
      // Neither hazard nor precipitation
      precipitationWeek.style.display = 'none';
      hazardWeek.style.display = 'none';
      console.log(`🔍 DEBUG: displayResults - Day ${index} "${dayName}" showing NOTHING`);
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

// Function to refresh IP location if needed
async function refreshIPLocationIfNeeded() {
  // Always try to refresh IP location if we don't have a valid one
  if (!ipLocationDetected || !ipBasedLocationName || ipBasedLocationName === "Loading...") {
    console.log('IP location not detected yet, refreshing...'); // Debug log
    try {
      await getLocationFromIP();
      console.log('IP location refreshed:', ipBasedLocationName); // Debug log
      
      // Update search input if it's currently showing the old location
      if (searchInput && searchInput.value === currentLocationName && currentLocationName !== ipBasedLocationName) {
        searchInput.value = ipBasedLocationName;
        resizeSearchInput();
      }
    } catch (err) {
      console.error('Failed to refresh IP location:', err);
    }
  }
}

// Start the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, starting weather app...'); // Debug log
  console.log('Initial currentLocationName:', currentLocationName); // Debug log
  
  // Load saved location first, then set search input value
  const hasSavedLocation = loadSavedLocation();
  if (hasSavedLocation) {
    console.log('Loaded saved location on startup:', currentLocationName);
  }
  
  // Set search input value immediately
  if (searchInput) {
    searchInput.value = currentLocationName;
    console.log('Search input initialized with:', currentLocationName); // Debug log
    console.log('Search input actual value:', searchInput.value); // Debug log
    
    // Resize input to fit content
    resizeSearchInput();
    
    // Explicitly blur the input to prevent automatic focus on iOS
    searchInput.blur();
    console.log('Search input blurred to prevent auto-focus');
  } else {
    console.log('Search input not found yet'); // Debug log
  }
  
  initWeatherApp();
  
  // Initialize search functionality after weather app starts
  setTimeout(() => {
    if (searchInput && searchResults && dismissBtn) {
      console.log('Initializing search functionality...'); // Debug log
      console.log('Search functionality ready!'); // Debug log
    } else {
      console.log('Search elements not ready, skipping search initialization'); // Debug log
    }
  }, 1000); // Wait 1 second for weather app to initialize
}); 