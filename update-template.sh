#!/bin/bash

# Update n8n workflow with GPT-5 and temperature 1
# Usage: ./update-template.sh [template.md]

TEMPLATE_FILE=${1:-"aws-expert.md"}
WORKFLOW_FILE="Upwork AI Fetching.json"

echo "🔄 Updating n8n workflow..."
echo "📄 Template: $TEMPLATE_FILE"
echo "⚙️  Workflow: $WORKFLOW_FILE"
echo ""

# Run the Node.js script
node update-workflow-simple.js "$TEMPLATE_FILE" "$WORKFLOW_FILE"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Workflow updated successfully!"
    echo "🚀 Ready to use GPT-5 with temperature 1"
else
    echo ""
    echo "❌ Update failed!"
    exit 1
fi