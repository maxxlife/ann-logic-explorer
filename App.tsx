import React, { useState, useEffect, useMemo } from 'react';
import { AlgorithmType, DataPoint, Cluster } from './types';
import { INITIAL_PROMPT, DEFAULT_TOP_K, DEFAULT_N_CLUSTERS, DEFAULT_N_PROBES } from './constants';
import { generateDataset } from './services/geminiService';
import { trainIVFIndex, performSearch } from './services/annLogic';
import Visualizer from './components/Visualizer';
import { Settings, Play, Database, RefreshCw, Info, CheckCircle2, AlertTriangle, Search } from 'lucide-react';

const App: React.FC = () => {
  // Data State
  const [points, setPoints] = useState<DataPoint[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [prompt, setPrompt] = useState(INITIAL_PROMPT);
  const [loading, setLoading] = useState(false);
  const [trained, setTrained] = useState(false);

  // Search State
  const [queryPoint, setQueryPoint] = useState({ x: 50, y: 50 });
  const [algorithm, setAlgorithm] = useState<AlgorithmType>(AlgorithmType.IVF);
  
  // Parameters
  const [nClusters, setNClusters] = useState(DEFAULT_N_CLUSTERS);
  const [nProbes, setNProbes] = useState(DEFAULT_N_PROBES);
  const [topK, setTopK] = useState(DEFAULT_TOP_K);

  // Results
  const [searchResult, setSearchResult] = useState<{
    foundNeighbors: DataPoint[];
    scannedCount: number;
    highlightedClusters: number[];
    recall: number;
  }>({ foundNeighbors: [], scannedCount: 0, highlightedClusters: [], recall: 0 });

  // 1. Initial Data Load
  useEffect(() => {
    handleGenerateData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Generate Data via Gemini
  const handleGenerateData = async () => {
    setLoading(true);
    setTrained(false);
    try {
      const data = await generateDataset(prompt);
      setPoints(data);
      // Automatically train index when data arrives
      trainIndex(data, nClusters);
    } catch (e) {
      console.error(e);
      alert("Failed to generate data. Check API Key.");
    } finally {
      setLoading(false);
    }
  };

  // 3. Train Index (K-Means)
  const trainIndex = (data: DataPoint[], k: number) => {
    const { clusters: newClusters, assignedPoints } = trainIVFIndex(data, k);
    setClusters(newClusters);
    setPoints(assignedPoints);
    setTrained(true);
  };

  // Re-train if cluster count changes
  useEffect(() => {
    if (points.length > 0) {
      trainIndex(points, nClusters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nClusters]);

  // 4. Perform Search (Real-time)
  useEffect(() => {
    if (points.length === 0) return;

    const result = performSearch(
      points,
      clusters,
      queryPoint,
      algorithm,
      topK,
      nProbes
    );
    setSearchResult(result);
  }, [points, clusters, queryPoint, algorithm, topK, nProbes]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-pink-500/30">
      
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-tr from-pink-500 to-indigo-500 rounded-lg">
              <Database className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              ANN Logic Explorer
            </h1>
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-400">
             <span className="hidden sm:inline">Powered by Gemini 2.0 Flash</span>
             <a href="https://github.com" target="_blank" rel="noreferrer" className="hover:text-white transition">Github</a>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Controls */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Data Generation Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <RefreshCw className="w-4 h-4" /> Dataset Generation
            </h2>
            <div className="space-y-4">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all outline-none resize-none h-24"
                placeholder="Describe the dataset you want to visualize..."
              />
              <button
                onClick={handleGenerateData}
                disabled={loading}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
                ) : (
                  <Search className="w-4 h-4" />
                )}
                {loading ? "Generating..." : "Generate with Gemini"}
              </button>
            </div>
          </div>

          {/* Algorithm Settings Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
             <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Settings className="w-4 h-4" /> Algorithm Control
            </h2>
            
            <div className="space-y-6">
              {/* Algorithm Toggle */}
              <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
                <button
                  onClick={() => setAlgorithm(AlgorithmType.BRUTE_FORCE)}
                  className={`flex-1 py-2 text-xs font-medium rounded-md transition-all ${
                    algorithm === AlgorithmType.BRUTE_FORCE ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  Brute Force (Exact)
                </button>
                <button
                  onClick={() => setAlgorithm(AlgorithmType.IVF)}
                  className={`flex-1 py-2 text-xs font-medium rounded-md transition-all ${
                    algorithm === AlgorithmType.IVF ? 'bg-pink-600 text-white shadow' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  IVF (Approximate)
                </button>
              </div>

              {/* Sliders */}
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-slate-400">Total Clusters (Voronoi Cells)</span>
                    <span className="font-mono text-indigo-400">{nClusters}</span>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="10"
                    value={nClusters}
                    onChange={(e) => setNClusters(Number(e.target.value))}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>

                <div className={`transition-opacity ${algorithm === AlgorithmType.IVF ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
                   <div className="flex justify-between text-xs mb-2">
                    <span className="text-slate-400">N Probes (Cells to Check)</span>
                    <span className="font-mono text-pink-400">{nProbes}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max={nClusters}
                    value={nProbes}
                    onChange={(e) => setNProbes(Number(e.target.value))}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-pink-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Higher probes = More accuracy, slower speed.
                  </p>
                </div>

                 <div>
                   <div className="flex justify-between text-xs mb-2">
                    <span className="text-slate-400">Top K (Neighbors)</span>
                    <span className="font-mono text-white">{topK}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={topK}
                    onChange={(e) => setTopK(Number(e.target.value))}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-slate-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Stats Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
             <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Info className="w-4 h-4" /> Performance Metrics
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <div className="text-xs text-slate-500 mb-1">Scanned</div>
                <div className="text-xl font-mono font-bold text-white">
                  {searchResult.scannedCount} <span className="text-xs text-slate-600 font-normal">/ {points.length}</span>
                </div>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <div className="text-xs text-slate-500 mb-1">Recall (Accuracy)</div>
                <div className={`text-xl font-mono font-bold ${
                  searchResult.recall === 100 ? 'text-green-400' : 
                  searchResult.recall > 80 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {searchResult.recall.toFixed(0)}%
                </div>
              </div>
            </div>
             {algorithm === AlgorithmType.IVF && searchResult.recall < 100 && (
                <div className="mt-4 flex gap-2 text-xs text-yellow-500 items-start">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <p>Increase "N Probes" to improve accuracy at the cost of scanning more points.</p>
                </div>
              )}
          </div>
        </div>

        {/* Right Column: Visualization */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <Visualizer
            points={points}
            clusters={clusters}
            queryPoint={queryPoint}
            onQueryChange={(x, y) => setQueryPoint({ x, y })}
            algorithm={algorithm}
            nProbes={nProbes}
            topK={topK}
            highlightedClusters={searchResult.highlightedClusters}
            neighbors={searchResult.foundNeighbors}
          />

          {/* Results List */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h3 className="text-lg font-medium text-white mb-4">
              Nearest Neighbors Results
            </h3>
            {searchResult.foundNeighbors.length === 0 ? (
              <p className="text-slate-500 italic">No neighbors found.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {searchResult.foundNeighbors.map((neighbor, idx) => (
                  <div key={neighbor.id} className="flex items-start gap-3 p-3 bg-slate-950 rounded-lg border border-slate-800 hover:border-pink-500/50 transition-colors">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center text-xs font-mono border border-slate-700">
                      {idx + 1}
                    </div>
                    <div>
                      <div className="font-medium text-slate-200">{neighbor.label}</div>
                      <div className="text-xs text-slate-500 mt-1">{neighbor.description}</div>
                      <div className="text-[10px] text-slate-600 font-mono mt-2">
                        Coords: ({Math.round(neighbor.x)}, {Math.round(neighbor.y)})
                        {algorithm === AlgorithmType.IVF && ` • Cluster ${neighbor.clusterId}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
