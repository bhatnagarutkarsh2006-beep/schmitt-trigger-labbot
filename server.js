// @ts-nocheck
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(express.json({ limit: "20kb" }));

const allowedOrigins = (
  process.env.FRONTEND_ORIGIN || ""
)
.split(",")
.map(x => x.trim())
.filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    callback(new Error("Origin not allowed"));
  }
}));

const PORT = process.env.PORT || 3000;

const MODEL = process.env.OPENAI_MODEL || "gpt-5-mini";

const SYSTEM_PROMPT = `
You are LabBot, an educational AI tutor inside a
college-level Schmitt Trigger Virtual Laboratory.

Your main subject is:
Schmitt Trigger using Operational Amplifier.

You can answer general educational questions too.

Language:
- Understand Hindi, English and Hinglish.
- Reply in the language used by the student.
- Explain difficult engineering concepts simply.
- Use formulas and step-by-step derivations when useful.

Topics:
- Schmitt Trigger
- Op-Amp
- Positive feedback
- UTP and LTP
- Hysteresis
- Waveforms
- Circuit operation
- Electronics
- Analog and digital electronics
- Viva questions
- Engineering mathematics and physics

Be friendly, patient and accurate.
Never pretend to have measured actual hardware.
If simulation values are provided, use those values.
If uncertain, clearly say so.

Keep answers understandable for a BTech student.
`;

app.get("/", (req, res) => {
  res.json({
    status: "online",
    assistant: "LabBot AI",
    message: "Virtual Lab AI backend is running."
  });
});

app.post("/api/chat", async (req, res) => {

  try {

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "Server API key is not configured."
      });
    }

    const { message, history, simulation } = req.body;

    if (
      typeof message !== "string" ||
      !message.trim() ||
      message.length > 4000
    ) {
      return res.status(400).json({
        error: "Please enter a valid question."
      });
    }

    const safeHistory = Array.isArray(history)
      ? history.slice(-10).filter(item =>
          item &&
          ["user", "assistant"].includes(item.role) &&
          typeof item.content === "string"
        )
      : [];

    const context = simulation &&
      typeof simulation === "object"
      ? `
Current virtual simulation parameters:
Vsat: ${Number(simulation.vsat)}
R1: ${Number(simulation.r1)} kΩ
R2: ${Number(simulation.r2)} kΩ
Amplitude: ${Number(simulation.amplitude)} V
Frequency: ${Number(simulation.frequency)} Hz
`
      : "Simulation parameters were not supplied.";

    const input = [
      {
        role: "user",
        content: context
      },
      ...safeHistory,
      {
        role: "user",
        content: message.trim()
      }
    ];

    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },

        body: JSON.stringify({
          model: MODEL,
          instructions: SYSTEM_PROMPT,
          input: input,
          max_output_tokens: 700
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {

      console.error("OpenAI API error:", data);

      return res.status(502).json({
        error: "AI service request failed. Check API billing, model and server settings."
      });
    }

    const answer = data.output
      ?.flatMap(item => item.content || [])
      .filter(item => item.type === "output_text")
      .map(item => item.text)
      .join("\n");

    if (!answer) {
      return res.status(502).json({
        error: "AI returned an empty response."
      });
    }

    res.json({
      reply: answer
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: "Something went wrong on the server."
    });

  }

});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`LabBot server running on port ${PORT}`);
});
