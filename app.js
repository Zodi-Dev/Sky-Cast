const API = {
  geocode: "https://geocoding-api.open-meteo.com/v1/search",
  forecast: "https://api.open-meteo.com/v1/forecast",
  nominatim: "https://nominatim.openstreetmap.org/search",
};

const DEFAULT_PLACE = {
  name: "Kanyakumari",
  country: "India",
  admin1: "Tamil Nadu",
  latitude: 8.0883,
  longitude: 77.5385,
  timezone: "Asia/Kolkata",
};

const LOCAL_ALIASES = {
  kanyakumari: DEFAULT_PLACE,
  "kanya kumari": DEFAULT_PLACE,
  kanniyakumari: DEFAULT_PLACE,
  capecomorin: DEFAULT_PLACE,
  "cape comorin": DEFAULT_PLACE,
  thuckly: {
    name: "Thuckalay",
    country: "India",
    admin1: "Tamil Nadu",
    latitude: 8.2441,
    longitude: 77.3203,
    timezone: "Asia/Kolkata",
  },
  thuckalay: {
    name: "Thuckalay",
    country: "India",
    admin1: "Tamil Nadu",
    latitude: 8.2441,
    longitude: 77.3203,
    timezone: "Asia/Kolkata",
  },
  thakkalai: {
    name: "Thuckalay",
    country: "India",
    admin1: "Tamil Nadu",
    latitude: 8.2441,
    longitude: 77.3203,
    timezone: "Asia/Kolkata",
  },
};

const WEATHER_CODES = {
  0: ["Clear sky", "clear"],
  1: ["Mainly clear", "clear"],
  2: ["Partly cloudy", "cloudy"],
  3: ["Overcast", "cloudy"],
  45: ["Fog", "cloudy"],
  48: ["Rime fog", "cloudy"],
  51: ["Light drizzle", "rainy"],
  53: ["Drizzle", "rainy"],
  55: ["Heavy drizzle", "rainy"],
  56: ["Freezing drizzle", "rainy"],
  57: ["Freezing drizzle", "rainy"],
  61: ["Light rain", "rainy"],
  63: ["Rain", "rainy"],
  65: ["Heavy rain", "rainy"],
  66: ["Freezing rain", "rainy"],
  67: ["Freezing rain", "rainy"],
  71: ["Light snow", "cloudy"],
  73: ["Snow", "cloudy"],
  75: ["Heavy snow", "cloudy"],
  77: ["Snow grains", "cloudy"],
  80: ["Light showers", "rainy"],
  81: ["Showers", "rainy"],
  82: ["Violent showers", "rainy"],
  85: ["Snow showers", "cloudy"],
  86: ["Snow showers", "cloudy"],
  95: ["Thunderstorm", "stormy"],
  96: ["Thunderstorm with hail", "stormy"],
  99: ["Thunderstorm with hail", "stormy"],
};

let unit = localStorage.getItem("weather-unit") || "celsius";
let activePlace = DEFAULT_PLACE;
let recentPlaces = JSON.parse(localStorage.getItem("weather-recent") || "[]");
let favoritePlaces = JSON.parse(
  localStorage.getItem("weather-favorites") || "[]",
);
let suggestionTimer;
let suggestionPlaces = [];

const $ = (selector) => document.querySelector(selector);
const els = {
  form: $("#searchForm"),
  input: $("#cityInput"),
  suggestions: $("#suggestions"),
  status: $("#statusLine"),
  place: $("#placeName"),
  localTime: $("#localTime"),
  condition: $("#conditionText"),
  temp: $("#temperature"),
  degree: $("#degreeSymbol"),
  feels: $("#feelsLike"),
  humidity: $("#humidity"),
  wind: $("#windSpeed"),
  pressure: $("#pressure"),
  range: $("#todayRange"),
  rainChance: $("#rainChance"),
  uv: $("#uvIndex"),
  cloudCover: $("#cloudCover"),
  precipitation: $("#precipitation"),
  visibility: $("#visibility"),
  sunrise: $("#sunrise"),
  sunset: $("#sunset"),
  art: $("#weatherArt"),
  hourly: $("#hourlyForecast"),
  daily: $("#dailyForecast"),
  recent: $("#recentList"),
  favorites: $("#favoritesList"),
  clearRecent: $("#clearRecent"),
  clearFavorites: $("#clearFavorites"),
  favoriteToggle: $("#favoriteToggle"),
  locationBtn: $("#locationBtn"),
};

function normalizeSearch(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ");
}

