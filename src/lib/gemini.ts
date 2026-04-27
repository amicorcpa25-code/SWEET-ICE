import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function generateTaskSuggestions(sector: string) {
  const fetchWithRetry = async (retries = 2, delay = 1000): Promise<any[]> => {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Gerar uma lista exaustiva e bem variada de EXATAMENTE 50 tarefas cotidianas, operacionais e estratégicas para uma empresa do ramo: "${sector}". 
        
        Divida a lista mentalmente para cobrir:
        - 15 tarefas de Manutenção e Higiene técnica.
        - 15 tarefas de Produção e Controle de Qualidade.
        - 10 tarefas de Atendimento e Vendas.
        - 10 tarefas de Gestão Financeira/Adm.
        
        Regras:
        1. Retorne APENAS um array JSON de objetos: [{"title": "TITULO", "description": "COMO FAZER"}].
        2. Títulos curtos e em MAIÚSCULAS.
        3. Descrições detalhadas e instrutivas.
        4. NÃO pule números, garanta 50 itens.`,
        config: {
          responseMimeType: "application/json",
        },
      });

      const data = JSON.parse(response.text);
      return Array.isArray(data) ? data : (data.tasks || []);
    } catch (err: any) {
      if (err?.error?.code === 503 || err?.error?.status === 'UNAVAILABLE' || err?.message?.includes('503') || err?.message?.includes('UNAVAILABLE')) {
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, delay + Math.random() * 1000));
          return fetchWithRetry(retries - 1, delay * 2);
        }
        console.warn("Gemini service temporarily unavailable (503) for task suggestions.");
        return [];
      }
      console.error("Erro ao processar sugestões do Gemini:", err);
      return [];
    }
  };

  return fetchWithRetry();
}
