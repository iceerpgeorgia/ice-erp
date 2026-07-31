import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface TroubleshootingRequest {
  userDescription: string;
  pageContext: string;
  userEmail: string;
}

interface StructuredIssue {
  type: string;
  severity: string;
  affectedAreas: string[];
  extractedEntities: string[];
  errorCodes: string[];
  urls: string[];
  keywords: string[];
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

    // Intelligent prompt structuring
    const structured = structureIssue(userDescription, pageContext);
    const generatedPrompt = generateStructuredPrompt(structured, userDescription, pageContext);

    // Store in database
    const record = await prisma.troubleshooting_prompts.create({
      data: {
        user_email: userEmail,
        page_context: pageContext,
        original_description: userDescription,
        generated_prompt: generatedPrompt,
        model_used: 'structured-analysis',
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

// Extract structured information from user description
function structureIssue(description: string, context: string): StructuredIssue {
  const lowerDesc = description.toLowerCase();
  
  // Issue Type Detection
  let type = 'General Issue';
  if (lowerDesc.match(/error|exception|crash|fail|failed|failure/)) type = 'Error/Exception';
  else if (lowerDesc.match(/slow|lag|delay|timeout|hang|freeze|performance/)) type = 'Performance Issue';
  else if (lowerDesc.match(/not work|doesn't work|broken|can't|cannot|unable/)) type = 'Functionality Bug';
  else if (lowerDesc.match(/want|need|please add|feature|request|suggest/)) type = 'Feature Request';
  else if (lowerDesc.match(/data.*missing|missing.*data|lost|disappeared/)) type = 'Data Issue';
  
  // Severity Detection
  let severity = 'Medium';
  if (lowerDesc.match(/critical|urgent|blocking|down|broken|won't|not work/)) severity = 'Critical';
  else if (lowerDesc.match(/high|important|major|serious/)) severity = 'High';
  else if (lowerDesc.match(/minor|small|slight|little/)) severity = 'Low';
  
  // Extract Error Codes (pattern: CODE, ERR-001, 404, HTTP 500, etc.)
  const errorCodePattern = /(\b[A-Z0-9]+-?\d+\b|error[:\s]*(code)?[:\s]*([A-Z0-9]+|\d+)|status[:\s](\d{3})|ERR[:\s]*(\d+))/gi;
  const errorCodes = [...(description.match(errorCodePattern) || [])].map(e => e.trim()).slice(0, 5);
  
  // Extract URLs
  const urlPattern = /(https?:\/\/[^\s]+|\/[a-z-]+(?:\/[a-z0-9-]+)*)/gi;
  const urls = [...(description.match(urlPattern) || [])].map(u => u.trim()).slice(0, 5);
  
  // Extract entities (table names, function names, pages)
  const entityPattern = /([a-z_]+_table|bank_transactions|payments|jobs|waybill|project|counteragent|[a-z]+\.[a-z]+)/gi;
  const entities = [...(description.match(entityPattern) || [])].map(e => e.toLowerCase()).filter((e, i, a) => a.indexOf(e) === i).slice(0, 8);
  
  // Affected areas (pages, modules, features)
  let affectedAreas: string[] = [];
  if (context && context !== 'General') {
    affectedAreas.push(context);
  }
  if (lowerDesc.includes('bank')) affectedAreas.push('Bank Transactions');
  if (lowerDesc.includes('payment')) affectedAreas.push('Payments');
  if (lowerDesc.includes('job') && !lowerDesc.includes('error')) affectedAreas.push('Jobs');
  if (lowerDesc.includes('waybill')) affectedAreas.push('Waybills');
  if (lowerDesc.includes('project')) affectedAreas.push('Projects');
  if (lowerDesc.includes('export')) affectedAreas.push('Export/Import');
  if (lowerDesc.includes('filter') || lowerDesc.includes('search')) affectedAreas.push('Filtering/Search');
  if (lowerDesc.includes('api')) affectedAreas.push('API');
  if (lowerDesc.includes('database') || lowerDesc.includes('schema')) affectedAreas.push('Database');
  
  affectedAreas = [...new Set(affectedAreas)]; // Remove duplicates
  
  // Keywords for quick reference
  const keywords = lowerDesc
    .split(/[\s,;.!?]+/)
    .filter(w => w.length > 3 && !['that', 'this', 'from', 'with', 'when', 'have', 'been'].includes(w))
    .slice(0, 10);
  
  return {
    type,
    severity,
    affectedAreas: affectedAreas.length > 0 ? affectedAreas : ['General'],
    extractedEntities: entities,
    errorCodes,
    urls,
    keywords,
  };
}

// Generate structured troubleshooting prompt
function generateStructuredPrompt(structured: StructuredIssue, description: string, context: string): string {
  let prompt = '';
  
  // Header with classification
  prompt += `📋 **ISSUE CLASSIFICATION**\n`;
  prompt += `Type: ${structured.type}\n`;
  prompt += `Severity: ${structured.severity}\n`;
  prompt += `Context: ${context || 'General'}\n`;
  prompt += `Affected Areas: ${structured.affectedAreas.join(', ')}\n\n`;
  
  // User Description Section
  prompt += `📝 **USER DESCRIPTION**\n`;
  prompt += `"${description}"\n\n`;
  
  // Extracted Information
  if (structured.errorCodes.length > 0) {
    prompt += `🔴 **ERROR CODES DETECTED**\n`;
    prompt += structured.errorCodes.map(ec => `- ${ec}`).join('\n') + '\n\n';
  }
  
  if (structured.urls.length > 0) {
    prompt += `🔗 **RELATED URLS/ENDPOINTS**\n`;
    prompt += structured.urls.map(url => `- ${url}`).join('\n') + '\n\n';
  }
  
  if (structured.extractedEntities.length > 0) {
    prompt += `🔧 **ENTITIES MENTIONED**\n`;
    prompt += structured.extractedEntities.map(e => `- ${e}`).join('\n') + '\n\n';
  }
  
  // Issue-Specific Recommendations
  prompt += `💡 **INVESTIGATION CHECKLIST**\n`;
  
  if (structured.type === 'Error/Exception') {
    prompt += `- [ ] Check application error logs for stack trace\n`;
    prompt += `- [ ] Verify error codes: ${structured.errorCodes.join(', ') || 'See description'}\n`;
    prompt += `- [ ] Test with minimal dataset to isolate issue\n`;
    prompt += `- [ ] Review recent deployments or code changes\n`;
    prompt += `- [ ] Check system resources (disk, memory, connections)\n`;
    prompt += `- [ ] Verify database connectivity and schema\n`;
  } else if (structured.type === 'Performance Issue') {
    prompt += `- [ ] Monitor CPU, memory, and I/O during issue\n`;
    prompt += `- [ ] Profile slow database queries\n`;
    prompt += `- [ ] Check query indexes on affected tables\n`;
    prompt += `- [ ] Measure network latency\n`;
    prompt += `- [ ] Review caching strategy\n`;
    prompt += `- [ ] Test with production-scale data\n`;
  } else if (structured.type === 'Functionality Bug') {
    prompt += `- [ ] Reproduce issue with exact steps\n`;
    prompt += `- [ ] Verify affected areas: ${structured.affectedAreas.join(', ')}\n`;
    prompt += `- [ ] Check browser console for errors\n`;
    prompt += `- [ ] Review related code changes\n`;
    prompt += `- [ ] Test in different browsers/environments\n`;
    prompt += `- [ ] Confirm no data corruption\n`;
  } else if (structured.type === 'Data Issue') {
    prompt += `- [ ] Query affected tables/records\n`;
    prompt += `- [ ] Check audit logs for changes\n`;
    prompt += `- [ ] Verify data integrity constraints\n`;
    prompt += `- [ ] Review recent imports/exports\n`;
    prompt += `- [ ] Check for failed transactions\n`;
    prompt += `- [ ] Examine backup/recovery status\n`;
  } else {
    prompt += `- [ ] Document issue reproducibility\n`;
    prompt += `- [ ] Gather browser/system information\n`;
    prompt += `- [ ] Check logs for related messages\n`;
    prompt += `- [ ] Review related configuration\n`;
    prompt += `- [ ] Test in isolated environment\n`;
  }
  
  prompt += `\n`;
  
  // Required Information
  prompt += `📊 **INFORMATION NEEDED FOR RESOLUTION**\n`;
  if (structured.errorCodes.length === 0 && structured.type === 'Error/Exception') {
    prompt += `- Error/exception message and full stack trace\n`;
  }
  prompt += `- Steps to reproduce\n`;
  prompt += `- When issue started (date/time)\n`;
  prompt += `- Affected user count or scope\n`;
  prompt += `- Related entries: ${structured.extractedEntities.slice(0, 3).join(', ') || 'IDs, UUIDs, payment codes'}\n`;
  prompt += `- Environment (dev/staging/production)\n`;
  
  prompt += `\n`;
  
  // Related keywords for context
  prompt += `🏷️ **KEYWORDS FOR RESEARCH**\n`;
  prompt += structured.keywords.join(', ') + '\n\n';
  
  // Quick action
  prompt += `⚡ **NEXT STEP**\n`;
  prompt += `Provide the requested information above along with relevant logs or screenshots to accelerate resolution.\n`;
  
  return prompt;
}