function samePlace(a, b) {
  return (
    Number(a.latitude).toFixed(3) === Number(b.latitude).toFixed(3) &&
    Number(a.longitude).toFixed(3) === Number(b.longitude).toFixed(3)
  );
}

function setStatus(message, isError = false) {
  els.status.textContent = message;
  els.status.classList.toggle("error", isError);
}

function weatherInfo(code) {
  return WEATHER_CODES[code] || ["Changing conditions", "cloudy"];
}

function unitParams() {
  return unit === "fahrenheit"
    ? "&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch"
    : "&temperature_unit=celsius&wind_speed_unit=kmh&precipitation_unit=mm";
}

function tempUnit() {
  return unit === "fahrenheit" ? "F" : "C";
}

function speedUnit() {
  return unit === "fahrenheit" ? "mph" : "km/h";
}

function precipUnit() {
  return unit === "fahrenheit" ? "in" : "mm";
}

function round(value) {
  return Number.isFinite(value) ? Math.round(value) : "--";
}

function formatTime(value, timezone) {
  return new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDay(value, timezone) {
  return new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function placeLabel(place) {
  const admin = place.admin1 ? `${place.admin1}, ` : "";
  return [place.name, `${admin}${place.country}`].filter(Boolean).join(", ");
}

function compactPlace(place) {
  return {
    name: place.name,
    country: place.country || "",
    admin1: place.admin1 || "",
    latitude: Number(place.latitude),
    longitude: Number(place.longitude),
    timezone: place.timezone || "auto",
  };
}

function saveRecent(place) {
  const compact = compactPlace(place);
  recentPlaces = [
    compact,
    ...recentPlaces.filter((item) => !samePlace(item, compact)),
  ].slice(0, 6);
  localStorage.setItem("weather-recent", JSON.stringify(recentPlaces));
  renderRecent();
}

function isFavorite(place) {
  return favoritePlaces.some((item) => samePlace(item, place));
}

function updateFavoriteButton() {
  const saved = isFavorite(activePlace);
  els.favoriteToggle.classList.toggle("active", saved);
  els.favoriteToggle.textContent = saved ? "★" : "☆";
  els.favoriteToggle.title = saved
    ? "Remove this location from favorites"
    : "Save this location to favorites";
}

function toggleFavorite() {
  const compact = compactPlace(activePlace);
  if (isFavorite(compact)) {
    favoritePlaces = favoritePlaces.filter((item) => !samePlace(item, compact));
  } else {
    favoritePlaces = [compact, ...favoritePlaces].slice(0, 10);
  }
  localStorage.setItem("weather-favorites", JSON.stringify(favoritePlaces));
  renderFavorites();
  updateFavoriteButton();
}

function renderPlaceChips(container, places, emptyText) {
  container.innerHTML = "";
  if (!places.length) {
    const empty = document.createElement("span");
    empty.className = "forecast-note";
    empty.textContent = emptyText;
    container.appendChild(empty);
    return;
  }

  places.forEach((place) => {
    const button = document.createElement("button");
    button.className = "chip";
    button.type = "button";
    button.textContent = place.name;
    button.title = placeLabel(place);
    button.addEventListener("click", () => loadWeather(place));
    container.appendChild(button);
  });
}

function renderRecent() {
  renderPlaceChips(els.recent, recentPlaces, "Your searches will appear here.");
}

function renderFavorites() {
  renderPlaceChips(
    els.favorites,
    favoritePlaces,
    "Save places with the star button.",
  );
}

async function openMeteoSearch(query, count = 5) {
  const url = `${API.geocode}?name=${encodeURIComponent(query)}&count=${count}&language=en&format=json`;
  const response = await fetch(url);
  if (!response.ok) return [];
  const data = await response.json();
  return data.results || [];
}

async function geocodeCity(query) {
  const normalized = normalizeSearch(query);
  if (LOCAL_ALIASES[normalized]) return LOCAL_ALIASES[normalized];

  const variants = [query, `${query}, Tamil Nadu`, `${query}, India`];
  for (const variant of variants) {
    const results = await openMeteoSearch(variant, 1);
    if (results.length) return results[0];
  }

  const backupUrl = `${API.nominatim}?q=${encodeURIComponent(`${query}, India`)}&format=json&limit=1&addressdetails=1`;
  const backupResponse = await fetch(backupUrl);
  if (backupResponse.ok) {
    const results = await backupResponse.json();
    if (results.length) {
      const result = results[0];
      const address = result.address || {};
      return {
        name:
          address.town ||
          address.city ||
          address.village ||
          address.county ||
          query,
        country: address.country || "",
        admin1: address.state || "",
        latitude: Number(result.lat),
        longitude: Number(result.lon),
        timezone: "Asia/Kolkata",
      };
    }
  }

  throw new Error(
    "No matching place found. Try adding the district or state, like 'Thuckalay Tamil Nadu'.",
  );
}

async function fetchSuggestions(query) {
  const normalized = normalizeSearch(query);
  const aliasMatches = Object.entries(LOCAL_ALIASES)
    .filter(([key]) => key.includes(normalized))
    .map(([, place]) => place);

  const remoteMatches =
    query.length >= 2 ? await openMeteoSearch(query, 5) : [];
  const combined = [...aliasMatches, ...remoteMatches].map(compactPlace);
  return combined
    .filter(
      (place, index, all) =>
        all.findIndex((item) => samePlace(item, place)) === index,
    )
    .slice(0, 6);
}

function renderSuggestions(places) {
  suggestionPlaces = places;
  els.suggestions.innerHTML = "";

  if (!places.length) {
    els.suggestions.classList.remove("open");
    return;
  }

  places.forEach((place, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("role", "option");
    button.innerHTML = `${place.name}<span>${place.admin1 ? `${place.admin1}, ` : ""}${place.country}</span>`;
    button.addEventListener("click", () => {
      els.input.value = "";
      els.suggestions.classList.remove("open");
      loadWeather(suggestionPlaces[index]);
    });
    els.suggestions.appendChild(button);
  });

  els.suggestions.classList.add("open");
}

async function fetchForecast(place) {
  const params = [
    `latitude=${place.latitude}`,
    `longitude=${place.longitude}`,
    `timezone=${encodeURIComponent(place.timezone || "auto")}`,
    "current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,surface_pressure,wind_speed_10m,precipitation,cloud_cover",
    "hourly=temperature_2m,weather_code,visibility,wind_speed_10m,precipitation_probability,precipitation,cloud_cover",
    "daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max",
  ].join("&");
  const response = await fetch(`${API.forecast}?${params}${unitParams()}`);
  if (!response.ok)
    throw new Error("Weather service is not responding right now.");
  return response.json();
}

function setWeatherTheme(visual) {
  document.body.dataset.weather = visual || "default";
  els.art.className = `weather-art ${visual}`;
}

function renderCurrent(place, data) {
  const current = data.current;
  const daily = data.daily;
  const hourly = data.hourly;
  const timezone = data.timezone || place.timezone || "UTC";
  const [description, visual] = weatherInfo(current.weather_code);

  els.place.textContent = placeLabel(place);
  els.localTime.textContent = `Local time ${formatTime(current.time, timezone)}`;
  els.condition.textContent = description;
  els.temp.textContent = round(current.temperature_2m);
  els.degree.textContent = tempUnit();
  els.feels.textContent = `${round(current.apparent_temperature)} ${tempUnit()}`;
  els.humidity.textContent = `${round(current.relative_humidity_2m)}%`;
  els.wind.textContent = `${round(current.wind_speed_10m)} ${speedUnit()}`;
  els.pressure.textContent = `${round(current.surface_pressure)} hPa`;
  els.range.textContent = `${round(daily.temperature_2m_min[0])} / ${round(daily.temperature_2m_max[0])} ${tempUnit()}`;
  els.rainChance.textContent = `Rain chance ${round(daily.precipitation_probability_max[0])}%`;
  els.uv.textContent = round(daily.uv_index_max[0]);
  els.cloudCover.textContent = `${round(current.cloud_cover)}%`;
  els.precipitation.textContent = `${current.precipitation ?? 0} ${precipUnit()}`;
  els.visibility.textContent = `${(hourly.visibility[0] / 1000).toFixed(1)} km`;
  els.sunrise.textContent = formatTime(daily.sunrise[0], timezone);
  els.sunset.textContent = formatTime(daily.sunset[0], timezone);

  setWeatherTheme(visual);
  updateFavoriteButton();
}

function forecastCard(title, temp, note, code) {
  const [, visual] = weatherInfo(code);
  const card = document.createElement("article");
  card.className = `forecast-card ${visual}`;
  card.innerHTML = `<div class="forecast-time"></div><div class="forecast-temp"></div><div class="forecast-note"></div>`;
  card.children[0].textContent = title;
  card.children[1].textContent = temp;
  card.children[2].textContent = note;
  return card;
}

function renderForecasts(data) {
  const now = new Date(data.current.time).getTime();
  const hourlyCards = data.hourly.time
    .map((time, index) => ({ time, index }))
    .filter((item) => new Date(item.time).getTime() >= now)
    .slice(0, 24)
    .map(({ time, index }) => {
      const [description] = weatherInfo(data.hourly.weather_code[index]);
      return forecastCard(
        formatTime(time, data.timezone),
        `${round(data.hourly.temperature_2m[index])} ${tempUnit()}`,
        `${description}. Rain ${round(data.hourly.precipitation_probability[index])}%. Cloud ${round(data.hourly.cloud_cover[index])}%.`,
        data.hourly.weather_code[index],
      );
    });

  const dailyCards = data.daily.time.map((time, index) => {
    const [description] = weatherInfo(data.daily.weather_code[index]);
    return forecastCard(
      formatDay(time, data.timezone),
      `${round(data.daily.temperature_2m_min[index])} / ${round(data.daily.temperature_2m_max[index])} ${tempUnit()}`,
      `${description}. Rain chance ${round(data.daily.precipitation_probability_max[index])}%.`,
      data.daily.weather_code[index],
    );
  });

  els.hourly.replaceChildren(...hourlyCards);
  els.daily.replaceChildren(...dailyCards);
}

async function loadWeather(place) {
  activePlace = compactPlace(place);
  setStatus(`Getting latest weather for ${activePlace.name}...`);
  els.suggestions.classList.remove("open");

  try {
    const data = await fetchForecast(activePlace);
    renderCurrent(activePlace, data);
    renderForecasts(data);
    saveRecent(activePlace);
    setStatus(
      `Updated ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`,
    );
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function searchCity(query) {
  setStatus(`Searching for ${query}...`);
  try {
    const place = await geocodeCity(query);
    els.input.value = "";
    await loadWeather(place);
  } catch (error) {
    setStatus(error.message, true);
  }
}

function useCurrentLocation() {
  if (!navigator.geolocation) {
    setStatus("Your browser does not support location lookup.", true);
    return;
  }

  setStatus("Asking your browser for location permission...");
  navigator.geolocation.getCurrentPosition(
    (position) => {
      loadWeather({
        name: "Current location",
        country: "",
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
    },
    () =>
      setStatus(
        "Location permission was blocked. Search for a city instead.",
        true,
      ),
  );
}

els.form.addEventListener("submit", (event) => {
  event.preventDefault();
  const query = els.input.value.trim();
  if (query) searchCity(query);
});

els.input.addEventListener("input", () => {
  clearTimeout(suggestionTimer);
  const query = els.input.value.trim();
  if (!query) {
    renderSuggestions([]);
    return;
  }

  suggestionTimer = setTimeout(async () => {
    renderSuggestions(await fetchSuggestions(query));
  }, 220);
});

els.input.addEventListener("keydown", (event) => {
  if (
    event.key === "Enter" &&
    suggestionPlaces.length &&
    els.suggestions.classList.contains("open")
  ) {
    event.preventDefault();
    els.input.value = "";
    loadWeather(suggestionPlaces[0]);
  }
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".search-box")) {
    els.suggestions.classList.remove("open");
  }
});

els.locationBtn.addEventListener("click", useCurrentLocation);
els.favoriteToggle.addEventListener("click", toggleFavorite);

els.clearRecent.addEventListener("click", () => {
  recentPlaces = [];
  localStorage.removeItem("weather-recent");
  renderRecent();
});

els.clearFavorites.addEventListener("click", () => {
  favoritePlaces = [];
  localStorage.removeItem("weather-favorites");
  renderFavorites();
  updateFavoriteButton();
});

document.querySelectorAll(".unit").forEach((button) => {
  button.classList.toggle("active", button.dataset.unit === unit);
  button.addEventListener("click", () => {
    unit = button.dataset.unit;
    localStorage.setItem("weather-unit", unit);
    document
      .querySelectorAll(".unit")
      .forEach((item) => item.classList.toggle("active", item === button));
    loadWeather(activePlace);
  });
});

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    const view = tab.dataset.view;
    document.querySelectorAll(".tab").forEach((item) => {
      item.classList.toggle("active", item === tab);
      item.setAttribute("aria-selected", String(item === tab));
    });
    els.hourly.classList.toggle("hidden", view !== "hourly");
    els.daily.classList.toggle("hidden", view !== "daily");
  });
});

renderRecent();
renderFavorites();
loadWeather(DEFAULT_PLACE);
