// AI Chat Assistant powered by Claude
// Handles both web chat and potential voice integrations

export async function handler(event) {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { message, training, checkOnly } = JSON.parse(event.body);

    // Check if API is configured
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (checkOnly) {
      return {
        statusCode: 200,
        body: JSON.stringify({ configured: !!apiKey })
      };
    }

    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'AI Chat is not configured. Please add ANTHROPIC_API_KEY to environment variables.' })
      };
    }

    if (!message) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Message is required' })
      };
    }

    // Build the system prompt from training data
    const systemPrompt = buildSystemPrompt(training || {});

    // Call Claude API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307', // Fast and cost-effective for chat
        max_tokens: 500,
        system: systemPrompt,
        messages: [
          { role: 'user', content: message }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Claude API error:', errorData);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to get AI response' })
      };
    }

    const data = await response.json();
    const aiResponse = data.content?.[0]?.text || 'Sorry, I could not generate a response.';

    return {
      statusCode: 200,
      body: JSON.stringify({
        response: aiResponse,
        usage: data.usage
      })
    };

  } catch (err) {
    console.error('AI Chat error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
}

function buildSystemPrompt(training) {
  const defaultTone = 'Friendly, warm Hawaiian hospitality. Use "Aloha" as a greeting occasionally. Be helpful and concise.';

  let prompt = `You are a helpful virtual concierge for Island Goodes, an adults-only vacation rental in Papaikou, Hawaii (near Hilo).

Your role is to answer questions from potential guests and current guests about the property, local area, and their stay.

PERSONALITY & TONE:
${training.toneInfo || defaultTone}

IMPORTANT GUIDELINES:
- Keep responses concise (2-4 sentences usually)
- Be accurate - only share information you know
- For booking questions, direct them to: islandgoodes.com/book or call 808-964-2291
- If you don't know something specific, suggest they contact the hosts
- Never make up information about rates, availability, or policies
- Be warm and welcoming - you represent Hawaiian hospitality

`;

  if (training.propertyInfo) {
    prompt += `\nPROPERTY INFORMATION:\n${training.propertyInfo}\n`;
  }

  if (training.locationInfo) {
    prompt += `\nLOCATION & ATTRACTIONS:\n${training.locationInfo}\n`;
  }

  if (training.faqInfo) {
    prompt += `\nFREQUENTLY ASKED QUESTIONS:\n${training.faqInfo}\n`;
  }

  prompt += `
CONTACT INFORMATION:
- Website: www.islandgoodes.com
- Phone: 808-964-2291
- Booking: islandgoodes.com/book
- Address: 27-2365 Hawaii Belt Rd, Papaikou, HI 96781

If asked about current availability or specific dates, always direct them to check online or call, as you don't have real-time availability data.`;

  return prompt;
}
