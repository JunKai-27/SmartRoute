// utils/routeOptimizer.js
// Route Optimization Engine — Phase 3
// Algorithm: Nearest-Neighbour Heuristic + 2-Opt Local Search
// Data source: Google Maps Distance Matrix API

const GOOGLE_MAPS_API_KEY = "YOUR_GOOGLE_MAPS_API_KEY"; // ← replace this

// ─── Step 1: Fetch Distance Matrix from Google Maps ───────
// Returns a 2D array: distanceMatrix[i][j] = distance in metres
// between stops[i] and stops[j]
export async function fetchDistanceMatrix(stops) {
  // Build pipe-separated origin/destination strings
  const coords = stops
    .map(s => `${s.latitude},${s.longitude}`)
    .join("|");

  const url =
    `https://maps.googleapis.com/maps/api/distancematrix/json` +
    `?origins=${coords}` +
    `&destinations=${coords}` +
    `&mode=driving` +
    `&key=${GOOGLE_MAPS_API_KEY}`;

  console.log("🗺️ Fetching distance matrix...");
  const response = await fetch(url);
  const data     = await response.json();

  if (data.status !== "OK") {
    throw new Error(`Distance Matrix API error: ${data.status}`);
  }

  // Parse response into a 2D matrix
  const n      = stops.length;
  const matrix = Array.from({ length: n }, () => Array(n).fill(0));

  data.rows.forEach((row, i) => {
    row.elements.forEach((element, j) => {
      if (element.status === "OK") {
        matrix[i][j] = element.distance.value; // metres
      } else {
        // Fallback to straight-line distance if API element fails
        matrix[i][j] = haversineDistance(stops[i], stops[j]);
      }
    });
  });

  return matrix;
}

// ─── Step 2: Nearest-Neighbour Heuristic ─────────────────
// Builds an initial route greedily: always pick the closest
// unvisited stop next. Returns an ordered index array.
export function nearestNeighbour(distanceMatrix, startIndex = 0) {
  const n       = distanceMatrix.length;
  const visited = new Array(n).fill(false);
  const route   = [startIndex];
  visited[startIndex] = true;

  for (let step = 1; step < n; step++) {
    const last    = route[route.length - 1];
    let minDist   = Infinity;
    let nextStop  = -1;

    for (let j = 0; j < n; j++) {
      if (!visited[j] && distanceMatrix[last][j] < minDist) {
        minDist  = distanceMatrix[last][j];
        nextStop = j;
      }
    }

    visited[nextStop] = true;
    route.push(nextStop);
  }

  return route;
}

// ─── Step 3: 2-Opt Local Search Improvement ──────────────
// Iteratively reverses sub-segments of the route to remove
// crossing paths. Continues until no improvement is found.
export function twoOpt(route, distanceMatrix) {
  const n          = route.length;
  let improved     = true;
  let bestRoute    = [...route];
  let bestDistance = totalRouteDistance(bestRoute, distanceMatrix);

  while (improved) {
    improved = false;

    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 2; j < n; j++) {
        // Reverse the segment between i+1 and j
        const newRoute = [
          ...bestRoute.slice(0, i + 1),
          ...bestRoute.slice(i + 1, j + 1).reverse(),
          ...bestRoute.slice(j + 1),
        ];

        const newDistance = totalRouteDistance(newRoute, distanceMatrix);

        if (newDistance < bestDistance) {
          bestRoute    = newRoute;
          bestDistance = newDistance;
          improved     = true;
        }
      }
    }
  }

  return { route: bestRoute, distance: bestDistance };
}

// ─── Step 4: Full Optimization Pipeline ──────────────────
// Combines all steps: fetch matrix → nearest neighbour → 2-opt
// Returns the optimized stop sequence and total distance
export async function optimizeRoute(stops) {
  if (stops.length === 0) throw new Error("No stops provided");
  if (stops.length === 1) return { optimizedStops: stops, totalDistance: 0 };

  // Fetch real road distances
  const distanceMatrix = await fetchDistanceMatrix(stops);
  console.log("📊 Distance matrix ready");

  // Build initial route with nearest-neighbour
  const initialRoute = nearestNeighbour(distanceMatrix, 0);
  const initialDist  = totalRouteDistance(initialRoute, distanceMatrix);
  console.log(`🔢 Initial route distance: ${(initialDist / 1000).toFixed(2)} km`);

  // Improve with 2-opt
  const { route: optimizedRoute, distance: optimizedDist } = twoOpt(
    initialRoute, distanceMatrix
  );
  console.log(`✅ Optimized distance: ${(optimizedDist / 1000).toFixed(2)} km`);
  console.log(`💡 Saved: ${((initialDist - optimizedDist) / 1000).toFixed(2)} km`);

  // Map index sequence back to stop objects
  const optimizedStops = optimizedRoute.map(i => stops[i]);

  return {
    optimizedStops,
    totalDistance:    optimizedDist,      // metres
    initialDistance:  initialDist,        // metres
    savedDistance:    initialDist - optimizedDist,
    savingPercent:    initialDist > 0
      ? (((initialDist - optimizedDist) / initialDist) * 100).toFixed(1)
      : "0",
  };
}

// ─── Helpers ─────────────────────────────────────────────

// Total distance of a route given an index array
function totalRouteDistance(route, matrix) {
  let total = 0;
  for (let i = 0; i < route.length - 1; i++) {
    total += matrix[route[i]][route[i + 1]];
  }
  return total;
}

// Straight-line fallback distance (Haversine formula) in metres
function haversineDistance(a, b) {
  const R    = 6371000; // Earth radius in metres
  const dLat = toRad(b.latitude  - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const c = sinLat * sinLat +
    Math.cos(toRad(a.latitude)) *
    Math.cos(toRad(b.latitude)) *
    sinLon * sinLon;
  return R * 2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c));
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}