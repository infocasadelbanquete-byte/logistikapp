import { GoogleGenAI, Type } from "@google/genai";

// Initialize Gemini API client safely
const getAiClient = () => {
  try {
    const key = process.env.API_KEY;
    if (!key) return null;
    return new GoogleGenAI({ apiKey: key });
  } catch (e) {
    console.error("Fallo al inicializar Gemini SDK", e);
    return null;
  }
};

const ai = getAiClient();

export const isAiConfigured = () => !!process.env.API_KEY && !!ai;

export const generateInventoryDescription = async (itemName: string, category: string): Promise<string> => {
  if (!isAiConfigured() || !ai) return "Descripción no disponible (Falta Configuración de IA).";
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Escribe una descripción corta y vendedora para: ${itemName}, Categoría: ${category}.`,
    });
    return response.text?.trim() || "Descripción no disponible.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Descripción para mobiliario de eventos.";
  }
};

export const suggestEventPackage = async (eventType: string, guestCount: number) => {
  if (!isAiConfigured() || !ai) return null;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Sugiere mobiliario para "${eventType}" con ${guestCount} invitados. Responde en JSON.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                suggestions: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            name: { type: Type.STRING },
                            quantity: { type: Type.NUMBER },
                            reason: { type: Type.STRING }
                        }
                    }
                },
                advice: { type: Type.STRING }
            }
        }
      }
    });

    const text = response.text;
    if (!text) return null;
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Planning Error:", error);
    return null;
  }
};