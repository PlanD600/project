import { GoogleGenAI } from "@google/genai";

if (!process.env.API_KEY) {
  console.warn("API_KEY environment variable not set. AI features will be disabled.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "disabled" });

export const summarizeText = async (textToSummarize: string): Promise<string> => {
  if (!process.env.API_KEY || process.env.API_KEY === 'disabled') {
    return "מפתח ה-API לא הוגדר. אנא הגדר את משתנה הסביבה API_KEY כדי להשתמש בתכונה זו.";
  }
  
  try {
    const prompt = `אתה עוזר ניהול פרויקטים. המשימה שלך היא לסכם את שרשור הדיון הבא לנקודות מפתח תמציתיות בבולטים ולרשימת פריטי פעולה ברורים.

    דיון:
    ---
    ${textToSummarize}
    ---
    
    ספק סיכום בפורמט הבא (בעברית):
    **נקודות מפתח:**
    * [נקודה 1]
    * [נקודה 2]
    
    **פריטי פעולה:**
    * [פריט פעולה 1]
    * [פריט פעולה 2]`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-04-17',
      contents: prompt,
    });

    return response.text;
  } catch (error) {
    console.error("Error summarizing text with Gemini API:", error);
    if (error instanceof Error) {
      return `אירעה שגיאה בתקשורת עם הבינה המלאכותית: ${error.message}`;
    }
    return "אירעה שגיאה לא ידועה בתקשורת עם הבינה המלאכותית.";
  }
};
