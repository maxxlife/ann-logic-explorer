import { DataPoint, Cluster, AlgorithmType } from '../types';
import { CLUSTER_COLORS } from '../constants';

// Euclidean Distance Squared (faster than sqrt for comparison)
const distSq = (p1: {x: number, y: number}, p2: {x: number, y: number}) => {
  return Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2);
};

// Simple K-Means implementation to build the "Index"
export const trainIVFIndex = (points: DataPoint[], k: number): { clusters: Cluster[], assignedPoints: DataPoint[] } => {
  if (points.length === 0) return { clusters: [], assignedPoints: [] };

  // 1. Initialize random centroids
  let clusters: Cluster[] = Array.from({ length: k }).map((_, i) => ({
    id: i,
    cx: Math.random() * 100,
    cy: Math.random() * 100,
    color: CLUSTER_COLORS[i % CLUSTER_COLORS.length],
  }));

  let assignedPoints = [...points];
  let changed = true;
  let iterations = 0;
  const MAX_ITERATIONS = 20;

  while (changed && iterations < MAX_ITERATIONS) {
    changed = false;
    iterations++;

    // 2. Assign points to nearest centroid
    const newAssignments: { [key: number]: DataPoint[] } = {};
    clusters.forEach(c => newAssignments[c.id] = []);

    assignedPoints = assignedPoints.map(p => {
      let minDist = Infinity;
      let clusterId = -1;
      
      clusters.forEach(c => {
        const d = distSq(p, {x: c.cx, y: c.cy});
        if (d < minDist) {
          minDist = d;
          clusterId = c.id;
        }
      });

      if (p.clusterId !== clusterId) changed = true;
      
      const newP = { ...p, clusterId };
      newAssignments[clusterId].push(newP);
      return newP;
    });

    // 3. Update centroids
    clusters = clusters.map(c => {
      const assigned = newAssignments[c.id];
      if (assigned.length === 0) return c; // Don't move if empty (naive handling)
      
      const sumX = assigned.reduce((sum, p) => sum + p.x, 0);
      const sumY = assigned.reduce((sum, p) => sum + p.y, 0);
      
      return {
        ...c,
        cx: sumX / assigned.length,
        cy: sumY / assigned.length,
      };
    });
  }

  return { clusters, assignedPoints };
};

export const performSearch = (
  points: DataPoint[],
  clusters: Cluster[],
  query: { x: number, y: number },
  algorithm: AlgorithmType,
  topK: number,
  nProbes: number
) => {
  
  // 1. Brute Force Ground Truth (for accuracy comparison)
  const allDistances = points.map(p => ({
    ...p,
    distance: distSq(p, query)
  })).sort((a, b) => a.distance - b.distance);
  
  const trueNeighbors = allDistances.slice(0, topK);

  // 2. Execute selected algorithm
  let scannedCount = 0;
  let candidates: typeof allDistances = [];
  let highlightedClusters: number[] = [];

  if (algorithm === AlgorithmType.BRUTE_FORCE) {
    scannedCount = points.length;
    candidates = allDistances;
  } else {
    // IVF Search
    // a. Find nearest 'nProbes' clusters
    const clusterDistances = clusters.map(c => ({
      id: c.id,
      dist: distSq({x: c.cx, y: c.cy}, query)
    })).sort((a, b) => a.dist - b.dist);

    highlightedClusters = clusterDistances.slice(0, nProbes).map(c => c.id);

    // b. Scan points ONLY in those clusters
    const candidatePoints = points.filter(p => 
      p.clusterId !== undefined && highlightedClusters.includes(p.clusterId)
    );

    scannedCount = candidatePoints.length;
    
    candidates = candidatePoints.map(p => ({
      ...p,
      distance: distSq(p, query)
    })).sort((a, b) => a.distance - b.distance);
  }

  const foundNeighbors = candidates.slice(0, topK);

  // Calculate recall (accuracy)
  // How many of foundNeighbors are actually in trueNeighbors?
  const trueIds = new Set(trueNeighbors.map(n => n.id));
  const overlap = foundNeighbors.filter(n => trueIds.has(n.id)).length;
  const recall = trueNeighbors.length > 0 ? (overlap / trueNeighbors.length) * 100 : 100;

  return {
    foundNeighbors,
    scannedCount,
    highlightedClusters,
    recall
  };
};
