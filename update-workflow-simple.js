#!/usr/bin/env node

const fs = require('fs');

/**
 * Simple script to update the GPT model, temperature, and system prompt in n8n workflow
 */

function updateWorkflow(templatePath, workflowPath, options = {}) {
  try {
    // Validate input files
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template file not found: ${templatePath}`);
    }
    if (!fs.existsSync(workflowPath)) {
      throw new Error(`Workflow file not found: ${workflowPath}`);
    }

    // Read the template file
    const templateContent = fs.readFileSync(templatePath, 'utf8');

    // Extract content after frontmatter (after the second ---)
    const frontmatterEnd = templateContent.indexOf('---', 4);
    let systemPrompt;

    if (frontmatterEnd > 0) {
      systemPrompt = templateContent.slice(frontmatterEnd + 3).trim();
    } else {
      // No frontmatter, use entire content
      systemPrompt = templateContent.trim();
    }

    // Clean up template variables that won't work in this context
    systemPrompt = systemPrompt
      .replace(/\{\{project_type\}\}/g, 'challenge')
      .replace(/\{\{specific_tech\}\}/g, 'solution')
      .replace(/\{\{#if urgent\}\}/g, '')
      .replace(/\{\{\/if\}\}/g, '')
      .replace(/Ready to start immediately - I can have the initial setup running within 24 hours\./g,
               'Ready to start immediately - I can have the initial setup running within 24 hours if needed.');

    // Read the workflow file
    const workflowContent = fs.readFileSync(workflowPath, 'utf8');
    const workflow = JSON.parse(workflowContent);

    // Find the "Generate AI Proposal (HTTP)" node
    const proposalNode = workflow.nodes.find(node =>
      node.name === "Generate AI Proposal (HTTP)" ||
      node.id === "generate-ai-proposal"
    );

    if (!proposalNode) {
      throw new Error('Could not find "Generate AI Proposal (HTTP)" node in workflow');
    }

    console.log(`Found node: ${proposalNode.name}`);

    // Configuration options with defaults
    const config = {
      model: options.model || 'gpt-5',
      temperature: options.temperature || 1,
      maxTokens: options.maxTokens || 400,
      ...options
    };

    // Create the new jsonBody with updated model, temperature, and system prompt
    // Use the improved logic that ensures template applies to ALL jobs
    const newJsonBody = `={{ JSON.stringify({
  model: '${config.model}',
  messages: [
    {
      role: 'system',
      content: 'You are a professional Upwork proposal writer specializing in AWS and DevOps projects. Always use the exact template provided in the user message for every proposal, adapting it to match specific job requirements while maintaining the core message and personality. Keep all proposals EXACTLY under 2000 characters.'
    },
    {
      role: 'user',
      content: \`Generate a winning Upwork proposal using this EXACT template for the job:

TEMPLATE TO USE:
${systemPrompt.replace(/`/g, '\\`').replace(/\$/g, '\\$')}

JOB DETAILS:
Job Title: \${$json.jobTitle}
Description: \${$json.description}
Required Skills: \${$json.skills}
Budget: \${$json.budgetType} - $\${$json.budget}
Experience Level: \${$json.experienceLevel}
Proposals: \${$json.proposals} (competition level)
Client: \${$json.company} | Rating: \${$json.clientRating}/5 | \${$json.totalHires} hires | \${$json.clientCountry}

STRATEGY:
- If <5 proposals and posted <1hr ago: Emphasize immediate availability
- If high budget ($5000+ or $50+/hr): Focus on expertise and ROI
- If many proposals (20+): Differentiate with specific proof/portfolio
- If new client (0 hires): Offer trust-builders like free consultation
- If urgent/ASAP mentioned: Lead with speed of delivery

REQUIREMENTS:
- Use the template above as foundation for EVERY job
- Adapt template to match this specific job requirements
- Keep proposal EXACTLY under 2000 characters
- Do NOT include subject line or greeting prefixes
- Start directly with proposal content
- Maintain professional tone and personality from template

Generate the proposal now.\`
    }
  ],
  temperature: ${config.temperature},
  max_completion_tokens: ${config.maxTokens}
}) }}`;

    // Update the node
    proposalNode.parameters.jsonBody = newJsonBody;

    // Create backup
    const backupPath = workflowPath.replace('.json', `.backup-${Date.now()}.json`);
    fs.writeFileSync(backupPath, workflowContent);
    console.log(`✅ Backup saved: ${backupPath}`);

    // Save updated workflow
    fs.writeFileSync(workflowPath, JSON.stringify(workflow, null, 2));
    console.log(`✅ Updated workflow: ${workflowPath}`);
    console.log(`📝 Model: ${config.model}`);
    console.log(`🌡️ Temperature: ${config.temperature}`);
    console.log(`🎯 Max tokens: ${config.maxTokens}`);
    console.log(`📄 System prompt updated from: ${templatePath}`);
    console.log(`📏 Prompt length: ${systemPrompt.length} characters`);

    return {
      success: true,
      config,
      promptLength: systemPrompt.length,
      backupPath
    };

  } catch (error) {
    console.error('❌ Error:', error.message);
    return false;
  }
}

// Main execution
const templatePath = process.argv[2] || 'aws-expert.md';
const workflowPath = process.argv[3] || 'Upwork AI Fetching.json';

console.log(`Updating workflow with template: ${templatePath}`);
updateWorkflow(templatePath, workflowPath);