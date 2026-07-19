const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

function loadClient() {
  const customPath = path.join(__dirname, '..', 'config', 'clients', 'amore.json');
  const examplePath = path.join(__dirname, '..', 'config', 'clients', 'amore.example.json');
  const file = fs.existsSync(customPath) ? customPath : examplePath;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function classify(text) {
  const lower = text.toLowerCase();
  const legal = /(lawsuit|lawyer|attorney|legal advice|court|arrest|charged|custody|divorce|eviction|sue|case)/i.test(lower);
  const complaint = /(scam|fraud|rip.?off|terrible|hate|cancel|refund|complaint|worst)/i.test(lower);
  const sensitive = /(suicide|kill myself|abuse|threat|emergency|danger)/i.test(lower);
  return { legal, complaint, sensitive, flagged: legal || complaint || sensitive };
}

async function draftReply(comment) {
  const flags = classify(comment.text);
  const client = loadClient();
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is missing from .env');
  }

  const openai = new OpenAI({ apiKey });
  const prompt = `You reply to TikTok comments for ${client.businessName || 'Amore LegalShield'}.

Client facts:
${JSON.stringify(client, null, 2)}

Comment from ${comment.author}: "${comment.text}"

Rules:
- Return only one reply.
- Keep it under 24 words.
- Sound warm, confident, natural, and human.
- Never give legal advice.
- Never invent pricing, guarantees, or plan details.
- For legal questions, invite them to connect through the official website.
- For hostile comments, stay calm and do not argue.
- Use at most one emoji.`;

  const response = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
    temperature: 0.5,
    messages: [
      { role: 'system', content: 'You are a careful social media customer service assistant.' },
      { role: 'user', content: prompt },
    ],
  });

  const reply = response.choices?.[0]?.message?.content?.trim();
  if (!reply) throw new Error('The AI returned an empty reply.');
  return { reply, flags };
}

module.exports = { draftReply, classify };
