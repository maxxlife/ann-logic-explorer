import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { DataPoint, Cluster, AlgorithmType } from '../types';
import { CANVAS_SIZE, CLUSTER_COLORS } from '../constants';

interface VisualizerProps {
  points: DataPoint[];
  clusters: Cluster[];
  queryPoint: { x: number; y: number };
  onQueryChange: (x: number, y: number) => void;
  algorithm: AlgorithmType;
  nProbes: number;
  topK: number;
  highlightedClusters: number[]; // IDs of clusters being searched
  neighbors: DataPoint[]; // The final results
}

const Visualizer: React.FC<VisualizerProps> = ({
  points,
  clusters,
  queryPoint,
  onQueryChange,
  algorithm,
  nProbes,
  topK,
  highlightedClusters,
  neighbors,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous

    const width = CANVAS_SIZE;
    const height = CANVAS_SIZE;
    const padding = 20;

    // Scales
    const xScale = d3.scaleLinear().domain([0, 100]).range([padding, width - padding]);
    const yScale = d3.scaleLinear().domain([100, 0]).range([padding, height - padding]); // Flip Y for cartesian feel

    // 1. Draw Voronoi Cells (IVF Visualization)
    if (algorithm === AlgorithmType.IVF && clusters.length > 0) {
      // Create Delaunay triangulation from cluster centers
      const delaunay = d3.Delaunay.from(
        clusters.map(c => [xScale(c.cx), yScale(c.cy)])
      );
      const voronoi = delaunay.voronoi([0, 0, width, height]);

      clusters.forEach((cluster, i) => {
        const isHighlighted = highlightedClusters.includes(cluster.id);
        
        svg.append("path")
          .attr("d", voronoi.renderCell(i))
          .attr("fill", cluster.color)
          .attr("opacity", isHighlighted ? 0.2 : 0.05)
          .attr("stroke", isHighlighted ? cluster.color : "#334155")
          .attr("stroke-width", isHighlighted ? 2 : 1);
          
        // Cluster Centroid
        svg.append("circle")
          .attr("cx", xScale(cluster.cx))
          .attr("cy", yScale(cluster.cy))
          .attr("r", 4)
          .attr("fill", cluster.color)
          .attr("stroke", "#fff")
          .attr("stroke-width", 1)
          .attr("class", "pointer-events-none");
      });
    }

    // 2. Draw Data Points
    svg.selectAll(".data-point")
      .data(points)
      .enter()
      .append("circle")
      .attr("class", "data-point")
      .attr("cx", d => xScale(d.x))
      .attr("cy", d => yScale(d.y))
      .attr("r", d => {
        const isNeighbor = neighbors.some(n => n.id === d.id);
        return isNeighbor ? 6 : 3;
      })
      .attr("fill", d => {
        const isNeighbor = neighbors.some(n => n.id === d.id);
        if (isNeighbor) return "#ffffff"; // White for top K
        
        if (algorithm === AlgorithmType.IVF) {
           const inScannedCluster = d.clusterId !== undefined && highlightedClusters.includes(d.clusterId);
           // If we are in IVF mode, dim points that aren't even scanned
           if (!inScannedCluster) return "#334155"; // Dark gray for ignored
           // Return cluster color if scanned but not a neighbor
           const cluster = clusters.find(c => c.id === d.clusterId);
           return cluster ? cluster.color : "#94a3b8";
        }
        return "#94a3b8"; // Default slate-400 for Brute Force non-neighbors
      })
      .attr("stroke", d => {
         const isNeighbor = neighbors.some(n => n.id === d.id);
         return isNeighbor ? "#ec4899" : "none";
      })
      .attr("stroke-width", 2)
      .attr("opacity", d => {
        if (algorithm === AlgorithmType.IVF) {
           const inScannedCluster = d.clusterId !== undefined && highlightedClusters.includes(d.clusterId);
           return inScannedCluster ? 1 : 0.3;
        }
        return 1;
      });

    // 3. Draw Connecting Lines to Neighbors
    neighbors.forEach(n => {
      svg.append("line")
        .attr("x1", xScale(queryPoint.x))
        .attr("y1", yScale(queryPoint.y))
        .attr("x2", xScale(n.x))
        .attr("y2", yScale(n.y))
        .attr("stroke", "#ec4899")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "4 2")
        .attr("opacity", 0.6);
    });

    // 4. Draw Query Point (Draggable)
    const drag = d3.drag<SVGCircleElement, unknown>()
      .on("drag", (event) => {
        // Inverse scale to get data coordinates
        const newX = Math.max(0, Math.min(100, xScale.invert(event.x)));
        const newY = Math.max(0, Math.min(100, yScale.invert(event.y)));
        onQueryChange(newX, newY);
      });

    const queryCircle = svg.append("circle")
      .attr("cx", xScale(queryPoint.x))
      .attr("cy", yScale(queryPoint.y))
      .attr("r", 8)
      .attr("fill", "#ec4899")
      .attr("stroke", "#fff")
      .attr("stroke-width", 2)
      .style("cursor", "grab")
      .call(drag);
    
    // Pulse animation for query point
    const pulse = () => {
      queryCircle.transition()
        .duration(1000)
        .attr("r", 12)
        .attr("opacity", 0.8)
        .transition()
        .duration(1000)
        .attr("r", 8)
        .attr("opacity", 1)
        .on("end", pulse);
    };
    pulse();

    // Query Label
    svg.append("text")
      .attr("x", xScale(queryPoint.x))
      .attr("y", yScale(queryPoint.y) - 15)
      .attr("text-anchor", "middle")
      .attr("fill", "#ec4899")
      .attr("font-weight", "bold")
      .attr("font-size", "12px")
      .text("Target");

  }, [points, clusters, queryPoint, algorithm, highlightedClusters, neighbors]); // Re-render when these change

  return (
    <div className="relative rounded-xl overflow-hidden shadow-2xl border border-slate-700 bg-slate-800">
      <svg
        ref={svgRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        className="block"
      />
      
      {/* Legend Overlay */}
      <div className="absolute top-4 right-4 bg-slate-900/80 backdrop-blur p-3 rounded-lg text-xs space-y-2 border border-slate-700">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-pink-500 border border-white"></div>
          <span>Query Target (Drag me!)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-white border border-pink-500"></div>
          <span>Nearest Neighbor</span>
        </div>
        {algorithm === AlgorithmType.IVF && (
          <>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-blue-500/20 border border-blue-500"></div>
              <span>Scanned Cell</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-slate-700"></div>
              <span>Ignored Point (Pruned)</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Visualizer;
