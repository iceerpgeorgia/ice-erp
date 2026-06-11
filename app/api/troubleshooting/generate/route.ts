import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const OLLAMA_API = process.env.OLLAMA_API || 'http://localhost:11434/api/generate';
const MODEL_NAME = 'mistral:7b'; // Lightweight open-source model

interface TroubleshootingRequest {
  userDescription: string;
  pageContext: string;
  userEmail: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: TroubleshootingRequest = await request.json();
    const { userDescription, pageContext, userEmail } = body;

    if (!userDescription || !userEmail) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Call Ollama LLM to generate a prompt
    const systemPrompt = `You are a technical support assistant. A user has described a problem. 
Your task is to analyze their description and generate a clear, structured troubleshooting prompt that:
1. Identifies the core problem
2. Lists potential root causes
3. Suggests investigation steps
4. Recommends solution approaches

Keep the response concise (max 300 words) and actionable.`;

    const userPrompt = `User's problem description:\n"${userDescription}"\n\nPage/Context: ${pageContext || 'General'}`;

    let generatedPrompt = '';

    try {
      // Call Ollama API (streaming not used here for simplicity)
      const ollamaResponse = await fetch(OLLAMA_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: MODEL_NAME,
          prompt: `${systemPrompt}\n\n${userPrompt}`,
          stream: false,
          temperature: 0.7,
          num_predict: 300,
        }),
      });

      if (!ollamaResponse.ok) {
        throw new Error(`Ollama API error: ${ollamaResponse.status}`);
      }

      const ollamaData = await ollamaResponse.json();
      generatedPrompt = ollamaData.response || '';
    } catch (ollama_error) {
      console.error('Ollama error:', ollama_error);
      // Fallback to rule-based generation if Ollama is unavailable
      generatedPrompt = generateFallbackPrompt(userDescription, pageContext);
    }

    // Store in database
    const record = await prisma.troubleshooting_prompts.create({
      data: {
        user_email: userEmail,
        page_context: pageContext,
        original_description: userDescription,
        generated_prompt: generatedPrompt,
        model_used: 'mistral-7b',
      },
    });

    return NextResponse.json({
      success: true,
      uuid: record.uuid,
      generatedPrompt,
      originalDescription: userDescription,
    });
  } catch (error) {
    console.error('Troubleshooting API error:', error);
    return NextResponse.json(
      { error: 'Failed to generate troubleshooting prompt' },
      { status: 500 }
    );
  }
}

// Fallback rule-based prompt generator
function generateFallbackPrompt(description: string, context: string): string {
  const keywords = description.toLowerCase();
  let prompt = '';

  if (keywords.includes('error') || keywords.includes('fail')) {
    prompt = `**Issue Analysis:**\n\nBased on your description: "${description}"\n\n`;
    prompt += `**Suspected Root Causes:**\n- Configuration error\n- System resource limitation\n- External service unavailability\n- Data inconsistency\n\n`;
    prompt += `**Investigation Steps:**\n1. Check error logs for detailed messages\n2. Verify system resources (CPU, memory, disk)\n3. Test with minimal dataset\n4. Review recent changes\n\n`;
    prompt += `**Page Context:** ${context || 'General'}\n\n`;
    prompt += `**Next Action:** Review logs and provide error codes for faster resolution.`;
  } else if (keywords.includes('slow') || keywords.includes('performance')) {
    prompt = `**Performance Issue:**\n\nYour concern: "${description}"\n\n`;
    prompt += `**Potential Causes:**\n- Database query optimization needed\n- Memory leak\n- High network latency\n- CPU throttling\n\n`;
    prompt += `**Actions to Take:**\n1. Monitor system metrics\n2. Check query execution times\n3. Review caching strategies\n4. Test with production-size data\n\n`;
    prompt += `**Context:** ${context || 'Unknown'}\n\nProvide monitoring data to help diagnose further.`;
  } else {
    prompt = `**Troubleshooting Request:**\n\nProblem: "${description}"\n\n`;
    prompt += `**Analysis Needed:**\n1. Gather detailed error messages and logs\n2. Document reproducible steps\n3. Note system configuration\n4. Check recent deployments or changes\n\n`;
    prompt += `**Page/Feature:** ${context || 'General'}\n\n`;
    prompt += `Please provide the above information for thorough investigation.`;
  }

  return prompt;
}
