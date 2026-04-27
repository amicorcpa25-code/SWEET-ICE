import { GoogleGenAI, Type } from "@google/genai";

const API_KEY = process.env.GEMINI_API_KEY;
const genAI = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;

export interface DayInfo {
  type: 'HOLIDAY' | 'CELEBRATION';
  level?: 'NATIONAL' | 'STATE' | 'MUNICIPAL';
  name: string;
}

const nationalHolidays: Record<string, string> = {
  "01-01": "Confraternização Universal",
  "21-04": "Tiradentes",
  "01-05": "Dia do Trabalho",
  "07-09": "Independência do Brasil",
  "12-10": "Nossa Senhora Aparecida",
  "02-11": "Finados",
  "15-11": "Proclamação da República",
  "20-11": "Dia da Consciência Negra",
  "25-12": "Natal",
};

// Global cache for day info
const dayInfoCache: Record<string, DayInfo | null> = {};
let serviceUnavailableUntil = 0;

function getMovingHolidays(year: number): Record<string, string> {
  const holidays: Record<string, string> = {};
  
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  const easter = new Date(year, month - 1, day);
  
  const formatDate = (date: Date) => {
    return `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  };

  holidays[formatDate(easter)] = "Páscoa";
  
  const carnival = new Date(easter);
  carnival.setDate(easter.getDate() - 47);
  holidays[formatDate(carnival)] = "Carnaval";

  const goodFriday = new Date(easter);
  goodFriday.setDate(easter.getDate() - 2);
  holidays[formatDate(goodFriday)] = "Sexta-feira Santa";

  const corpusChristi = new Date(easter);
  corpusChristi.setDate(easter.getDate() + 60);
  holidays[formatDate(corpusChristi)] = "Corpus Christi";

  return holidays;
}

export async function getDayInfo(date: Date): Promise<DayInfo | null> {
  const dayMonth = `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  const year = date.getFullYear();
  const cacheKey = `${dayMonth}-${year}`;
  
  // Check local cache first
  if (dayInfoCache[cacheKey] !== undefined) {
    return dayInfoCache[cacheKey];
  }

  if (nationalHolidays[dayMonth]) {
    const info: DayInfo = { type: 'HOLIDAY', level: 'NATIONAL', name: nationalHolidays[dayMonth] };
    dayInfoCache[cacheKey] = info;
    return info;
  }

  const moving = getMovingHolidays(year);
  if (moving[dayMonth]) {
    const info: DayInfo = { type: 'HOLIDAY', level: 'NATIONAL', name: moving[dayMonth] };
    dayInfoCache[cacheKey] = info;
    return info;
  }

  if (!genAI) return null;

  // Simple circuit breaker
  if (Date.now() < serviceUnavailableUntil) {
    return null;
  }

  const fetchWithRetry = async (retries = 2, delay = 1000): Promise<DayInfo | null> => {
    try {
      const prompt = `Você é um historiador especialista em feriados brasileiros. 
      Analise a data: ${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}.
      É um feriado nacional, estadual ou municipal importante, ou uma celebração católica tradicional no Brasil?
      
      Foques em nomes curtos e amigáveis.`;
      
      const response = await genAI.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              type: {
                type: Type.STRING,
                enum: ["HOLIDAY", "CELEBRATION"],
                description: "Tipo do evento"
              },
              level: {
                type: Type.STRING,
                enum: ["NATIONAL", "STATE", "MUNICIPAL"],
                nullable: true,
                description: "Nível do feriado"
              },
              name: {
                type: Type.STRING,
                description: "Nome do evento"
              },
              exists: {
                type: Type.BOOLEAN,
                description: "Se existe um evento nesta data"
              }
            },
            required: ["exists"]
          }
        }
      });
      
      const text = response.text;
      if (!text || text.trim() === 'null') {
        dayInfoCache[cacheKey] = null;
        return null;
      }
      
      const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      
      if (!parsed || parsed.exists === false || !parsed.name) {
        dayInfoCache[cacheKey] = null;
        return null;
      }

      const info: DayInfo = {
        type: parsed.type || 'CELEBRATION',
        level: parsed.level || undefined,
        name: parsed.name
      };
      
      dayInfoCache[cacheKey] = info;
      return info;
    } catch (err: any) {
      // Check for 503 error or UNAVAILABLE
      if (err?.error?.code === 503 || err?.error?.status === 'UNAVAILABLE' || err?.message?.includes('503') || err?.message?.includes('UNAVAILABLE')) {
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, delay + Math.random() * 1000));
          return fetchWithRetry(retries - 1, delay * 2);
        }
        // Trip circuit breaker for 60 seconds if exhausted
        serviceUnavailableUntil = Date.now() + 60000;
        console.warn("Gemini service temporarily unavailable (503). Skipping info fetch for a while.");
        return null;
      }
      
      console.error("Error fetching day info from Gemini:", err);
      return null;
    }
  };

  return fetchWithRetry();
}
