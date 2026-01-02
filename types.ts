export interface DataPoint {
  id: string;
  x: number;
  y: number;
  label: string;
  description: string;
  clusterId?: number; // Assigned during IVF training
}

export interface Cluster {
  id: number;
  cx: number;
  cy: number;
  color: string;
}

export interface SearchStats {
  algorithm: 'BRUTE_FORCE' | 'IVF';
  totalPoints: number;
  scannedPoints: number;
  foundNeighbors: DataPoint[];
  accuracy: number; // Percentage overlap with brute force
  timeTaken: number;
}

export enum AlgorithmType {
  BRUTE_FORCE = 'BRUTE_FORCE',
  IVF = 'IVF', // Inverted File Index
}
