import { GoogleGenAI, Type } from "@google/genai";
import { DataPoint } from "../types";

export const generateDataset = async (promptText: string): Promise<DataPoint[]> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found in environment variables");
  }

  const ai = new GoogleGenAI({ apiKey });

  const systemInstruction = `
    You are a data generator for a vector database visualization.
    Generate distinct items based on the user's prompt.
    Map each item to a 2D coordinate system (x, y) where x and y are between 5 and 95.
    Ensure the distribution helps visualize clustering (some close together, some far apart).
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: promptText,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              label: { type: Type.STRING, description: "Short name of the item (e.g. Movie Title)" },
              description: { type: Type.STRING, description: "Very short description (5-10 words)" },
              x: { type: Type.NUMBER, description: "X coordinate (0-100)" },
              y: { type: Type.NUMBER, description: "Y coordinate (0-100)" },
            },
            required: ["label", "x", "y", "description"],
          },
        },
      },
    });

    const rawData = JSON.parse(response.text || "[]");
    
    // Transform to DataPoint with IDs
    return rawData.map((item: any, index: number) => ({
      id: `pt-${index}`,
      x: item.x,
      y: item.y,
      label: item.label,
      description: item.description,
    }));

  } catch (error) {
    console.error("Gemini Generation Error:", error);
    // Fallback data if API fails or is not present
    return Array.from({ length: 30 }).map((_, i) => ({
      id: `fallback-${i}`,
      x: Math.random() * 90 + 5,
      y: Math.random() * 90 + 5,
      label: `Item ${i}`,
      description: "Random generated item",
    }));
  }
};
